import { Worker, Queue, Job } from 'bullmq';
import { redisConnection, redisClient } from '../config/redis';
import { ENV } from '../config/env';
import { GoogleConnection } from '../models/GoogleConnection';
import { Location, LocationDocument } from '../models/Location';
import { googleVaultService } from '../modules/google/google-vault.service';
import { gbpClientService } from '../modules/google/gbp-client.service';
import { onLocationConnected } from '../events/location-connected.hook';
import { invalidateLocationChatCache } from '../modules/chat/chat.cache';

export interface SyncJobData {
  workspaceId: string;
  locationId?: string;
  isManual?: boolean;
}

export const SYNC_QUEUE_NAME = 'gbp-sync-queue';

let syncQueue: Queue<SyncJobData> | null = null;

function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobData>(SYNC_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
    syncQueue.on('error', (err) => {
      console.error('[Sync Queue] Redis error:', err.message);
    });
  }
  return syncQueue;
}

/**
 * Enqueues a sync job with automatic deduplication (§Deduplicated Sync Queue)
 */
export async function enqueueSyncJob(data: SyncJobData): Promise<string | null> {
  if (redisClient && redisClient.status === 'ready') {
    try {
      // BullMQ custom IDs must not contain colons.
      const jobId = `sync-${data.workspaceId}-${data.locationId || 'all'}`;
      const queue = getSyncQueue();
      const job = await queue.add('sync-location', data, { jobId });
      if (job && job.id) return job.id;
    } catch (e: any) {
      if (ENV.REQUIRE_REDIS && ENV.NODE_ENV === 'production') throw e;
    }
  }
  if (ENV.REQUIRE_REDIS && ENV.NODE_ENV === 'production') {
    throw new Error('Redis is unavailable; Google Business Profile sync could not be queued.');
  }
  // Development / test fallback without live Redis queue
  if (data.locationId) {
    setTimeout(async () => {
      try {
        await processWorkspaceSync(data.workspaceId);
      } catch {}
    }, 10);
  }
  return `mock-sync-${data.workspaceId}-${data.locationId || 'all'}`;
}

/**
 * Syncs an individual location with Google Business Profile APIs
 */
async function syncSingleLocationRecord(
  loc: LocationDocument,
  accessToken: string,
  workspaceId: string
): Promise<void> {
  const lockKey = `sync:location:${loc._id}`;
  let lockAcquired = false;

  try {
    if (redisClient && redisClient.status === 'ready') {
      const acquired = await redisClient.set(lockKey, 'locked', 'EX', 60, 'NX');
      if (!acquired) {
        console.warn(`[Sync Worker] Location ${loc._id} is already syncing. Skipping.`);
        return;
      }
      lockAcquired = true;
    }

    if (!loc.gbpAccountId || !loc.gbpLocationId) {
      if (accessToken.startsWith('mock_')) {
        loc.gbpAccountId = loc.gbpAccountId || 'accounts/mock_acc_1001';
        loc.gbpLocationId = loc.gbpLocationId || `locations/mock_loc_${loc._id}`;
      } else {
        throw Object.assign(new Error('This location is not linked to a Google Business Profile.'), { statusCode: 409 });
      }
    }

    const snapshot = await gbpClientService.getLocationSnapshot(
      accessToken,
      loc.gbpAccountId,
      loc.gbpLocationId,
      workspaceId
    );
    loc.name = snapshot.name || loc.name;
    loc.address = snapshot.address || loc.address;
    loc.city = snapshot.city || loc.city;
    loc.state = snapshot.state || loc.state;
    loc.country = snapshot.country || loc.country;
    loc.postalCode = snapshot.postalCode || loc.postalCode;
    loc.coordinates = snapshot.coordinates || loc.coordinates;
    loc.placeId = snapshot.placeId || loc.placeId;
    loc.primaryCategory = snapshot.primaryCategory || loc.primaryCategory;
    loc.secondaryCategories = snapshot.secondaryCategories || loc.secondaryCategories;
    loc.categories = [snapshot.primaryCategory?.displayName, ...(snapshot.secondaryCategories || []).map((category) => category.displayName)].filter((value): value is string => Boolean(value));
    loc.phone = snapshot.phone || loc.phone;
    loc.website = snapshot.website || loc.website;
    loc.description = snapshot.description || loc.description;
    loc.regularHours = snapshot.regularHours || loc.regularHours;
    loc.photosCount = snapshot.photosCount ?? loc.photosCount;
    loc.coverPhotoUrl = snapshot.coverPhotoUrl || loc.coverPhotoUrl;
    loc.logoUrl = snapshot.logoUrl || loc.logoUrl;
    loc.mediaSyncedAt = snapshot.mediaSyncedAt ? new Date(snapshot.mediaSyncedAt) : loc.mediaSyncedAt;
    loc.syncStatus = snapshot.mediaSyncError ? 'ERROR' : 'SYNCED';
    loc.syncError = snapshot.mediaSyncError || null;
    loc.lastSyncedAt = new Date();
    await loc.save();

    await onLocationConnected(loc._id.toString(), workspaceId);
    await invalidateLocationChatCache(loc._id.toString()).catch(() => {});
  } catch (locErr: any) {
    loc.syncStatus = 'ERROR';
    loc.syncError = locErr.message || 'Sync failed';
    await loc.save();
    throw locErr;
  } finally {
    if (lockAcquired && redisClient && redisClient.status === 'ready') {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
}

/**
 * Syncs all locations for a given workspace with distributed locking per location (§Distributed Lock)
 */
export async function processWorkspaceSync(workspaceId: string): Promise<{ synced: number; errors: number; skipped: number }> {
  const locations = await Location.find({
    workspaceId,
    deletedAt: null,
    googleConnectionId: { $ne: null },
  });

  let synced = 0;
  let errors = 0;
  let skipped = 0;

  for (const loc of locations) {
    try {
      const connection = await GoogleConnection.findOne({
        _id: loc.googleConnectionId,
        workspaceId,
        status: 'CONNECTED',
      });
      if (!connection) {
        skipped++;
        continue;
      }
      const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
      await syncSingleLocationRecord(loc, accessToken, workspaceId);
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors, skipped };
}

let syncWorker: Worker<SyncJobData> | null = null;

export function startSyncWorker() {
  if (!redisConnection) {
    console.warn('⚠️ BullMQ sync worker is DISABLED: Redis is not connected.');
    return;
  }

  syncWorker = new Worker<SyncJobData>(
    SYNC_QUEUE_NAME,
    async (job: Job<SyncJobData>) => {
      const { workspaceId, locationId } = job.data;

      if (locationId) {
        const loc = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
        if (!loc) return;
        const connection = await GoogleConnection.findOne({
          _id: loc.googleConnectionId,
          workspaceId,
          status: 'CONNECTED',
        });
        if (!connection) throw new Error('Google connection is inactive for this location.');
        const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
        await syncSingleLocationRecord(loc, accessToken, workspaceId);
      } else {
        await processWorkspaceSync(workspaceId);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  syncWorker.on('completed', (job) => {
    console.log(`[Sync Worker] Job ${job.id} completed for workspace ${job.data.workspaceId}`);
  });

  syncWorker.on('failed', (job, err) => {
    console.error(`[Sync Worker] Job ${job?.id} failed:`, err);
  });
  syncWorker.on('error', (err) => {
    console.error('[Sync Worker] Redis queue error:', err.message);
  });
}

/**
 * Gracefully shuts down the sync worker on process termination
 */
export async function closeSyncWorker(): Promise<void> {
  if (syncWorker) {
    await syncWorker.close();
    syncWorker = null;
  }
}

import { Worker, Queue, Job } from 'bullmq';
import { redisConnection, redisClient } from '../config/redis';
import { ENV } from '../config/env';
import { gscService } from '../modules/gsc/gsc.service';

export interface GscSyncJobData {
  workspaceId: string;
  locationId: string;
  isManual?: boolean;
}

export const GSC_SYNC_QUEUE_NAME = 'gsc-sync-queue';

let gscSyncQueue: Queue<GscSyncJobData> | null = null;

function getGscSyncQueue(): Queue<GscSyncJobData> {
  if (!gscSyncQueue) {
    gscSyncQueue = new Queue<GscSyncJobData>(GSC_SYNC_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
    gscSyncQueue.on('error', (err) => {
      console.error('[GSC Sync Queue] Redis error:', err.message);
    });
  }
  return gscSyncQueue;
}

/**
 * Enqueues a GSC synchronization job with deduplication per location
 */
export async function enqueueGscSync(
  locationId: string,
  workspaceId: string,
  isManual = false
): Promise<string | null> {
  if (redisClient && redisClient.status === 'ready') {
    try {
      const jobId = `gsc-sync-${locationId}`;
      const queue = getGscSyncQueue();
      const job = await queue.add('sync-gsc-location', { workspaceId, locationId, isManual }, { jobId });
      if (job && job.id) return job.id;
    } catch (e: any) {
      if (ENV.REQUIRE_REDIS && ENV.NODE_ENV === 'production') throw e;
    }
  }

  if (ENV.REQUIRE_REDIS && ENV.NODE_ENV === 'production') {
    throw new Error('Redis is unavailable; GSC sync could not be queued.');
  }

  // Development / test fallback without live Redis queue
  setTimeout(async () => {
    try {
      await gscService.syncLocation(locationId);
    } catch (err) {
      console.error(`[GSC Fallback Sync] Failed for location ${locationId}:`, err);
    }
  }, 20);

  return `mock-gsc-sync-${locationId}`;
}

let gscSyncWorker: Worker<GscSyncJobData> | null = null;

export function startGscWorker(): Worker<GscSyncJobData> | null {
  if (!redisConnection) {
    console.warn('⚠️ BullMQ GSC sync worker is DISABLED: Redis is not connected.');
    return null;
  }

  gscSyncWorker = new Worker<GscSyncJobData>(
    GSC_SYNC_QUEUE_NAME,
    async (job: Job<GscSyncJobData>) => {
      const { locationId } = job.data;
      if (!locationId) return;
      await gscService.syncLocation(locationId);
    },
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  gscSyncWorker.on('completed', (job) => {
    console.log(`[GSC Sync Worker] Location sync completed: ${job.data.locationId}`);
  });

  gscSyncWorker.on('failed', (job, err) => {
    console.error(`[GSC Sync Worker] Location sync failed for ${job?.data?.locationId}:`, err);
  });

  gscSyncWorker.on('error', (err) => {
    console.error('[GSC Sync Worker] Redis queue error:', err.message);
  });

  return gscSyncWorker;
}

export async function closeGscWorker(): Promise<void> {
  if (gscSyncWorker) {
    await gscSyncWorker.close();
    gscSyncWorker = null;
  }
  if (gscSyncQueue) {
    await gscSyncQueue.close();
    gscSyncQueue = null;
  }
}

import { Worker, Job, UnrecoverableError } from 'bullmq';
import mongoose from 'mongoose';
import { redisConnection, redisClient } from '../config/redis';
import { AUDIT_QUEUE_NAME, AuditJobPayload } from './audit.queue';
import { auditService } from '../modules/audits/audit.service';
import { Location } from '../models/Location';

let auditWorkerInstance: Worker<AuditJobPayload> | null = null;

export async function processAuditJob(job: Job<AuditJobPayload> | { id?: string; data: AuditJobPayload }): Promise<{ auditId?: string; score?: number; coalesced?: boolean }> {
  const { workspaceId, locationId, triggerSource, queuedAt } = job.data;

  if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(locationId)) {
    console.warn(`[Audit Worker] Invalid ObjectId in audit job data: locationId=${locationId}, workspaceId=${workspaceId}`);
    throw new UnrecoverableError(`Invalid ObjectId in audit job: locationId=${locationId}, workspaceId=${workspaceId}`);
  }

  // Check if location exists and belongs to workspace before running
  const location = await Location.findOne({
    _id: new mongoose.Types.ObjectId(locationId),
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  if (!location) {
    console.warn(
      `[Audit Worker] Location ${locationId} does not exist in workspace ${workspaceId} (or is soft-deleted). Terminating non-retryable job.`
    );
    throw new UnrecoverableError(`Location ${locationId} not found in workspace ${workspaceId}`);
  }

  // Check if a more recent edit was queued while this job was delayed
  if (redisClient && redisClient.status === 'ready') {
    const latestTimestampStr = await redisClient.get(`audit:debounce:${workspaceId}:${locationId}`);
    if (latestTimestampStr) {
      const latestTimestamp = Number(latestTimestampStr);
      if (latestTimestamp > queuedAt && latestTimestamp - queuedAt >= 100) {
        console.log(
          `[Audit Worker] Coalescing debounced audit for location ${locationId} (newer edit detected).`
        );
        return { coalesced: true };
      }
    }
  }

  console.log(`🛡️ [Audit Worker] Executing audit for location ${locationId} (trigger: ${triggerSource})`);
  const audit = await auditService.runAudit(locationId, workspaceId);
  return { auditId: audit._id.toString(), score: audit.score };
}

export function startAuditWorker(): Worker<AuditJobPayload> | null {
  if (auditWorkerInstance) return auditWorkerInstance;
  if (!redisConnection) {
    console.warn('⚠️ BullMQ audit worker is DISABLED: Redis is not connected.');
    return null;
  }

  auditWorkerInstance = new Worker<AuditJobPayload>(
    AUDIT_QUEUE_NAME,
    async (job: Job<AuditJobPayload>) => {
      return processAuditJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  auditWorkerInstance.on('completed', (job) => {
    console.log(`[Audit Worker] Job ${job.id} completed for location ${job.data.locationId}`);
  });

  auditWorkerInstance.on('failed', (job, err) => {
    console.error(`[Audit Worker] Job ${job?.id} failed:`, err?.message || err);
  });
  auditWorkerInstance.on('error', (err) => {
    console.error('[Audit Worker] Redis queue error:', err.message);
  });

  return auditWorkerInstance;
}

export function initAuditWorker(): Worker<AuditJobPayload> | null {
  return startAuditWorker();
}

export async function closeAuditWorker(): Promise<void> {
  if (auditWorkerInstance) {
    await auditWorkerInstance.close();
    auditWorkerInstance = null;
  }
}

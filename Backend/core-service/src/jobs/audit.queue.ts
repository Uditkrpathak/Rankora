import { Queue } from 'bullmq';
import { redisConnection, redisClient } from '../config/redis';

export const AUDIT_QUEUE_NAME = 'audit-execution-queue';

export interface AuditJobPayload {
  workspaceId: string;
  locationId: string;
  triggerSource?: string;
  queuedAt: number;
}

let auditQueueInstance: Queue<AuditJobPayload> | null = null;

export function getAuditQueue(): Queue<AuditJobPayload> {
  if (!auditQueueInstance) {
    auditQueueInstance = new Queue<AuditJobPayload>(AUDIT_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 5,
          age: 1800,
        },
        removeOnFail: {
          count: 10,
          age: 86400,
        },
      },
    });
  }
  return auditQueueInstance;
}

import mongoose from 'mongoose';

/**
 * Queues a debounced audit run for a location.
 * Coalesces rapid successive edits (e.g. description + hours within 1.5s window).
 */
export async function queueAuditExecution(params: {
  workspaceId: string;
  locationId: string;
  triggerSource?: string;
  debounceMs?: number;
}): Promise<{ jobId: string }> {
  const { workspaceId, locationId, triggerSource, debounceMs = 1500 } = params;

  if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(locationId)) {
    throw new Error(`Invalid workspaceId (${workspaceId}) or locationId (${locationId}) for audit queueing.`);
  }

  const queue = getAuditQueue();
  const jobId = `audit-${workspaceId}-${locationId}`;
  const now = Date.now();

  try {
    // Record the latest debounce timestamp in Redis
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.set(`audit:debounce:${workspaceId}:${locationId}`, now.toString(), 'PX', 10000);
    }

    // Try removing any existing pending/delayed job for this location before scheduling
    try {
      const existingJob = await queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'delayed' || state === 'waiting') {
          await existingJob.remove();
        }
      }
    } catch {
      // Non-fatal if job not found
    }

    await queue.add(
      'run-location-audit',
      {
        workspaceId,
        locationId,
        triggerSource: triggerSource || 'remediation_patch',
        queuedAt: now,
      },
      {
        jobId,
        delay: debounceMs,
      }
    );

    return { jobId };
  } catch (error) {
    console.warn(`[Audit Queue] Fallback direct audit queueing for ${locationId}:`, error);
    // Direct add without custom ID if Redis/BullMQ encountered an issue
    const fallback = await queue.add(
      'run-location-audit',
      {
        workspaceId,
        locationId,
        triggerSource: triggerSource || 'fallback',
        queuedAt: now,
      },
      { delay: debounceMs }
    );
    return { jobId: fallback.id || jobId };
  }
}

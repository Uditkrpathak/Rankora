import { Queue, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { ScanDeadLetter } from '../models/ScanDeadLetter';
import { scanDeadLetterTotal, scanDeadLetterDepth, queueFailedJobs } from '../monitoring/metrics';
import { AdminAlertService } from '../events/admin-alert.service';
import { logger } from '../config/logger';

export const SCAN_DEAD_LETTER_QUEUE_NAME = 'scan-dead-letter';

let deadLetterQueue: Queue | null = null;

export function getDeadLetterQueue(): Queue {
  if (!deadLetterQueue) {
    deadLetterQueue = new Queue(SCAN_DEAD_LETTER_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000, age: 30 * 86400 },
        removeOnFail: false,
      },
    });
    deadLetterQueue.on('error', (err) => {
      console.error('[DLQ Queue] Redis error:', err.message);
    });
  }
  return deadLetterQueue;
}

export interface DeadLetterPayload {
  originalJobId: string;
  originalQueue: string;
  payload: any;
  error: {
    message: string;
    stack?: string;
    code?: string;
  };
  attemptsMade: number;
  failedAt: string;
}

/**
 * Moves a permanently failed job into the scan-dead-letter queue and Mongo collection.
 */
export async function moveToDeadLetterQueue(
  queueName: string,
  job: Job | undefined,
  err: Error
): Promise<void> {
  const jobId = job?.id ? String(job.id) : `unknown_${Date.now()}`;
  const payload = job?.data || {};
  const attemptsMade = job?.attemptsMade || (job?.opts?.attempts || 3);
  const errorCode = (err as any)?.code || 'EXECUTION_FAILURE';

  const dlqPayload: DeadLetterPayload = {
    originalJobId: jobId,
    originalQueue: queueName,
    payload,
    error: {
      message: err.message,
      stack: err.stack,
      code: errorCode,
    },
    attemptsMade,
    failedAt: new Date().toISOString(),
  };

  // 1. Structured Error Log
  logger.error(
    {
      jobId,
      queueName,
      attemptsMade,
      error: err.message,
      scanId: payload?.scanId,
      workspaceId: payload?.workspaceId,
    },
    `🚨 [BullMQ DLQ] Job ${jobId} on queue ${queueName} exhausted all retries (${attemptsMade} attempts). Moving to dead letter queue.`
  );

  // 2. Persist to MongoDB ScanDeadLetter collection
  try {
    await ScanDeadLetter.create({
      jobId,
      queueName,
      payload,
      error: {
        message: err.message,
        stack: err.stack,
        code: errorCode,
      },
      attemptsMade,
      failedAt: new Date(),
      status: 'DEAD',
    });
  } catch (mongoErr: any) {
    logger.warn({ err: mongoErr }, '[BullMQ DLQ] Could not persist to Mongo ScanDeadLetter collection');
  }

  // 3. Add to BullMQ Dead Letter Queue
  try {
    const queue = getDeadLetterQueue();
    await queue.add('dead-letter-job', dlqPayload, {
      jobId: `dlq_${jobId}_${Date.now()}`,
    });

    const waitingCount = await queue.getWaitingCount();
    scanDeadLetterDepth.set(waitingCount);
  } catch (queueErr: any) {
    logger.warn({ err: queueErr }, '[BullMQ DLQ] Could not add job to scan-dead-letter BullMQ queue');
  }

  // 4. Increment Prometheus Telemetry
  scanDeadLetterTotal.inc({
    queue_name: queueName,
    reason: errorCode,
  });
  queueFailedJobs.inc({ queue: 'dead-letter' });

  // 5. Dispatch Admin Alert / Webhook
  try {
    await AdminAlertService.notify({
      event: 'SCAN_DLQ_FAILURE',
      severity: 'CRITICAL',
      message: `[DLQ] Scan Job ${jobId} on ${queueName} permanently failed after ${attemptsMade} attempts: ${err.message}`,
      metadata: {
        jobId,
        queueName,
        scanId: payload?.scanId,
        workspaceId: payload?.workspaceId,
        attemptsMade,
        error: err.message,
      },
    });
  } catch (alertErr: any) {
    logger.warn({ err: alertErr }, '[BullMQ DLQ] Failed to send AdminAlert');
  }
}

/**
 * Inspects jobs currently in the dead letter queue.
 */
export async function inspectDeadLetterJobs(start = 0, end = 50): Promise<any[]> {
  const queue = getDeadLetterQueue();
  const jobs = await queue.getJobs(['waiting', 'delayed', 'failed'], start, end);
  return jobs.map((j) => ({
    dlqJobId: j.id,
    data: j.data,
    timestamp: j.timestamp,
  }));
}

/**
 * Replays a job from the dead letter queue back to its original target queue.
 */
export async function replayDeadLetterJob(dlqJobId: string): Promise<boolean> {
  const queue = getDeadLetterQueue();
  const dlqJob = await queue.getJob(dlqJobId);
  if (!dlqJob) {
    console.warn(`[DLQ Replay] Job ${dlqJobId} not found in dead letter queue.`);
    return false;
  }

  const { originalQueue, payload, originalJobId } = dlqJob.data as DeadLetterPayload;
  console.log(`[DLQ Replay] Replaying job ${originalJobId} back to ${originalQueue}...`);

  const { getOnDemandScanQueue, getWeeklyScanQueue } = await import('./scan.queue');
  const targetQueue = originalQueue.includes('weekly') ? getWeeklyScanQueue() : getOnDemandScanQueue();

  await targetQueue.add('execute-scan', payload, {
    jobId: `replayed_${originalJobId}_${Date.now()}`,
  });

  await ScanDeadLetter.updateOne(
    { jobId: originalJobId },
    { $set: { status: 'REPLAYED', replayedAt: new Date() } }
  );

  await dlqJob.remove();

  const waitingCount = await queue.getWaitingCount();
  scanDeadLetterDepth.set(waitingCount);
  return true;
}

import { Queue, Worker } from 'bullmq';
import { redisClient, redisConnection } from '../config/redis';
import { auditService } from '../modules/audits/audit.service';

const QUEUE_NAME = 'weekly-audit-scheduler';
let auditQueue: Queue | null = null;
let auditWorker: Worker | null = null;

export async function startAuditScheduler(): Promise<Worker | null> {
  if (redisClient.status !== 'ready') {
    console.warn('[Audit Scheduler] Redis is not connected; weekly audits are disabled.');
    return null;
  }
  try {
    auditQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
    auditQueue.on('error', (error) => console.error('[Audit Scheduler Queue] Redis error:', error.message));
    await auditQueue.add('dispatch-due-audits', {}, {
      jobId: 'dispatch-due-audits',
      repeat: { every: 60 * 60 * 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
    auditWorker = new Worker(
      QUEUE_NAME,
      async () => auditService.processDueAudits(),
      { connection: redisConnection, concurrency: 1 }
    );
    auditWorker.on('failed', (job, error) => {
      console.error(`[Audit Scheduler] Dispatch job ${job?.id || 'unknown'} failed:`, error);
    });
    auditWorker.on('error', (error) => console.error('[Audit Scheduler Worker] Redis error:', error.message));
    console.log('[Audit Scheduler] Weekly location audits enabled (hourly due-check).');
    return auditWorker;
  } catch (error) {
    console.error('[Audit Scheduler] Could not start weekly audit worker:', error);
    if (auditQueue) await auditQueue.close().catch(() => undefined);
    auditQueue = null;
    return null;
  }
}

export async function closeAuditScheduler(): Promise<void> {
  if (auditWorker) await auditWorker.close();
  if (auditQueue) await auditQueue.close();
  auditWorker = null;
  auditQueue = null;
}

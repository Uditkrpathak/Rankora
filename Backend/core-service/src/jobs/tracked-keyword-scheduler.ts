import { Queue, Worker } from 'bullmq';
import { redisClient, redisConnection } from '../config/redis';
import { keywordsService } from '../modules/keywords/keywords.service';

const QUEUE_NAME = 'tracked-keyword-scheduler';
let schedulerQueue: Queue | null = null;
let schedulerWorker: Worker | null = null;

export async function startTrackedKeywordScheduler(): Promise<Worker | null> {
  if (redisClient.status !== 'ready') {
    console.warn('[Keyword Scheduler] Redis is not connected; recurring scans are disabled.');
    return null;
  }

  try {
    schedulerQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
    schedulerQueue.on('error', (error) => console.error('[Keyword Scheduler Queue] Redis error:', error.message));
    await schedulerQueue.add(
      'dispatch-due-keywords',
      {},
      {
        jobId: 'dispatch-due-keywords',
        repeat: { every: 5 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );

    schedulerWorker = new Worker(
      QUEUE_NAME,
      async () => keywordsService.processDueScheduledScans(),
      { connection: redisConnection, concurrency: 1 }
    );
    schedulerWorker.on('failed', (job, error) => {
      console.error(`[Keyword Scheduler] Dispatch job ${job?.id || 'unknown'} failed:`, error);
    });
    schedulerWorker.on('error', (error) => console.error('[Keyword Scheduler Worker] Redis error:', error.message));

    console.log('[Keyword Scheduler] Recurring keyword scans enabled (5 minute dispatch interval).');
    return schedulerWorker;
  } catch (error) {
    console.error('[Keyword Scheduler] Could not start recurring scan worker:', error);
    if (schedulerQueue) await schedulerQueue.close().catch(() => undefined);
    schedulerQueue = null;
    return null;
  }
}

export async function closeTrackedKeywordScheduler(): Promise<void> {
  if (schedulerWorker) await schedulerWorker.close();
  if (schedulerQueue) await schedulerQueue.close();
  schedulerWorker = null;
  schedulerQueue = null;
}

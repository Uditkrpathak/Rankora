import { Queue, Worker } from 'bullmq';
import { redisClient, redisConnection } from '../config/redis';
import { ENV } from '../config/env';
import { gscService } from '../modules/gsc/gsc.service';

const QUEUE_NAME = 'gsc-daily-scheduler';
let gscSchedulerQueue: Queue | null = null;
let gscSchedulerWorker: Worker | null = null;

export async function startGscScheduler(): Promise<Worker | null> {
  if (redisClient.status !== 'ready') {
    console.warn('[GSC Scheduler] Redis is not connected; recurring daily GSC sync is disabled.');
    return null;
  }

  try {
    gscSchedulerQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
    gscSchedulerQueue.on('error', (error) => console.error('[GSC Scheduler Queue] Redis error:', error.message));

    // Register daily cron repeating job
    await gscSchedulerQueue.add(
      'daily-gsc-sync',
      {},
      {
        jobId: 'daily-gsc-sync',
        repeat: { pattern: ENV.GSC_SYNC_CRON },
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );

    gscSchedulerWorker = new Worker(
      QUEUE_NAME,
      async () => {
        console.log(`[GSC Scheduler] Executing daily GSC sync for all connected locations (Cron: ${ENV.GSC_SYNC_CRON})...`);
        const result = await gscService.syncAllConnectedLocations();
        console.log(`[GSC Scheduler] Daily sync complete: ${result.synced}/${result.total} synced, ${result.errors} errors.`);
      },
      { connection: redisConnection, concurrency: 1 }
    );

    gscSchedulerWorker.on('failed', (job, error) => {
      console.error(`[GSC Scheduler] Daily sync job ${job?.id || 'unknown'} failed:`, error);
    });
    gscSchedulerWorker.on('error', (error) => console.error('[GSC Scheduler Worker] Redis error:', error.message));

    console.log(`[GSC Scheduler] Daily Search Console sync job scheduled with cron: ${ENV.GSC_SYNC_CRON}`);
    return gscSchedulerWorker;
  } catch (error) {
    console.error('[GSC Scheduler] Could not start daily GSC sync scheduler:', error);
    if (gscSchedulerQueue) await gscSchedulerQueue.close().catch(() => undefined);
    gscSchedulerQueue = null;
    return null;
  }
}

export async function closeGscScheduler(): Promise<void> {
  if (gscSchedulerWorker) await gscSchedulerWorker.close();
  if (gscSchedulerQueue) await gscSchedulerQueue.close();
  gscSchedulerWorker = null;
  gscSchedulerQueue = null;
}

import { Queue, Worker } from 'bullmq';
import { redisClient, redisConnection } from '../config/redis';
import { PostgresPartitionManager } from '../database/postgres/partition-manager';
import { PostgresMigrationService } from '../database/postgres/migration.service';

const QUEUE_NAME = 'postgres-partition-scheduler';
let partitionQueue: Queue | null = null;
let partitionWorker: Worker | null = null;

export async function runPartitionMaintenance(): Promise<string[]> {
  try {
    await PostgresMigrationService.runMigrations();
    const provisioned = await PostgresPartitionManager.ensureUpcomingPartitions(3);
    console.log(`[Partition Maintenance] Successfully ensured rolling partitions: ${provisioned.join(', ')}`);
    return provisioned;
  } catch (err: any) {
    console.error('[Partition Maintenance] Error ensuring rolling partitions:', err.message);
    throw err;
  }
}

export async function startPartitionScheduler(): Promise<Worker | null> {
  if (redisClient.status !== 'ready') {
    console.warn('[Partition Scheduler] Redis is not connected; partition scheduler disabled.');
    return null;
  }

  try {
    // Run initial maintenance on boot
    await runPartitionMaintenance().catch((err) => {
      console.warn('[Partition Scheduler] Boot partition check deferred:', err.message);
    });

    partitionQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
    partitionQueue.on('error', (error) =>
      console.error('[Partition Scheduler Queue] Redis error:', error.message)
    );

    // Run partition maintenance check every 24 hours
    await partitionQueue.add(
      'ensure-monthly-partitions',
      {},
      {
        jobId: 'ensure-monthly-partitions',
        repeat: { every: 24 * 60 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 50,
      }
    );

    partitionWorker = new Worker(
      QUEUE_NAME,
      async () => runPartitionMaintenance(),
      { connection: redisConnection, concurrency: 1 }
    );

    partitionWorker.on('failed', (job, error) => {
      console.error(`[Partition Scheduler] Job ${job?.id || 'unknown'} failed:`, error);
    });
    partitionWorker.on('error', (error) =>
      console.error('[Partition Scheduler Worker] Redis error:', error.message)
    );

    console.log('[Partition Scheduler] Automated Postgres rolling partition scheduler active.');
    return partitionWorker;
  } catch (error) {
    console.error('[Partition Scheduler] Could not start partition worker:', error);
    if (partitionQueue) await partitionQueue.close().catch(() => undefined);
    partitionQueue = null;
    return null;
  }
}

export async function closePartitionScheduler(): Promise<void> {
  if (partitionWorker) await partitionWorker.close();
  if (partitionQueue) await partitionQueue.close();
  partitionWorker = null;
  partitionQueue = null;
}

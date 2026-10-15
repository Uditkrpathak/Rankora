import { connectDatabase, disconnectDatabase } from './config/db';
import { connectRedis, redisClient } from './config/redis';
import { closeEmailWorker, startEmailWorker } from './jobs/email.worker';
import { closeScanWorker, startScanWorker } from './jobs/scan.worker';
import { closeSyncWorker, startSyncWorker } from './jobs/sync.worker';
import { closeAuditWorker, startAuditWorker } from './jobs/audit.worker';
import { closeTrackedKeywordScheduler, startTrackedKeywordScheduler } from './jobs/tracked-keyword-scheduler';
import { closeAuditScheduler, startAuditScheduler } from './jobs/audit-scheduler';
import { closePartitionScheduler, startPartitionScheduler } from './jobs/partition-scheduler';
import { closeGscWorker, startGscWorker } from './jobs/gsc.worker';
import { closeGscScheduler, startGscScheduler } from './jobs/gsc-scheduler';
import { ENV } from './config/env';

async function bootstrapWorker() {
  console.log('👷 Initializing background job workers...');
  let shuttingDown = false;
  const gracefulShutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('🛑 Shutting down background workers gracefully...');
    await Promise.all([
      closeEmailWorker(),
      closeScanWorker(),
      closeSyncWorker(),
      closeAuditWorker(),
      closeGscWorker(),
      closeTrackedKeywordScheduler(),
      closeAuditScheduler(),
      closePartitionScheduler(),
      closeGscScheduler(),
    ]);
    await Promise.allSettled([disconnectDatabase(), redisClient.quit()]);
  };

  try {
    await connectDatabase();
    await connectRedis();

    if (redisClient.status !== 'ready') {
      console.warn('[Worker] Redis is unavailable; background queue workers were not started.');
      process.once('SIGINT', gracefulShutdown);
      process.once('SIGTERM', gracefulShutdown);
      return;
    }

    const emailWorker = startEmailWorker();
    const scanWorker = startScanWorker();
    startSyncWorker();
    const auditWorker = startAuditWorker();
    const gscWorker = startGscWorker();
    const keywordScheduler = await startTrackedKeywordScheduler();
    const auditScheduler = await startAuditScheduler();
    await startPartitionScheduler();
    const gscScheduler = await startGscScheduler();

    if (ENV.REQUIRE_REDIS && (!emailWorker || !scanWorker || !auditWorker || !keywordScheduler || !auditScheduler)) {
      throw new Error('One or more required background workers failed to start.');
    }
    console.log('🚀 Background workers and recurring job schedulers started.');

    process.once('SIGINT', gracefulShutdown);
    process.once('SIGTERM', gracefulShutdown);
  } catch (error) {
    await gracefulShutdown();
    throw error;
  }
}

if (require.main === module) {
  bootstrapWorker().catch((err) => {
    console.error('[Worker] Startup failed:', err?.message || err);
    process.exitCode = 1;
  });
}

export { bootstrapWorker };

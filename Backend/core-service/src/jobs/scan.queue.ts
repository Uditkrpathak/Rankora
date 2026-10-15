import { Queue, QueueOptions } from 'bullmq';
import { redisClient, redisConnection } from '../config/redis';
import { ENV } from '../config/env';
import { getBullMqPriority, QUEUE_BACKPRESSURE } from '../config/scan-queue.config';

export interface ScanJobPayload {
  scanId: string;
  workspaceId: string;
  locationId: string;
  planKey?: string;
  scanType?: 'ondemand' | 'weekly';
  windowTimestamp?: string; // Deterministic scan window ISO string
  scheduledSlot?: string;
}

export const SCAN_ONDEMAND_QUEUE_NAME = 'ondemand-scan-queue';
export const SCAN_WEEKLY_QUEUE_NAME = 'weekly-scan-queue';
export const SCAN_QUEUE_NAME = 'ondemand-scan-queue'; // Fallback alias

let onDemandScanQueue: Queue<ScanJobPayload> | null = null;
let weeklyScanQueue: Queue<ScanJobPayload> | null = null;
let backpressureReconciliationTimer: NodeJS.Timeout | null = null;

const defaultQueueOpts: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      count: 20,
      age: 1800,
    },
    removeOnFail: {
      count: 50,
      age: 86400,
    },
  },
};

export function getOnDemandScanQueue(): Queue<ScanJobPayload> {
  if (!onDemandScanQueue) {
    onDemandScanQueue = new Queue<ScanJobPayload>(SCAN_ONDEMAND_QUEUE_NAME, defaultQueueOpts);
    onDemandScanQueue.on('error', (err) => {
      console.error('[OnDemand Scan Queue] Redis error:', err.message);
    });
  }
  return onDemandScanQueue;
}

export function getWeeklyScanQueue(): Queue<ScanJobPayload> {
  if (!weeklyScanQueue) {
    weeklyScanQueue = new Queue<ScanJobPayload>(SCAN_WEEKLY_QUEUE_NAME, defaultQueueOpts);
    weeklyScanQueue.on('error', (err) => {
      console.error('[Weekly Scan Queue] Redis error:', err.message);
    });
  }
  return weeklyScanQueue;
}

// Backward-compatible getter defaulting to on-demand queue
export function getScanQueue(): Queue<ScanJobPayload> {
  return getOnDemandScanQueue();
}

/**
 * Evaluates whether current timestamp falls within IST scrape night window:
 * 00:00 - 06:00 Asia/Kolkata (every day; IST is UTC+05:30 with no DST).
 */
export function getIstScrapeWindowStatus(now: Date = new Date()): {
  isInsideWindow: boolean;
  msUntilNextWindow: number;
  istHours: number;
  istMinutes: number;
} {
  // IST offset: UTC + 5h 30m
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const istHours = istTime.getUTCHours();
  const istMinutes = istTime.getUTCMinutes();
  const istSeconds = istTime.getUTCSeconds();
  const istMs = istTime.getUTCMilliseconds();

  // Window: 00:00:00 to 05:59:59 IST (00:00 to 06:00 Asia/Kolkata)
  const isInsideWindow = istHours >= 0 && istHours < 6;

  let msUntilNextWindow = 0;
  if (!isInsideWindow) {
    const msSinceMidnightIst = ((istHours * 60 + istMinutes) * 60 + istSeconds) * 1000 + istMs;
    const totalMsInDay = 24 * 60 * 60 * 1000;
    msUntilNextWindow = Math.max(1000, totalMsInDay - msSinceMidnightIst);
  }

  return { isInsideWindow, msUntilNextWindow, istHours, istMinutes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic Backpressure Counters via Redis Lua & 5-Minute Sync
// ─────────────────────────────────────────────────────────────────────────────
const ATOMIC_INCR_BACKPRESSURE_LUA = `
local globalKey = KEYS[1]
local wsKey = KEYS[2]
local maxGlobal = tonumber(ARGV[1])
local maxWs = tonumber(ARGV[2])

local curGlobal = tonumber(redis.call('get', globalKey) or '0')
local curWs = tonumber(redis.call('get', wsKey) or '0')

if curGlobal >= maxGlobal then
  return -1 -- Global overload
end
if curWs >= maxWs then
  return -2 -- Workspace overload
end

redis.call('incr', globalKey)
redis.call('expire', globalKey, 600)
redis.call('incr', wsKey)
redis.call('expire', wsKey, 600)
return 1 -- OK
`;

const ATOMIC_DECR_BACKPRESSURE_LUA = `
local globalKey = KEYS[1]
local wsKey = KEYS[2]

local curGlobal = tonumber(redis.call('get', globalKey) or '0')
if curGlobal > 0 then
  redis.call('decr', globalKey)
end

local curWs = tonumber(redis.call('get', wsKey) or '0')
if curWs > 0 then
  redis.call('decr', wsKey)
end
return 1
`;

export async function checkAndIncrementBackpressure(workspaceId: string): Promise<void> {
  if (redisClient && redisClient.status === 'ready') {
    try {
      const globalKey = 'queue:depth:global';
      const wsKey = `queue:depth:workspace:${workspaceId}`;

      const res = await redisClient.eval(
        ATOMIC_INCR_BACKPRESSURE_LUA,
        2,
        globalKey,
        wsKey,
        QUEUE_BACKPRESSURE.maxGlobalDepth,
        QUEUE_BACKPRESSURE.maxWorkspaceDepth
      );

      if (res === -1) {
        const err: any = new Error('QUEUE_OVERLOADED: System is processing too many scans. Please retry in 60 seconds.');
        err.statusCode = 503;
        err.code = 'QUEUE_OVERLOADED';
        err.retryAfter = QUEUE_BACKPRESSURE.retryAfterSeconds;
        throw err;
      }

      if (res === -2) {
        const err: any = new Error('WORKSPACE_QUEUE_OVERLOADED: Workspace has reached maximum concurrent queued scans. Please retry in 30 seconds.');
        err.statusCode = 503;
        err.code = 'WORKSPACE_QUEUE_OVERLOADED';
        err.retryAfter = 30;
        throw err;
      }
      return;
    } catch (err: any) {
      if (err.statusCode === 503) throw err;
      console.warn('[Scan Queue] Redis backpressure check error, falling back:', err);
    }
  }
}

export async function decrementBackpressure(workspaceId: string): Promise<void> {
  if (redisClient && redisClient.status === 'ready') {
    try {
      const globalKey = 'queue:depth:global';
      const wsKey = `queue:depth:workspace:${workspaceId}`;
      await redisClient.eval(ATOMIC_DECR_BACKPRESSURE_LUA, 2, globalKey, wsKey);
    } catch {}
  }
}

export async function checkQueueBackpressure(workspaceId: string): Promise<void> {
  await checkAndIncrementBackpressure(workspaceId);
}

/**
 * Synchronizes Redis backpressure counters with actual BullMQ queue metrics every 5 minutes.
 */
export async function reconcileBackpressureCounters(): Promise<void> {
  if (!redisClient || redisClient.status !== 'ready') return;
  try {
    const ondemandQueue = getOnDemandScanQueue();
    const weeklyQueue = getWeeklyScanQueue();

    const [odCounts, wkCounts] = await Promise.all([
      ondemandQueue.getJobCounts('waiting', 'active'),
      weeklyQueue.getJobCounts('waiting', 'active'),
    ]);

    const realTotal = (odCounts.waiting || 0) + (odCounts.active || 0) + (wkCounts.waiting || 0) + (wkCounts.active || 0);
    await redisClient.set('queue:depth:global', realTotal.toString(), 'EX', 600);
  } catch (err) {
    console.warn('[Scan Queue] Backpressure reconciliation error:', err);
  }
}

// Start 5-minute periodic backpressure sync
if (!backpressureReconciliationTimer && typeof setInterval !== 'undefined') {
  backpressureReconciliationTimer = setInterval(() => {
    reconcileBackpressureCounters().catch(() => {});
  }, 5 * 60 * 1000);
  if (backpressureReconciliationTimer.unref) {
    backpressureReconciliationTimer.unref();
  }
}

/**
 * Enqueues a scan job with deterministic windowTimestamp and split queue routing.
 */
export async function enqueueScanJob(
  payload: Omit<ScanJobPayload, 'windowTimestamp'> & { windowTimestamp?: string }
): Promise<string | null> {
  const scanType = payload.scanType || 'ondemand';

  // Deterministic windowTimestamp decided once at job creation time
  let windowTimestamp = payload.windowTimestamp;
  if (!windowTimestamp) {
    if (scanType === 'weekly' && payload.scheduledSlot) {
      windowTimestamp = new Date(payload.scheduledSlot).toISOString();
    } else if (scanType === 'weekly') {
      windowTimestamp = new Date().toISOString();
    } else {
      // On-demand: Creation time floored to the current hour for deterministic idempotency
      windowTimestamp = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
    }
  }

  const finalPayload: ScanJobPayload = {
    ...payload,
    scanType,
    windowTimestamp,
  };

  if (redisClient && redisClient.status === 'ready') {
    const priority = getBullMqPriority(payload.planKey);
    const jobId = `scan_${payload.workspaceId}_${payload.scanId}`;
    const targetQueue = scanType === 'weekly' ? getWeeklyScanQueue() : getOnDemandScanQueue();

    const job = await targetQueue.add('execute-scan', finalPayload, {
      priority,
      jobId,
    });
    return job.id || null;
  }

  if (ENV.REQUIRE_REDIS || ENV.isProd) {
    throw new Error('Redis is unavailable; the live rank scan could not be queued.');
  }

  // Graceful fallback for local development without active Redis queue
  try {
    const { processScanExecution } = await import('./scan.worker');
    setImmediate(async () => {
      try {
        await processScanExecution(finalPayload.scanId, finalPayload.workspaceId, finalPayload.locationId);
      } catch (err) {
        console.error('[Scan Queue Fallback] Execution error:', err);
      }
    });
    return `direct_${finalPayload.scanId}`;
  } catch (err) {
    console.warn('[Scan Queue Fallback] Failed to launch direct scan execution:', err);
    return null;
  }
}

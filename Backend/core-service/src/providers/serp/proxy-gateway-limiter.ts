import { redisClient } from '../../config/redis';

const LUA_ACQUIRE_CONCURRENCY = `
local key = KEYS[1]
local max_concurrent = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local cur = tonumber(redis.call('get', key) or 0)
if cur < max_concurrent then
  local n = redis.call('incr', key)
  redis.call('expire', key, ttl)
  return n
else
  return -1
end
`;

const LUA_RELEASE_CONCURRENCY = `
local key = KEYS[1]
local cur = tonumber(redis.call('get', key) or 0)
if cur > 0 then
  return redis.call('decr', key)
else
  return 0
end
`;

export class ProxyGatewayLimiter {
  private inMemoryActiveCounts: Map<string, number> = new Map();
  private inMemoryWaitQueues: Map<string, Array<() => void>> = new Map();
  public peakInFlightRecorded: Map<string, number> = new Map();

  constructor(private maxConcurrentPerGateway?: number) {}

  public getMaxConcurrent(): number {
    if (typeof this.maxConcurrentPerGateway === 'number' && this.maxConcurrentPerGateway > 0) {
      return this.maxConcurrentPerGateway;
    }
    const envVal = process.env.PROXY_MAX_CONCURRENCY_PER_GATEWAY;
    return envVal ? parseInt(envVal, 10) : 10;
  }

  public async acquire(gatewayKey: string, timeoutMs: number = 60000): Promise<() => void> {
    const maxLimit = this.getMaxConcurrent();
    const redisKey = `proxy:concurrency:${gatewayKey}`;
    const startTime = Date.now();

    // Idempotent release handle
    let released = false;
    const release = async () => {
      if (released) return;
      released = true;

      // 1. Redis release
      if (redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.eval(LUA_RELEASE_CONCURRENCY, 1, redisKey);
        } catch {
          // Fallback if Redis fails during release
        }
      }

      // 2. In-memory release
      const current = (this.inMemoryActiveCounts.get(gatewayKey) || 1) - 1;
      this.inMemoryActiveCounts.set(gatewayKey, Math.max(0, current));

      const queue = this.inMemoryWaitQueues.get(gatewayKey);
      if (queue && queue.length > 0) {
        const next = queue.shift();
        if (next) next();
      }
    };

    // Helper to record peak concurrency
    const recordPeak = (count: number) => {
      const prev = this.peakInFlightRecorded.get(gatewayKey) || 0;
      if (count > prev) {
        this.peakInFlightRecorded.set(gatewayKey, count);
      }
    };

    // 1. Try Redis-based distributed semaphore across worker processes
    if (redisClient && redisClient.status === 'ready') {
      while (Date.now() - startTime < timeoutMs) {
        try {
          const res = await redisClient.eval(
            LUA_ACQUIRE_CONCURRENCY,
            1,
            redisKey,
            maxLimit,
            60 // TTL 60s prevents semaphore leak on worker crash
          );

          if (typeof res === 'number' && res > 0) {
            recordPeak(res);
            // Organic spacing / jitter between requests (20-60ms) to avoid lockstep burst
            const jitterMs = Math.floor(Math.random() * 40) + 20;
            await new Promise((r) => setTimeout(r, jitterMs));
            return release;
          }
        } catch (err) {
          // If Redis eval fails, break loop to fall back to in-memory semaphore
          break;
        }

        // Wait with randomized backoff before next polling attempt
        const pollWait = Math.floor(Math.random() * 30) + 20;
        await new Promise((r) => setTimeout(r, pollWait));
      }
    }

    // 2. Fallback: In-memory concurrency limiter
    const currentMem = this.inMemoryActiveCounts.get(gatewayKey) || 0;
    if (currentMem < maxLimit) {
      this.inMemoryActiveCounts.set(gatewayKey, currentMem + 1);
      recordPeak(currentMem + 1);
      // Organic spacing / jitter
      const jitterMs = Math.floor(Math.random() * 40) + 20;
      await new Promise((r) => setTimeout(r, jitterMs));
      return release;
    }

    return new Promise((resolve) => {
      if (!this.inMemoryWaitQueues.has(gatewayKey)) {
        this.inMemoryWaitQueues.set(gatewayKey, []);
      }
      this.inMemoryWaitQueues.get(gatewayKey)!.push(async () => {
        const nowCount = (this.inMemoryActiveCounts.get(gatewayKey) || 0) + 1;
        this.inMemoryActiveCounts.set(gatewayKey, nowCount);
        recordPeak(nowCount);
        const jitterMs = Math.floor(Math.random() * 40) + 20;
        await new Promise((r) => setTimeout(r, jitterMs));
        resolve(release);
      });
    });
  }

  public async getActiveCount(gatewayKey: string): Promise<number> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(`proxy:concurrency:${gatewayKey}`);
        if (val !== null) return parseInt(val, 10);
      } catch {}
    }
    return this.inMemoryActiveCounts.get(gatewayKey) || 0;
  }
}

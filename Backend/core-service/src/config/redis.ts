import Redis from 'ioredis';
import { ENV } from './env';

function parseRedisConnection(urlStr: string) {
  try {
    const u = new URL(urlStr);
    const isTls = u.protocol === 'rediss:';
    return {
      host: u.hostname || '127.0.0.1',
      port: parseInt(u.port || '6379', 10),
      username: u.username || undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
}

export const redisConnection = parseRedisConnection(ENV.REDIS_URL || 'redis://127.0.0.1:6379');

export const redisClient = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
  retryStrategy: () => null // Don't spam reconnects if offline in dev
});

redisClient.on('error', (err) => {
  // Silent in dev when redis server is not installed locally
});

export async function connectRedis(): Promise<void> {
  try {
    if (redisClient.status === 'wait' || redisClient.status === 'end' || redisClient.status === 'close') {
      await redisClient.connect();
      console.log('✅ Connected to Redis successfully');
      try {
        const policyRes = await redisClient.config('GET', 'maxmemory-policy');
        const currentPolicy = Array.isArray(policyRes) ? policyRes[1] : (policyRes as any)?.['maxmemory-policy'];
        if (currentPolicy && currentPolicy !== 'noeviction') {
          console.warn(`⚠️ [Redis Eviction Check] Current maxmemory-policy is "${currentPolicy}". Redis should be configured with "noeviction" to prevent data loss in BullMQ queues.`);
        }
      } catch {
        // Ignore if Redis restricts CONFIG commands in managed environments
      }

    }
  } catch (err: any) {
    if (ENV.REQUIRE_REDIS) {
      throw new Error(
        `Redis unavailable and REQUIRE_REDIS=true — refusing to start. ` +
          `BullMQ email queue would be silently disabled. Error: ${err.message}`
      );
    }
    console.warn(
      '⚠️ Redis connection failed; background queues are unavailable:',
      err.message
    );
    console.warn('⚠️ Email, sync, and scheduled scan workers are disabled until Redis is reachable.');
  }
}

export const memoryFallback = new Map<string, { val: string; exp: number }>();

export const cacheStore = {
  async set(key: string, val: string, ttlSeconds: number): Promise<void> {
    if (redisClient.status === 'ready') {
      try {
        await redisClient.set(key, val, 'EX', ttlSeconds);
        return;
      } catch (e) {}
    }
    memoryFallback.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
  },

  async get(key: string): Promise<string | null> {
    if (redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(key);
        if (val !== null) return val;
      } catch (e) {}
    }
    const item = memoryFallback.get(key);
    if (!item) return null;
    if (item.exp < Date.now()) {
      memoryFallback.delete(key);
      return null;
    }
    return item.val;
  },

  async del(key: string): Promise<void> {
    if (redisClient.status === 'ready') {
      try {
        await redisClient.del(key);
      } catch (e) {}
    }
    memoryFallback.delete(key);
  },

  async incr(key: string, ttlSeconds: number = 900): Promise<number> {
    if (redisClient.status === 'ready') {
      try {
        const count = await redisClient.incr(key);
        if (count === 1) await redisClient.expire(key, ttlSeconds);
        return count;
      } catch (e) {}
    }
    const current = memoryFallback.get(key);
    let count = 1;
    if (current && current.exp > Date.now()) {
      count = parseInt(current.val, 10) + 1;
    }
    memoryFallback.set(key, { val: count.toString(), exp: Date.now() + ttlSeconds * 1000 });
    return count;
  },

  async ttl(key: string): Promise<number> {
    if (redisClient.status === 'ready') {
      try {
        return await redisClient.ttl(key);
      } catch (e) {}
    }
    const item = memoryFallback.get(key);
    if (!item) return -2;
    const rem = Math.floor((item.exp - Date.now()) / 1000);
    return rem > 0 ? rem : -2;
  }
};

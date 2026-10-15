import { redisClient as defaultRedisClient } from '../../config/redis';
import { ENV } from '../../config/env';
import { logger } from '../../config/logger';
import { Workspace } from '../../models/Workspace';
import { getRedisClient } from './chat.cache';

// Active Redis reference (allows mock injection during integration tests)
let activeRedisClient: any = null;

export function setQuotaRedisClientForTest(client: any): void {
  activeRedisClient = client;
}

export function resetQuotaRedisClientForTest(): void {
  activeRedisClient = null;
}

function getRedis() {
  return activeRedisClient ?? getRedisClient();
}

export interface QuotaReservationResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  resetsAt: Date;
  redisDown?: boolean;
}

/**
 * Returns canonical Redis quota key for a workspace for the given UTC month:
 * format: chat:quota:{workspaceId}:{YYYY-MM}
 */
export function buildQuotaKey(workspaceId: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `chat:quota:${workspaceId}:${yyyy}-${mm}`;
}

/**
 * Returns the exact UTC date when the monthly quota resets (1st of next month, 00:00:00 UTC).
 */
export function getMonthResetDate(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Lua script for atomic quota reservation:
 * 1. Atomically increments counter.
 * 2. On first increment, sets 35-day TTL so key naturally expires shortly after month end.
 * 3. If counter exceeds limit, rolls back by decrementing in the same atomic script.
 * Returns table: [allowed (1 or 0), used]
 */
export const RESERVE_LUA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
if current > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return {0, current - 1}
end
return {1, current}
`;

/**
 * Lua script for atomic quota refund:
 * Atomically decrements counter if > 0, ensuring it never falls below 0.
 * Returns updated used count.
 */
export const REFUND_LUA_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current > 0 then
  local updated = redis.call('DECR', KEYS[1])
  if updated < 0 then
    redis.call('SET', KEYS[1], '0')
    return 0
  end
  return updated
else
  return 0
end
`;

export class QuotaService {
  /**
   * Checks whether the Redis client is connected and ready.
   * Enables pre-reservation health checks so down states never touch Redis.
   */
  public isRedisAvailable(): boolean {
    const redis = getRedis();
    return Boolean(redis && redis.status === 'ready');
  }

  /**
   * Resolves the monthly AI Copilot quota limit for a workspace based on its subscription plan.
   * Matches Workspace model's plan enum: ['free_trial', 'free', 'starter', 'pro', 'agency'].
   * An unknown or missing plan always safely falls back to the FREE limit.
   */
  public async getWorkspaceQuotaLimit(workspaceId: string): Promise<number> {
    try {
      const ws = await Workspace.findById(workspaceId).select('plan').lean();
      const planKey = (ws?.plan?.key || '').toLowerCase().trim();

      switch (planKey) {
        case 'agency':
          return ENV.CHAT_QUOTA_AGENCY ?? 2000;
        case 'pro':
          return ENV.CHAT_QUOTA_PRO ?? 500;
        case 'starter':
          return ENV.CHAT_QUOTA_STARTER ?? 150;
        case 'free':
        case 'free_trial':
        default:
          return ENV.CHAT_QUOTA_FREE ?? 50;
      }
    } catch (err: any) {
      logger.warn({ workspaceId, err: err?.message }, '[QuotaService] Failed to read workspace plan, falling back to free limit');
      return ENV.CHAT_QUOTA_FREE ?? 50;
    }
  }

  /**
   * Atomically reserves 1 query quota via Redis Lua script before an LLM call.
   * If Redis is down, fails CLOSED for the LLM path to protect against runaway unmetered spend.
   * If quota is exceeded, atomically decrements and returns allowed: false.
   */
  public async reserveQuota(
    workspaceId: string,
    limit: number,
    date: Date = new Date()
  ): Promise<QuotaReservationResult> {
    const redis = getRedis();
    const resetsAt = getMonthResetDate(date);

    if (!redis || redis.status !== 'ready') {
      logger.error({ workspaceId }, '[QuotaService] Redis down: failing CLOSED for LLM path');
      return {
        allowed: false,
        used: 0,
        remaining: 0,
        limit,
        resetsAt,
        redisDown: true,
      };
    }

    try {
      const key = buildQuotaKey(workspaceId, date);
      const ttlSeconds = 35 * 86400;

      let allowed = false;
      let used = 0;

      if (typeof redis.eval === 'function') {
        const res = await redis.eval(RESERVE_LUA_SCRIPT, 1, key, limit, ttlSeconds);
        // Lua returns [allowed (0 or 1), used]
        const allowedInt = Array.isArray(res) ? Number(res[0]) : 0;
        used = Array.isArray(res) ? Number(res[1]) : limit;
        allowed = allowedInt === 1;
      } else {
        // Fallback for mocks/clients without eval
        const next = await redis.incr(key);
        if (next === 1 && typeof redis.expire === 'function') {
          await redis.expire(key, ttlSeconds).catch(() => {});
        }
        if (next > limit) {
          await redis.decr(key).catch(() => {});
          used = limit;
          allowed = false;
        } else {
          used = next;
          allowed = true;
        }
      }

      if (!allowed) {
        return {
          allowed: false,
          used: limit,
          remaining: 0,
          limit,
          resetsAt,
          redisDown: false,
        };
      }

      return {
        allowed: true,
        used,
        remaining: Math.max(0, limit - used),
        limit,
        resetsAt,
        redisDown: false,
      };
    } catch (err: any) {
      logger.error({ workspaceId, err: err?.message }, '[QuotaService] Redis reservation error: failing CLOSED for LLM path');
      return {
        allowed: false,
        used: 0,
        remaining: 0,
        limit,
        resetsAt,
        redisDown: true,
      };
    }
  }

  /**
   * Atomically refunds 1 quota count if the LLM call failed or returned safe fallback.
   * Uses Redis Lua script to guarantee the counter never falls below 0.
   */
  public async refundQuota(workspaceId: string, date: Date = new Date()): Promise<void> {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;

    try {
      const key = buildQuotaKey(workspaceId, date);
      if (typeof redis.eval === 'function') {
        await redis.eval(REFUND_LUA_SCRIPT, 1, key);
      } else {
        const current = parseInt((await redis.get(key)) || '0', 10);
        if (current > 0) {
          const val = await redis.decr(key);
          if (val < 0) {
            await redis.set(key, '0');
          }
        }
      }
    } catch (err: any) {
      logger.error({ workspaceId, err: err?.message }, '[QuotaService] Failed to refund quota');
    }
  }

  /**
   * Reads remaining quota for the workspace via a cheap read-only GET (no atomic mutation).
   * Used for deterministic and cached chat responses.
   * Fails open (returns undefined) when Redis is down so it is omitted from the response.
   */
  public async getRemainingQuota(
    workspaceId: string,
    limit: number,
    date: Date = new Date()
  ): Promise<number | undefined> {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') {
      return undefined; // Fails open (omitted) when Redis is down
    }

    try {
      const key = buildQuotaKey(workspaceId, date);
      const raw = await redis.get(key);
      const used = raw ? parseInt(raw, 10) : 0;
      return Math.max(0, limit - used);
    } catch (err: any) {
      logger.warn({ workspaceId, err: err?.message }, '[QuotaService] Failed to read remaining quota: failing open (omitted)');
      return undefined;
    }
  }
}

export const quotaService = new QuotaService();

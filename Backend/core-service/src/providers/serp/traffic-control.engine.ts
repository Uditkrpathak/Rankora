import crypto from 'crypto';
import { redisClient } from '../../config/redis';
import { EventEmitter } from 'events';

export interface TrafficControlConfig {
  globalRateLimitRps?: number;
  blockWindowSize?: number;
  throttleBlockPercent?: number;
  circuitBreakerBlockPercent?: number;
  circuitCooldownMs?: number;
  slotWindowStartHourUtc?: number;
  slotWindowEndHourUtc?: number;
}

export type CircuitBreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

/**
 * Atomic Redis Lua Script for Token Bucket Rate Limiting
 * KEYS[1]: bucket key (e.g. scraper:rate_limit:tokens)
 * KEYS[2]: timestamp key (e.g. scraper:rate_limit:last_updated)
 * ARGV[1]: max rate / capacity (RPS)
 * ARGV[2]: refill rate per millisecond (RPS / 1000)
 * ARGV[3]: current timestamp ms
 */
const TOKEN_BUCKET_LUA = `
local bucket_key = KEYS[1]
local ts_key = KEYS[2]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local current_tokens = tonumber(redis.call('get', bucket_key) or capacity)
local last_updated = tonumber(redis.call('get', ts_key) or now)

local elapsed = math.max(0, now - last_updated)
local generated = elapsed * refill_rate
local new_tokens = math.min(capacity, current_tokens + generated)

if new_tokens >= 1 then
  new_tokens = new_tokens - 1
  redis.call('set', bucket_key, new_tokens, 'EX', 60)
  redis.call('set', ts_key, now, 'EX', 60)
  return {1, new_tokens}
else
  redis.call('set', bucket_key, new_tokens, 'EX', 60)
  redis.call('set', ts_key, now, 'EX', 60)
  return {0, new_tokens}
end
`;

export class TrafficControlEngine extends EventEmitter {
  private inMemoryTokens: number | null = null;
  private inMemoryLastRefill = Date.now();
  private circuitState: CircuitBreakerState = 'CLOSED';
  private circuitOpenedAt = 0;
  private blockOutcomes: boolean[] = []; // true = blocked, false = ok

  constructor(private readonly config: TrafficControlConfig = {}) {
    super();
  }

  public getGlobalRps(): number {
    if (this.config.globalRateLimitRps !== undefined) return this.config.globalRateLimitRps;
    const envVal = process.env.GLOBAL_SCRAPER_RATE_LIMIT_RPS || process.env.SERP_RATE_LIMIT_RPS;
    if (envVal) {
      const parsed = parseFloat(envVal);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    throw new Error('MISSING_CONFIG: GLOBAL_SCRAPER_RATE_LIMIT_RPS (or SERP_RATE_LIMIT_RPS) environment variable is required without production defaults.');
  }

  public getBlockWindowSize(): number {
    if (this.config.blockWindowSize !== undefined) return this.config.blockWindowSize;
    const envVal = process.env.SCRAPER_BLOCK_WINDOW_SIZE || process.env.SERP_BLOCK_WINDOW_SIZE;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    throw new Error('MISSING_CONFIG: SCRAPER_BLOCK_WINDOW_SIZE (or SERP_BLOCK_WINDOW_SIZE) environment variable is required without production defaults.');
  }

  public getThrottleThresholdPercent(): number {
    if (this.config.throttleBlockPercent !== undefined) return this.config.throttleBlockPercent;
    const envVal = process.env.SCRAPER_THROTTLE_BLOCK_PERCENT || process.env.SERP_THROTTLE_BLOCK_PERCENT;
    if (envVal) {
      const parsed = parseFloat(envVal);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    throw new Error('MISSING_CONFIG: SCRAPER_THROTTLE_BLOCK_PERCENT (or SERP_THROTTLE_BLOCK_PERCENT) environment variable is required without production defaults.');
  }

  public getCircuitBreakerThresholdPercent(): number {
    if (this.config.circuitBreakerBlockPercent !== undefined) return this.config.circuitBreakerBlockPercent;
    const envVal = process.env.SCRAPER_CIRCUIT_BREAKER_BLOCK_PERCENT || process.env.SERP_CIRCUIT_BREAKER_BLOCK_PERCENT;
    if (envVal) {
      const parsed = parseFloat(envVal);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    throw new Error('MISSING_CONFIG: SCRAPER_CIRCUIT_BREAKER_BLOCK_PERCENT (or SERP_CIRCUIT_BREAKER_BLOCK_PERCENT) environment variable is required without production defaults.');
  }

  public getCircuitCooldownMs(): number {
    if (this.config.circuitCooldownMs !== undefined) return this.config.circuitCooldownMs;
    const envVal = process.env.SCRAPER_CIRCUIT_COOLDOWN_MS || process.env.SERP_CIRCUIT_COOLDOWN_MS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 30000; // 30s default cooldown
  }

  /**
   * Acquires a rate-limit token from Redis Token Bucket (or memory fallback).
   * Crucial: Every request and every retry attempt consumes a distinct token.
   */
  public async acquireToken(): Promise<{ allowed: boolean; effectiveRps: number; reason?: string }> {
    const targetRps = this.getGlobalRps();
    let effectiveRps = targetRps;

    // Check circuit breaker status & cooldown
    if (this.circuitState === 'OPEN') {
      const elapsedSinceOpen = Date.now() - this.circuitOpenedAt;
      if (elapsedSinceOpen >= this.getCircuitCooldownMs()) {
        this.circuitState = 'HALF_OPEN';
        this.emit('circuit_breaker_half_open');
      } else {
        return { allowed: false, effectiveRps: 0, reason: 'CIRCUIT_BREAKER_OPEN' };
      }
    }

    // If throttled (block rate > throttle threshold), halve effective RPS
    const currentBlockRate = this.getCurrentBlockRate();
    if (currentBlockRate >= this.getThrottleThresholdPercent()) {
      effectiveRps = Math.max(1, Math.floor(targetRps / 2));
    }

    if (redisClient.status === 'ready') {
      try {
        const bucketKey = 'scraper:rate_limit:tokens';
        const tsKey = 'scraper:rate_limit:last_updated';
        const now = Date.now();
        const refillRate = targetRps / 1000.0;

        const res: any = await redisClient.eval(
          TOKEN_BUCKET_LUA,
          2,
          bucketKey,
          tsKey,
          targetRps,
          refillRate,
          now
        );

        const allowed = res[0] === 1;
        return { allowed, effectiveRps: targetRps };
      } catch (err) {
        // Fallback to memory
      }
    }

    // In-memory token bucket fallback
    const now = Date.now();
    if (this.inMemoryTokens === null) {
      this.inMemoryTokens = targetRps;
    }
    const elapsed = Math.max(0, now - this.inMemoryLastRefill);
    const refill = (elapsed / 1000.0) * targetRps;
    this.inMemoryTokens = Math.min(targetRps, this.inMemoryTokens + refill);
    this.inMemoryLastRefill = now;

    if (this.inMemoryTokens >= 1) {
      this.inMemoryTokens -= 1;
      return { allowed: true, effectiveRps };
    }
    return { allowed: false, effectiveRps };
  }

  /**
   * Records request outcome to maintain sliding block window
   */
  public recordRequestOutcome(wasBlocked: boolean): {
    currentBlockRate: number;
    circuitState: CircuitBreakerState;
    isThrottled: boolean;
  } {
    const windowSize = this.getBlockWindowSize();
    this.blockOutcomes.push(wasBlocked);
    if (this.blockOutcomes.length > windowSize) {
      this.blockOutcomes.shift();
    }

    const currentBlockRate = this.getCurrentBlockRate();
    const cbThreshold = this.getCircuitBreakerThresholdPercent();
    const throttleThreshold = this.getThrottleThresholdPercent();

    if (currentBlockRate >= cbThreshold) {
      if (this.circuitState !== 'OPEN') {
        this.circuitState = 'OPEN';
        this.circuitOpenedAt = Date.now();
        this.emit('circuit_breaker_opened', { blockRate: currentBlockRate });
      }
    } else if (this.circuitState === 'OPEN' && currentBlockRate < cbThreshold / 2) {
      this.circuitState = 'CLOSED';
      this.emit('circuit_breaker_closed', { blockRate: currentBlockRate });
    }

    const isThrottled = currentBlockRate >= throttleThreshold;
    return {
      currentBlockRate,
      circuitState: this.circuitState,
      isThrottled,
    };
  }

  public getCurrentBlockRate(): number {
    if (this.blockOutcomes.length === 0) return 0;
    const blockedCount = this.blockOutcomes.filter(Boolean).length;
    return (blockedCount / this.blockOutcomes.length) * 100;
  }

  public getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitState;
  }

  public resetCircuitBreaker(): void {
    this.circuitState = 'CLOSED';
    this.blockOutcomes = [];
  }

  /**
   * Deterministically slots nightly scheduled scans across configured UTC window
   * (e.g. 00:00 - 06:00 UTC) using a SHA-256 hash of workspaceId and scanId.
   */
  public computeScheduledSlot(
    workspaceId: string,
    scanId: string,
    customStartHour?: number,
    customEndHour?: number
  ): {
    scheduledMinuteOffset: number;
    scheduledTimeUtc: string;
    startHourUtc: number;
    endHourUtc: number;
  } {
    const startHour = customStartHour !== undefined
      ? customStartHour
      : parseInt(process.env.SCRAPER_SLOT_WINDOW_START_HOUR_UTC || '0', 10);
    const endHour = customEndHour !== undefined
      ? customEndHour
      : parseInt(process.env.SCRAPER_SLOT_WINDOW_END_HOUR_UTC || '6', 10);

    const totalWindowMinutes = (endHour - startHour) * 60; // e.g. 360 minutes
    const hash = crypto.createHash('sha256').update(`${workspaceId}:${scanId}`).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);

    const minuteOffset = hashInt % totalWindowMinutes;
    const slotHour = startHour + Math.floor(minuteOffset / 60);
    const slotMinute = minuteOffset % 60;

    const formattedTime = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')} UTC`;

    return {
      scheduledMinuteOffset: minuteOffset,
      scheduledTimeUtc: formattedTime,
      startHourUtc: startHour,
      endHourUtc: endHour,
    };
  }
}

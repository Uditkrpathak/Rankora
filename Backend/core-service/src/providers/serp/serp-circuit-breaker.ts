import { redisClient } from '../../config/redis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThresholdPercentage: number; // e.g. 20 (meaning 20%)
  windowSeconds: number; // e.g. 60
  minRequests: number; // e.g. 5
  halfOpenTimeoutSeconds: number; // e.g. 30
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThresholdPercentage: 50,
  windowSeconds: 60,
  minRequests: 10,
  halfOpenTimeoutSeconds: 5,
};

export class SerpCircuitBreaker {
  private memoryState = new Map<
    string,
    {
      state: CircuitState;
      total: number;
      failures: number;
      lastOpenedAt: number;
      expiresAt: number;
      reason?: string;
    }
  >();

  constructor(private config: CircuitBreakerConfig = DEFAULT_CONFIG) {}

  public async canExecute(providerName: string): Promise<boolean> {
    const key = `serp:breaker:${providerName.toLowerCase()}`;
    const now = Date.now();

    if (redisClient.status === 'ready') {
      try {
        const stateStr = await redisClient.get(`${key}:state`);
        if (!stateStr || stateStr === 'CLOSED') return true;

        if (stateStr === 'OPEN') {
          const openedAtStr = await redisClient.get(`${key}:opened_at`);
          const openedAt = openedAtStr ? parseInt(openedAtStr, 10) : now;
          if (now - openedAt > this.config.halfOpenTimeoutSeconds * 1000) {
            await redisClient.set(`${key}:state`, 'HALF_OPEN', 'EX', 60);
            return true;
          }
          return false;
        }

        if (stateStr === 'HALF_OPEN') {
          return true;
        }
      } catch (e) {
        // fall back to memory
      }
    }

    // Memory fallback
    const item = this.memoryState.get(providerName.toLowerCase());
    if (!item || item.state === 'CLOSED') return true;

    if (item.state === 'OPEN') {
      if (now - item.lastOpenedAt > this.config.halfOpenTimeoutSeconds * 1000) {
        item.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    return true;
  }

  public async recordSuccess(providerName: string): Promise<void> {
    const name = providerName.toLowerCase();
    const key = `serp:breaker:${name}`;

    if (redisClient.status === 'ready') {
      try {
        const state = await redisClient.get(`${key}:state`);
        if (state === 'HALF_OPEN') {
          await redisClient.set(`${key}:state`, 'CLOSED');
          await redisClient.del(`${key}:failures`);
          await redisClient.del(`${key}:total`);
        } else {
          await redisClient.incr(`${key}:total`);
          await redisClient.expire(`${key}:total`, this.config.windowSeconds);
        }
        return;
      } catch (e) {}
    }

    // Memory fallback
    let item = this.memoryState.get(name);
    if (!item || item.expiresAt < Date.now()) {
      item = {
        state: 'CLOSED',
        total: 0,
        failures: 0,
        lastOpenedAt: 0,
        expiresAt: Date.now() + this.config.windowSeconds * 1000,
      };
      this.memoryState.set(name, item);
    }
    if (item.state === 'HALF_OPEN') {
      item.state = 'CLOSED';
      item.total = 0;
      item.failures = 0;
    } else {
      item.total++;
    }
  }

  public async recordFailure(providerName: string): Promise<void> {
    const name = providerName.toLowerCase();
    const key = `serp:breaker:${name}`;
    const now = Date.now();

    if (redisClient.status === 'ready') {
      try {
        const total = (await redisClient.incr(`${key}:total`)) || 1;
        const failures = (await redisClient.incr(`${key}:failures`)) || 1;
        await redisClient.expire(`${key}:total`, this.config.windowSeconds);
        await redisClient.expire(`${key}:failures`, this.config.windowSeconds);

        const rate = (failures / total) * 100;
        if (total >= this.config.minRequests && rate >= this.config.failureThresholdPercentage) {
          await redisClient.set(`${key}:state`, 'OPEN', 'EX', this.config.halfOpenTimeoutSeconds * 2);
          await redisClient.set(`${key}:opened_at`, now.toString(), 'EX', this.config.halfOpenTimeoutSeconds * 2);
        }
        return;
      } catch (e) {}
    }

    // Memory fallback
    let item = this.memoryState.get(name);
    if (!item || item.expiresAt < now) {
      item = {
        state: 'CLOSED',
        total: 0,
        failures: 0,
        lastOpenedAt: 0,
        expiresAt: now + this.config.windowSeconds * 1000,
      };
      this.memoryState.set(name, item);
    }
    item.total++;
    item.failures++;
    const rate = (item.failures / item.total) * 100;
    if (item.total >= this.config.minRequests && rate >= this.config.failureThresholdPercentage) {
      item.state = 'OPEN';
      item.lastOpenedAt = now;
    }
  }

  public async tripImmediately(providerName: string, reason: string, durationSeconds = 300): Promise<boolean> {
    const name = providerName.toLowerCase();
    const key = `serp:breaker:${name}`;
    const now = Date.now();

    if (redisClient.status === 'ready') {
      try {
        const currentState = await redisClient.get(`${key}:state`);
        const wasAlreadyOpen = currentState === 'OPEN';

        await redisClient.set(`${key}:state`, 'OPEN', 'EX', durationSeconds);
        await redisClient.set(`${key}:opened_at`, now.toString(), 'EX', durationSeconds);
        await redisClient.set(`${key}:reason`, reason, 'EX', durationSeconds);
        return !wasAlreadyOpen;
      } catch (e) {}
    }

    let item = this.memoryState.get(name);
    const wasAlreadyOpen = Boolean(item && item.state === 'OPEN' && item.expiresAt > now);

    if (!item) {
      item = {
        state: 'OPEN',
        total: 1,
        failures: 1,
        lastOpenedAt: now,
        expiresAt: now + durationSeconds * 1000,
        reason,
      };
    } else {
      item.state = 'OPEN';
      item.lastOpenedAt = now;
      item.expiresAt = now + durationSeconds * 1000;
      item.reason = reason;
    }
    this.memoryState.set(name, item);
    return !wasAlreadyOpen;
  }

  public async getFailureReason(providerName: string): Promise<string | null> {
    const name = providerName.toLowerCase();
    const key = `serp:breaker:${name}`;
    if (redisClient.status === 'ready') {
      try {
        const reason = await redisClient.get(`${key}:reason`);
        if (reason) return reason;
      } catch (e) {}
    }
    return this.memoryState.get(name)?.reason || null;
  }

  public async getState(providerName: string): Promise<CircuitState> {
    const name = providerName.toLowerCase();
    const key = `serp:breaker:${name}`;
    if (redisClient.status === 'ready') {
      try {
        const s = await redisClient.get(`${key}:state`);
        if (s === 'OPEN' || s === 'HALF_OPEN' || s === 'CLOSED') return s;
      } catch (e) {}
    }
    return this.memoryState.get(name)?.state || 'CLOSED';
  }

  public async reset(providerName: string): Promise<void> {
    const name = providerName.toLowerCase();
    const key = `serp:breaker:${name}`;
    if (redisClient.status === 'ready') {
      try {
        await redisClient.del(`${key}:state`);
        await redisClient.del(`${key}:failures`);
        await redisClient.del(`${key}:total`);
        await redisClient.del(`${key}:opened_at`);
        await redisClient.del(`${key}:reason`);
      } catch (e) {}
    }
    this.memoryState.delete(name);
  }

  public async resetAll(): Promise<void> {
    if (redisClient.status === 'ready') {
      try {
        const keys = await redisClient.keys('serp:breaker:*');
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (e) {}
    }
    await this.reset('GOOGLE_MAPS_HTTP');
    await this.reset('MOCK');
    this.memoryState.clear();
  }
}

export const serpCircuitBreaker = new SerpCircuitBreaker();


import { redisClient } from '../../config/redis';
import { ENV } from '../../config/env';
import { SERP_PROVIDER_COST_USD } from './serp.types';

export interface PlatformSpendSummary {
  todaySpendUsd: number;
  totalPlatformSpendUsd: number;
  dailyBudgetUsd: number;
  isWithinBudget: boolean;
}

export class SerpBudgetGuard {
  private memoryDailySpend = new Map<string, number>();
  private memoryPlatformTotal = 0;

  private static readonly MICRO_USD = 1_000_000;
  private static readonly SPEND_TTL_SECONDS = 172_800; // 48h
  private static readonly PLATFORM_TOTAL_KEY = 'serp:spend:platform:total';
  private static readonly RESERVE_SCRIPT = `
    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
    local cost = tonumber(ARGV[1])
    local budget = tonumber(ARGV[2])
    if current + cost > budget then
      return {0, current}
    end
    local updated = current + cost
    redis.call('SET', KEYS[1], updated, 'EX', ARGV[3])
    return {1, updated}
  `;

  private getTodayKey(): string {
    const d = new Date();
    return `serp:spend:v2:${d.toISOString().slice(0, 10)}`;
  }

  private toMicroUsd(usd: number): number {
    return Math.round(usd * SerpBudgetGuard.MICRO_USD);
  }

  public async getDailySpend(): Promise<number> {
    const key = this.getTodayKey();
    if (redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(key);
        return val ? parseInt(val, 10) / SerpBudgetGuard.MICRO_USD : 0;
      } catch (e) {}
    }
    if (ENV.REQUIRE_REDIS) {
      throw new Error('SERP spend tracking requires an available Redis connection.');
    }
    return this.memoryDailySpend.get(key) || 0;
  }

  public async getTotalPlatformSpend(): Promise<number> {
    if (redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(SerpBudgetGuard.PLATFORM_TOTAL_KEY);
        return val ? parseInt(val, 10) / SerpBudgetGuard.MICRO_USD : 0;
      } catch (e) {}
    }
    return this.memoryPlatformTotal;
  }

  public async recordActualLiveCost(providerName: string, actualCostUsd: number): Promise<void> {
    const microUsd = this.toMicroUsd(actualCostUsd);
    if (redisClient.status === 'ready') {
      try {
        await redisClient.incrby(SerpBudgetGuard.PLATFORM_TOTAL_KEY, microUsd);
        return;
      } catch (e) {}
    }
    this.memoryPlatformTotal += actualCostUsd;
  }

  public async isWithinBudget(): Promise<boolean> {
    const currentSpend = await this.getDailySpend();
    return currentSpend < ENV.SERP_DAILY_BUDGET_USD;
  }

  public async recordProviderCall(providerName: string): Promise<number> {
    const reservation = await this.reserveProviderCall(providerName);
    return reservation.dailySpendUsd;
  }

  /** Atomically reserve the estimated call cost before hitting a paid provider. */
  public async reserveProviderCall(
    providerName: string
  ): Promise<{ reserved: boolean; dailySpendUsd: number }> {
    const costMicroUsd = this.toMicroUsd(
      SERP_PROVIDER_COST_USD[providerName.toUpperCase()] ?? 0.002
    );
    const budgetMicroUsd = this.toMicroUsd(ENV.SERP_DAILY_BUDGET_USD);
    const key = this.getTodayKey();

    if (redisClient.status === 'ready') {
      try {
        const result = (await redisClient.eval(
          SerpBudgetGuard.RESERVE_SCRIPT,
          1,
          key,
          costMicroUsd,
          budgetMicroUsd,
          SerpBudgetGuard.SPEND_TTL_SECONDS
        )) as [number | string, number | string];

        const isReserved = Number(result[0]) === 1;
        const dailySpendUsd = Number(result[1]) / SerpBudgetGuard.MICRO_USD;

        if (isReserved) {
          // Increment platform-level lifetime tracker
          await redisClient.incrby(SerpBudgetGuard.PLATFORM_TOTAL_KEY, costMicroUsd).catch(() => {});
        }

        return {
          reserved: isReserved,
          dailySpendUsd,
        };
      } catch (error) {
        if (ENV.REQUIRE_REDIS) {
          throw new Error('SERP spend reservation failed; refusing an unmetered provider request.', { cause: error });
        }
      }
    } else if (ENV.REQUIRE_REDIS) {
      throw new Error('SERP spend reservation requires an available Redis connection.');
    }

    // Development-only fallback. Production is configured to require Redis,
    // since process-local counters cannot coordinate concurrent workers.
    const currentMicroUsd = this.toMicroUsd(this.memoryDailySpend.get(key) || 0);
    const updatedMicroUsd = currentMicroUsd + costMicroUsd;
    if (updatedMicroUsd > budgetMicroUsd) {
      return { reserved: false, dailySpendUsd: currentMicroUsd / SerpBudgetGuard.MICRO_USD };
    }
    const updatedUsd = updatedMicroUsd / SerpBudgetGuard.MICRO_USD;
    this.memoryDailySpend.set(key, updatedUsd);
    this.memoryPlatformTotal += costMicroUsd / SerpBudgetGuard.MICRO_USD;
    return { reserved: true, dailySpendUsd: updatedUsd };
  }

  public async getSpendSummary(): Promise<PlatformSpendSummary> {
    const todaySpendUsd = await this.getDailySpend();
    const totalPlatformSpendUsd = await this.getTotalPlatformSpend();
    return {
      todaySpendUsd,
      totalPlatformSpendUsd,
      dailyBudgetUsd: ENV.SERP_DAILY_BUDGET_USD,
      isWithinBudget: todaySpendUsd < ENV.SERP_DAILY_BUDGET_USD,
    };
  }

  public async resetTodaySpend(): Promise<void> {
    const key = this.getTodayKey();
    if (redisClient.status === 'ready') {
      try {
        await redisClient.del(key);
      } catch (e) {}
    }
    this.memoryDailySpend.delete(key);
  }
}

export const serpBudgetGuard = new SerpBudgetGuard();

import { redisClient, memoryFallback } from '../../config/redis';
import { ENV } from '../../config/env';
import { serpCircuitBreaker } from './serp-circuit-breaker';

export interface ProviderBalanceInfo {
  provider: string;
  balanceUsd: number;
  searchesRemaining?: number;
  currency: string;
  fetchedAt: Date;
  isMock?: boolean;
}

export type AlertTier = 'NONE' | 'WARNING' | 'CRITICAL' | 'DEPLETED';

export interface BalanceAlert {
  provider: string;
  tier: AlertTier;
  balanceUsd: number;
  message: string;
  timestamp: Date;
}

export class SerpBalanceService {
  private memoryBalances = new Map<string, ProviderBalanceInfo>();
  private memoryAlertTiers = new Map<string, AlertTier>();
  private pollingTimer: NodeJS.Timeout | null = null;

  // Thresholds for tiered alerts
  public static readonly WARNING_THRESHOLD_USD = 20.0;
  public static readonly CRITICAL_THRESHOLD_USD = 5.0;
  public static readonly DEPLETED_THRESHOLD_USD = 0.01;
  public static readonly TOPUP_DETECTION_DELTA_USD = 5.0;

  public setCachedBalance(info: ProviderBalanceInfo): void {
    const provider = info.provider.toUpperCase();
    this.memoryBalances.set(provider, info);
    if (redisClient && redisClient.status === 'ready') {
      const key = `serp:balance:${provider.toLowerCase()}`;
      redisClient.set(key, JSON.stringify(info), 'EX', 3600).catch(() => {});
    }
  }

  /**
   * Fetches the live balance from the specified provider API.
   * Fail-open: if the endpoint is down or unreachable, returns null and logs warning.
   */
  public async fetchLiveProviderBalance(providerName: string): Promise<ProviderBalanceInfo | null> {
    const provider = providerName.toUpperCase();

    if (provider.startsWith('MOCK')) {
      return {
        provider,
        balanceUsd: 100.0,
        currency: 'USD',
        fetchedAt: new Date(),
        isMock: true,
      };
    }

    return null;
  }

  /**
   * Polls and persists balance info into Redis with TTL and evaluates alert tiers / top-ups.
   */
  public async pollAndCacheBalance(providerName: string): Promise<ProviderBalanceInfo | null> {
    const provider = providerName.toUpperCase();
    const live = await this.fetchLiveProviderBalance(provider);
    if (!live) {
      // Fail open: return current cached balance if any
      return await this.getCachedBalance(provider);
    }

    const previous = await this.getCachedBalance(provider);
    this.setCachedBalance(live);

    // Evaluate Top-up & Circuit Breaker Reset
    if (previous && live.balanceUsd >= previous.balanceUsd + SerpBalanceService.TOPUP_DETECTION_DELTA_USD) {
      console.log(`🎉 [SERP Balance] Top-up detected for ${provider} (+$${(live.balanceUsd - previous.balanceUsd).toFixed(2)}). Re-arming alerts.`);
      await this.rearmAlerts(provider);

      // Auto-reset or set circuit breaker to HALF_OPEN/CLOSED if tripped due to billing
      const reason = await serpCircuitBreaker.getFailureReason(provider);
      if (reason === 'PROVIDER_BILLING_ERROR') {
        console.log(`⚡ [SERP Balance] Resetting circuit breaker for ${provider} after top-up.`);
        await serpCircuitBreaker.reset(provider);
      }
    }

    // Evaluate Alert Tiers
    await this.evaluateAlertTiers(live);

    return live;
  }

  public async getCachedBalance(providerName: string): Promise<ProviderBalanceInfo | null> {
    const provider = providerName.toUpperCase();
    const key = `serp:balance:${provider.toLowerCase()}`;

    if (redisClient && redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(key);
        if (val) {
          const parsed = JSON.parse(val);
          return {
            ...parsed,
            fetchedAt: new Date(parsed.fetchedAt),
          };
        }
      } catch {}
    }
    return this.memoryBalances.get(provider) || null;
  }

  /**
   * Computes rolling burn rate ($/hr) from SerpSnapshot recorded costUsd over lookback window.
   */
  public async computeBurnRateUsdPerHour(lookbackHours: number = 24): Promise<number> {
    try {
      const { SerpSnapshot } = await import('../../models/SerpSnapshot');
      const since = new Date(Date.now() - lookbackHours * 3600 * 1000);
      const result = await SerpSnapshot.aggregate([
        { $match: { fetchedAt: { $gte: since } } },
        { $group: { _id: null, totalCost: { $sum: '$costUsd' } } },
      ]);
      const totalCost = result?.[0]?.totalCost || 0;
      return Number((totalCost / Math.max(1, lookbackHours)).toFixed(4));
    } catch (err) {
      console.warn('[SERP Balance] Error computing burn rate:', err);
      return 0;
    }
  }

  /**
   * Evaluates tiered alerts without duplicate spamming (deduped per tier).
   * Alert tiers are runway-based with absolute floor:
   * - DEPLETED: balance <= $0.01
   * - CRITICAL: runway < 12h OR balance <= $5.00
   * - WARNING: runway < 48h OR balance <= $20.00
   */
  public async evaluateAlertTiers(
    info: ProviderBalanceInfo,
    customBurnRatePerHour?: number
  ): Promise<BalanceAlert | null> {
    this.setCachedBalance(info);
    const burnRate = customBurnRatePerHour ?? (await this.computeBurnRateUsdPerHour(7 * 24));
    const runwayHours = this.calculateRunwayHours(info.balanceUsd, burnRate);

    let currentTier: AlertTier = 'NONE';

    if (info.balanceUsd <= SerpBalanceService.DEPLETED_THRESHOLD_USD) {
      currentTier = 'DEPLETED';
    } else if (
      info.balanceUsd <= SerpBalanceService.CRITICAL_THRESHOLD_USD ||
      runwayHours < 12
    ) {
      currentTier = 'CRITICAL';
    } else if (
      info.balanceUsd <= SerpBalanceService.WARNING_THRESHOLD_USD ||
      runwayHours < 48
    ) {
      currentTier = 'WARNING';
    }

    const provider = info.provider.toUpperCase();
    const alertKey = `serp:balance:alerted_tier:${provider.toLowerCase()}`;

    let lastAlertedTier: AlertTier = 'NONE';
    if (redisClient && redisClient.status === 'ready') {
      try {
        lastAlertedTier = ((await redisClient.get(alertKey)) as AlertTier) || 'NONE';
      } catch {}
    } else {
      lastAlertedTier = this.memoryAlertTiers.get(provider) || 'NONE';
    }

    if (currentTier !== 'NONE' && currentTier !== lastAlertedTier) {
      // Record new tier in Redis
      if (redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.set(alertKey, currentTier, 'EX', 86400);
        } catch {}
      }
      this.memoryAlertTiers.set(provider, currentTier);

      const alert: BalanceAlert = {
        provider,
        tier: currentTier,
        balanceUsd: info.balanceUsd,
        message: `[${currentTier}] ${provider} SERP balance is $${info.balanceUsd.toFixed(2)} (estimated runway: ${runwayHours > 900 ? 'inf' : `${runwayHours}h`} at $${burnRate.toFixed(3)}/hr).`,
        timestamp: new Date(),
      };
      console.warn(`🚨 [SERP Balance Alert] ${alert.message}`);
      return alert;
    }

    return null;
  }

  public async rearmAlerts(providerName: string): Promise<void> {
    const provider = providerName.toUpperCase();
    const alertKey = `serp:balance:alerted_tier:${provider.toLowerCase()}`;
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.del(alertKey);
      } catch {}
    }
    this.memoryAlertTiers.delete(provider);
  }

  /**
   * Checks if the provider balance can cover an estimated scan cost.
   * If balance is insufficient:
   * - For scheduled scans: pauses/defers them first.
   * - For on-demand scans: throws/returns PROVIDER_CAPACITY_UNAVAILABLE (HTTP 503).
   */
  public async canCoverEstimatedCost(
    providerName: string,
    estimatedCostUsd: number,
    isScheduled: boolean = false
  ): Promise<{ available: boolean; balanceUsd: number; reason?: string }> {
    const balanceInfo = await this.getCachedBalance(providerName);

    // Fail open if no balance information could be fetched
    if (!balanceInfo) {
      return { available: true, balanceUsd: 999.0 };
    }

    if (balanceInfo.balanceUsd < estimatedCostUsd) {
      const reason = isScheduled
        ? 'PAUSED_SCHEDULED_SCAN_LOW_BALANCE'
        : 'PROVIDER_CAPACITY_UNAVAILABLE';
      return {
        available: false,
        balanceUsd: balanceInfo.balanceUsd,
        reason,
      };
    }

    return {
      available: true,
      balanceUsd: balanceInfo.balanceUsd,
    };
  }

  /**
   * Computes estimated runway hours based on recorded burn rate.
   */
  public calculateRunwayHours(balanceUsd: number, burnRateUsdPerHour: number): number {
    if (burnRateUsdPerHour <= 0) return 999;
    return Number((balanceUsd / burnRateUsdPerHour).toFixed(1));
  }

  public startPeriodicPolling(intervalMinutes: number = 30): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    const intervalMs = Math.max(15, Math.min(60, intervalMinutes)) * 60 * 1000;

    this.pollingTimer = setInterval(async () => {
      // In-house HTTP scraper uses proxy bandwidth; no 3rd-party balance to poll
    }, intervalMs);
  }

  public stopPeriodicPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

export const serpBalanceService = new SerpBalanceService();

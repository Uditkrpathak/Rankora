import { ENV } from '../config/env';
import { dailySpendUsd, dailyBudgetUtilizationRatio } from './metrics';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface CostAlert {
  id: string;
  type: 'BUDGET_THRESHOLD' | 'RESIDENTIAL_SHARE' | 'PROXY_FLEET_DEGRADATION' | 'DLQ_SPIKE';
  severity: AlertSeverity;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
}

export type AlertNotificationHandler = (alert: CostAlert) => Promise<void> | void;

export class CostAlertService {
  private static alerts: CostAlert[] = [];
  private static notificationHandlers: AlertNotificationHandler[] = [];
  private static lastAlertTimestamps: Map<string, number> = new Map();
  private static cooldownMs = 15 * 60 * 1000; // 15-minute alert cooldown

  /**
   * Registers an external alert notification handler (e.g., Slack, webhook, email).
   */
  public static registerHandler(handler: AlertNotificationHandler): void {
    this.notificationHandlers.push(handler);
  }

  /**
   * Evaluates current day spend against daily budget limits.
   */
  public static evaluateDailySpend(
    currentSpendUsd: number,
    budgetLimitUsd: number = ENV.SERP_DAILY_BUDGET_USD
  ): CostAlert | null {
    const utilization = budgetLimitUsd > 0 ? currentSpendUsd / budgetLimitUsd : 0;
    dailyBudgetUtilizationRatio.set(utilization);
    dailySpendUsd.set({ tier: 'all' }, currentSpendUsd);

    if (utilization >= 1.0) {
      return this.triggerAlert({
        type: 'BUDGET_THRESHOLD',
        severity: 'CRITICAL',
        message: `🚨 CRITICAL: Daily SERP spend ($${currentSpendUsd.toFixed(2)}) has reached 100% of the $${budgetLimitUsd.toFixed(2)} budget limit.`,
        currentValue: currentSpendUsd,
        threshold: budgetLimitUsd,
      });
    }

    if (utilization >= 0.8) {
      return this.triggerAlert({
        type: 'BUDGET_THRESHOLD',
        severity: 'WARNING',
        message: `⚠️ WARNING: Daily SERP spend ($${currentSpendUsd.toFixed(2)}) has reached ${(utilization * 100).toFixed(1)}% of the $${budgetLimitUsd.toFixed(2)} budget.`,
        currentValue: currentSpendUsd,
        threshold: budgetLimitUsd * 0.8,
      });
    }

    return null;
  }

  /**
   * Evaluates residential proxy usage share against the maximum allowable percentage (30%).
   */
  public static evaluateResidentialShare(
    residentialBytes: number,
    totalBytes: number,
    maxShareRatio = 0.3
  ): CostAlert | null {
    if (totalBytes <= 0) return null;
    const shareRatio = residentialBytes / totalBytes;

    if (shareRatio > maxShareRatio) {
      return this.triggerAlert({
        type: 'RESIDENTIAL_SHARE',
        severity: 'WARNING',
        message: `⚠️ WARNING: Residential egress share is at ${(shareRatio * 100).toFixed(1)}%, exceeding the ${(maxShareRatio * 100).toFixed(0)}% cost limit.`,
        currentValue: shareRatio,
        threshold: maxShareRatio,
      });
    }

    return null;
  }

  /**
   * Evaluates proxy fleet health and alerts if quarantine percentage exceeds 50%.
   */
  public static evaluateProxyFleetHealth(
    tier: string,
    quarantinedCount: number,
    totalCount: number
  ): CostAlert | null {
    if (totalCount <= 0) return null;
    const quarantineRatio = quarantinedCount / totalCount;

    if (quarantineRatio >= 0.5) {
      return this.triggerAlert({
        type: 'PROXY_FLEET_DEGRADATION',
        severity: 'CRITICAL',
        message: `🚨 CRITICAL: Tier '${tier}' has ${(quarantineRatio * 100).toFixed(0)}% (${quarantinedCount}/${totalCount}) gateways quarantined.`,
        currentValue: quarantineRatio,
        threshold: 0.5,
      });
    }

    return null;
  }

  /**
   * Triggers an alert, respecting cooldown intervals and notifying registered handlers.
   */
  private static triggerAlert(alertData: Omit<CostAlert, 'id' | 'timestamp'>): CostAlert | null {
    const alertKey = `${alertData.type}:${alertData.severity}`;
    const now = Date.now();
    const lastTriggered = this.lastAlertTimestamps.get(alertKey) || 0;

    if (now - lastTriggered < this.cooldownMs) {
      return null; // Suppressed by cooldown
    }

    const alert: CostAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    };

    this.lastAlertTimestamps.set(alertKey, now);
    this.alerts.push(alert);
    if (this.alerts.length > 200) {
      this.alerts.shift();
    }

    console.warn(`[CostAlertService] [${alert.severity}] ${alert.message}`);

    for (const handler of this.notificationHandlers) {
      try {
        handler(alert);
      } catch (err: any) {
        console.error('[CostAlertService] Handler error:', err.message);
      }
    }

    return alert;
  }

  /**
   * Retrieves recent alerts.
   */
  public static getRecentAlerts(limit = 50): CostAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clears alerts and cooldowns (used in testing).
   */
  public static reset(): void {
    this.alerts = [];
    this.lastAlertTimestamps.clear();
    this.notificationHandlers = [];
  }
}

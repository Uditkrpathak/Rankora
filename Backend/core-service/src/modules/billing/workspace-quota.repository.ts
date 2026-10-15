import { getAppPool } from '../../database/postgres/postgres.client';
import { logger } from '../../config/logger';

export interface WorkspaceQuotaRecord {
  workspaceId: string;
  monthlyPinLimit: number;
  pinsUsed: number;
  periodStart: Date;
  updatedAt: Date;
}

export interface PinConsumptionRecord {
  id: string;
  workspaceId: string;
  scanId: string;
  pins: number;
  gridSize: string;
  createdAt: Date;
}

export class WorkspaceQuotaRepository {
  /**
   * Atomically checks quota, resets if 30-day billing cycle expired,
   * increments pins_used, and creates a pin_consumptions record.
   * Throws 402 QUOTA_EXCEEDED if limit exceeded.
   */
  public static async consume(
    workspaceId: string,
    scanId: string,
    pins: number,
    gridSize: string
  ): Promise<{ pinsUsed: number; monthlyLimit: number; remaining: number }> {
    const pool = getAppPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock workspace quota row or create initial 500 pin quota
      let res = await client.query(
        `SELECT workspace_id, monthly_pin_limit, pins_used, period_start
         FROM workspace_quotas
         WHERE workspace_id = $1
         FOR UPDATE`,
        [workspaceId]
      );

      if (res.rows.length === 0) {
        await client.query(
          `INSERT INTO workspace_quotas (workspace_id, monthly_pin_limit, pins_used, period_start, updated_at)
           VALUES ($1, 500, 0, NOW(), NOW())
           ON CONFLICT (workspace_id) DO NOTHING`,
          [workspaceId]
        );

        res = await client.query(
          `SELECT workspace_id, monthly_pin_limit, pins_used, period_start
           FROM workspace_quotas
           WHERE workspace_id = $1
           FOR UPDATE`,
          [workspaceId]
        );
      }

      const row = res.rows[0];
      let pinsUsed = Number(row.pins_used) || 0;
      const monthlyLimit = Number(row.monthly_pin_limit) || 500;
      const periodStart = new Date(row.period_start);
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

      // 2. Period rollover check: if period_start is older than 30 days, reset pins_used
      if (Date.now() - periodStart.getTime() > THIRTY_DAYS_MS) {
        pinsUsed = 0;
        await client.query(
          `UPDATE workspace_quotas
           SET pins_used = 0, period_start = NOW(), updated_at = NOW()
           WHERE workspace_id = $1`,
          [workspaceId]
        );
      }

      // 3. Quota check
      if (pinsUsed + pins > monthlyLimit) {
        const err: any = new Error(
          `QUOTA_EXCEEDED: Requested scan requires ${pins} pins, but workspace only has ${Math.max(
            0,
            monthlyLimit - pinsUsed
          )} pins remaining (used: ${pinsUsed}/${monthlyLimit}).`
        );
        err.statusCode = 402;
        err.code = 'QUOTA_EXCEEDED';
        err.pinsUsed = pinsUsed;
        err.monthlyLimit = monthlyLimit;
        err.requiredPins = pins;
        throw err;
      }

      // 4. Update pins_used
      const updatedRes = await client.query(
        `UPDATE workspace_quotas
         SET pins_used = pins_used + $2, updated_at = NOW()
         WHERE workspace_id = $1
         RETURNING pins_used`,
        [workspaceId, pins]
      );
      const newPinsUsed = Number(updatedRes.rows[0]?.pins_used) || pinsUsed + pins;

      // 5. Insert pin consumption audit record
      await client.query(
        `INSERT INTO pin_consumptions (workspace_id, scan_id, pins, grid_size, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [workspaceId, scanId, pins, gridSize]
      );

      await client.query('COMMIT');

      logger.info(
        `[WorkspaceQuota] Consumed ${pins} pins for scan ${scanId} (workspace: ${workspaceId}, grid: ${gridSize}, total used: ${newPinsUsed}/${monthlyLimit})`
      );

      return {
        pinsUsed: newPinsUsed,
        monthlyLimit,
        remaining: Math.max(0, monthlyLimit - newPinsUsed),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Refunds pins back to workspace quota (e.g. on terminal scan failure in DLQ).
   */
  public static async refund(workspaceId: string, pins: number): Promise<number> {
    if (!pins || pins <= 0) return 0;
    const pool = getAppPool();
    try {
      const res = await pool.query(
        `UPDATE workspace_quotas
         SET pins_used = GREATEST(0, pins_used - $2), updated_at = NOW()
         WHERE workspace_id = $1
         RETURNING pins_used, monthly_pin_limit`,
        [workspaceId, pins]
      );

      const newPinsUsed = res.rows[0]?.pins_used ?? 0;
      logger.info(
        `[WorkspaceQuota] Refunded ${pins} pins to workspace ${workspaceId} (new pins_used: ${newPinsUsed})`
      );
      return newPinsUsed;
    } catch (err: any) {
      logger.error(`[WorkspaceQuota] Error refunding pins to workspace ${workspaceId}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Retrieves current quota for workspace.
   */
  public static async getQuota(workspaceId: string): Promise<WorkspaceQuotaRecord | null> {
    const pool = getAppPool();
    const res = await pool.query(
      `SELECT workspace_id, monthly_pin_limit, pins_used, period_start, updated_at
       FROM workspace_quotas
       WHERE workspace_id = $1`,
      [workspaceId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      workspaceId: row.workspace_id,
      monthlyPinLimit: Number(row.monthly_pin_limit),
      pinsUsed: Number(row.pins_used),
      periodStart: new Date(row.period_start),
      updatedAt: new Date(row.updated_at),
    };
  }
}
import { getAppPool } from './postgres.client';

export interface ScanRunRecord {
  id: string;
  workspaceId: string;
  locationId: string;
  idempotencyKey: string;
  keyword: string;
  status: string;
  gridSize: number;
  pointCount: number;
  radiusKm: number;
  centerLat: number;
  centerLng: number;
  metrics?: any;
  gridSpec?: any;
  costUsd?: number;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ScanRunsRepository {
  /**
   * Upserts a scan run record into the PostgreSQL scan_runs table.
   */
  public static async upsertScanRun(scan: ScanRunRecord): Promise<void> {
    const pool = getAppPool();
    const sql = `
      INSERT INTO scan_runs (
        id,
        workspace_id,
        location_id,
        idempotency_key,
        keyword,
        status,
        grid_size,
        point_count,
        radius_km,
        center_lat,
        center_lng,
        metrics,
        grid_spec,
        cost_usd,
        error,
        started_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        metrics = EXCLUDED.metrics,
        grid_spec = EXCLUDED.grid_spec,
        cost_usd = EXCLUDED.cost_usd,
        error = EXCLUDED.error,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW();
    `;

    const createdAt = scan.createdAt ? new Date(scan.createdAt) : new Date();
    const updatedAt = scan.updatedAt ? new Date(scan.updatedAt) : new Date();

    await pool.query(sql, [
      scan.id,
      scan.workspaceId,
      scan.locationId,
      scan.idempotencyKey,
      scan.keyword,
      scan.status,
      scan.gridSize,
      scan.pointCount,
      scan.radiusKm,
      scan.centerLat,
      scan.centerLng,
      scan.metrics ? JSON.stringify(scan.metrics) : null,
      scan.gridSpec ? JSON.stringify(scan.gridSpec) : null,
      scan.costUsd ?? 0.0,
      scan.error ?? null,
      scan.startedAt ? new Date(scan.startedAt) : null,
      scan.completedAt ? new Date(scan.completedAt) : null,
      createdAt,
      updatedAt,
    ]);
  }

  /**
   * Fetches a scan run record by primary ID.
   */
  public static async getScanRun(id: string): Promise<ScanRunRecord | null> {
    const pool = getAppPool();
    const sql = `
      SELECT
        id,
        workspace_id AS "workspaceId",
        location_id AS "locationId",
        idempotency_key AS "idempotencyKey",
        keyword,
        status,
        grid_size AS "gridSize",
        point_count AS "pointCount",
        radius_km AS "radiusKm",
        center_lat AS "centerLat",
        center_lng AS "centerLng",
        metrics,
        grid_spec AS "gridSpec",
        cost_usd AS "costUsd",
        error,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM scan_runs
      WHERE id = $1;
    `;

    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Lists historical scan runs for a workspace and location.
   */
  public static async listScanRuns(
    workspaceId: string,
    locationId?: string,
    limit = 50
  ): Promise<ScanRunRecord[]> {
    const pool = getAppPool();
    const conditions = ['workspace_id = $1'];
    const params: any[] = [workspaceId];

    if (locationId) {
      conditions.push('location_id = $2');
      params.push(locationId);
    }

    params.push(limit);
    const limitIdx = params.length;

    const sql = `
      SELECT
        id,
        workspace_id AS "workspaceId",
        location_id AS "locationId",
        idempotency_key AS "idempotencyKey",
        keyword,
        status,
        grid_size AS "gridSize",
        point_count AS "pointCount",
        radius_km AS "radiusKm",
        center_lat AS "centerLat",
        center_lng AS "centerLng",
        metrics,
        grid_spec AS "gridSpec",
        cost_usd AS "costUsd",
        error,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM scan_runs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${limitIdx};
    `;

    const result = await pool.query(sql, params);
    return result.rows;
  }
}

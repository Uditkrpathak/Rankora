import crypto from 'crypto';
import { getAppPool } from './postgres.client';

export interface RankingHistoryRecord {
  idempotencyHash?: string;
  scanId: string;
  workspaceId: string;
  locationId: string;
  keyword: string;
  cellId: string;
  lat: number;
  lng: number;
  row: number;
  col: number;
  pinIndex?: number | null;
  rank?: number | null;
  targetRank?: number | null;
  isTarget: boolean;
  found: boolean;
  observationState?: 'OBSERVED' | 'CORRECTED' | 'ESTIMATED' | 'MISSING';
  items: any[];
  provider?: string | null;
  cached?: boolean;
  latencyMs?: number | null;
  error?: string | null;
  insertedAt?: Date;
  createdAt: Date;
}

export interface QueryHistoryOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class RankingHistoryRepository {
  /**
   * Generates a deterministic idempotency hash:
   * sha256(businessId + keyword + gridCoordinate + time-window bucket)
   */
  public static computeIdempotencyHash(
    businessIdOrScanId: string,
    keywordOrRow: string | number,
    gridCoordinateOrCol: string | number,
    timeWindowBucketOrCellId: string
  ): string {
    const isLegacy = typeof keywordOrRow === 'number';
    if (isLegacy) {
      return crypto
        .createHash('sha256')
        .update(`${businessIdOrScanId}:${keywordOrRow}:${gridCoordinateOrCol}:${timeWindowBucketOrCellId}`)
        .digest('hex');
    }
    const normalizedKw = String(keywordOrRow || '').toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto
      .createHash('sha256')
      .update(`${businessIdOrScanId}:${normalizedKw}:${gridCoordinateOrCol}:${timeWindowBucketOrCellId}`)
      .digest('hex');
  }

  /**
   * Inserts a batch of ranking grid observations into the partitioned PostgreSQL table.
   * Utilizes ON CONFLICT (idempotency_hash, created_at) DO NOTHING for idempotency.
   */
  public static async insertBatch(
    records: RankingHistoryRecord[],
    chunkSize = 250
  ): Promise<{ totalProcessed: number; insertedEstimated: number }> {
    if (!records || records.length === 0) {
      return { totalProcessed: 0, insertedEstimated: 0 };
    }

    const pool = getAppPool();
    let totalProcessed = 0;

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const valueTuples: string[] = [];
      const queryParams: any[] = [];
      let pIdx = 1;

      for (const rec of chunk) {
        const hash =
          rec.idempotencyHash ||
          this.computeIdempotencyHash(rec.scanId, rec.row, rec.col, rec.cellId);

        const createdAt = rec.createdAt instanceof Date ? rec.createdAt : new Date(rec.createdAt);
        const itemsJson = JSON.stringify(rec.items || []);

        valueTuples.push(
          `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11}, $${pIdx + 12}, $${pIdx + 13}, $${pIdx + 14}, $${pIdx + 15}, $${pIdx + 16}, $${pIdx + 17}, $${pIdx + 18}, $${pIdx + 19}, $${pIdx + 20})`
        );

        queryParams.push(
          hash,
          rec.scanId,
          rec.workspaceId,
          rec.locationId,
          rec.keyword,
          rec.cellId,
          rec.lat,
          rec.lng,
          rec.row,
          rec.col,
          rec.pinIndex ?? null,
          rec.rank ?? null,
          rec.targetRank ?? null,
          Boolean(rec.isTarget),
          Boolean(rec.found),
          rec.observationState || 'OBSERVED',
          itemsJson,
          rec.provider ?? null,
          Boolean(rec.cached),
          rec.latencyMs ?? null,
          createdAt
        );

        pIdx += 21;
      }

      const sql = `
        INSERT INTO ranking_history (
          idempotency_hash,
          scan_id,
          workspace_id,
          location_id,
          keyword,
          cell_id,
          lat,
          lng,
          row,
          col,
          pin_index,
          rank,
          target_rank,
          is_target,
          found,
          observation_state,
          items,
          provider,
          cached,
          latency_ms,
          created_at
        )
        VALUES ${valueTuples.join(', ')}
        ON CONFLICT (idempotency_hash, created_at) DO NOTHING;
      `;

      await pool.query(sql, queryParams);
      totalProcessed += chunk.length;
    }

    return { totalProcessed, insertedEstimated: totalProcessed };
  }

  /**
   * Retrieves ranking history for a specific workspace, location, and keyword.
   */
  public static async queryHistoryByLocation(
    workspaceId: string,
    locationId: string,
    keyword: string,
    options: QueryHistoryOptions = {}
  ): Promise<RankingHistoryRecord[]> {
    const pool = getAppPool();
    const conditions: string[] = ['workspace_id = $1', 'location_id = $2', 'keyword = $3'];
    const params: any[] = [workspaceId, locationId, keyword];
    let pIdx = 4;

    if (options.startDate) {
      conditions.push(`created_at >= $${pIdx++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`created_at <= $${pIdx++}`);
      params.push(options.endDate);
    }

    const limit = options.limit || 500;
    params.push(limit);

    const sql = `
      SELECT
        idempotency_hash AS "idempotencyHash",
        scan_id AS "scanId",
        workspace_id AS "workspaceId",
        location_id AS "locationId",
        keyword,
        cell_id AS "cellId",
        lat,
        lng,
        row,
        col,
        pin_index AS "pinIndex",
        rank,
        target_rank AS "targetRank",
        is_target AS "isTarget",
        found,
        observation_state AS "observationState",
        items,
        provider,
        cached,
        latency_ms AS "latencyMs",
        error,
        inserted_at AS "insertedAt",
        created_at AS "createdAt"
      FROM ranking_history
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, row ASC, col ASC
      LIMIT $${pIdx};
    `;

    const result = await pool.query(sql, params);
    return result.rows;
  }

  /**
   * Retrieves all grid points for a given scan ID.
   */
  public static async getGridPointsForScan(scanId: string): Promise<RankingHistoryRecord[]> {
    const pool = getAppPool();
    const sql = `
      SELECT
        idempotency_hash AS "idempotencyHash",
        scan_id AS "scanId",
        workspace_id AS "workspaceId",
        location_id AS "locationId",
        keyword,
        cell_id AS "cellId",
        lat,
        lng,
        row,
        col,
        pin_index AS "pinIndex",
        rank,
        target_rank AS "targetRank",
        is_target AS "isTarget",
        found,
        observation_state AS "observationState",
        items,
        provider,
        cached,
        latency_ms AS "latencyMs",
        error,
        inserted_at AS "insertedAt",
        created_at AS "createdAt"
      FROM ranking_history
      WHERE scan_id = $1
      ORDER BY row ASC, col ASC;
    `;

    const result = await pool.query(sql, [scanId]);
    return result.rows;
  }
}

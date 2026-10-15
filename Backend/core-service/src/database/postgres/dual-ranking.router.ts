import { ENV } from '../../config/env';
import { Scan } from '../../models/Scan';
import { ScanRunsRepository } from './scan-runs.repository';
import { RankingHistoryRepository } from './ranking-history.repository';
import { postgresDualReadMismatchesTotal } from '../../monitoring/metrics';

export interface DualReadComparisonResult {
  scanId: string;
  source: 'mongo' | 'postgres' | 'dual';
  match: boolean;
  mongoPointCount: number;
  postgresPointCount: number;
  discrepancies?: string[];
}

export class DualRankingRouter {
  /**
   * Retrieves complete scan details (metadata + grid points) according to RANKING_READ_SOURCE.
   */
  public static async getScanDetails(
    scanId: string,
    workspaceId: string
  ): Promise<any> {
    const readSource = ENV.RANKING_READ_SOURCE;

    if (readSource === 'postgres') {
      try {
        const pgData = await this.readFromPostgres(scanId, workspaceId);
        if (pgData) return pgData;
      } catch (err: any) {
        console.warn(`[DualRankingRouter] Postgres read failed, falling back to Mongo: ${err.message}`);
      }
      return this.readFromMongo(scanId, workspaceId);
    }

    if (readSource === 'dual') {
      const mongoData = await this.readFromMongo(scanId, workspaceId);

      // Asynchronous Shadow Read & Comparison (non-blocking)
      this.performShadowComparison(scanId, workspaceId, mongoData).catch((err) => {
        console.warn(`[DualRankingRouter:ShadowCompare] Background comparison failed: ${err.message}`);
      });

      return mongoData;
    }

    // Default: 'mongo'
    return this.readFromMongo(scanId, workspaceId);
  }

  /**
   * Reads scan directly from MongoDB.
   */
  public static async readFromMongo(scanId: string, workspaceId: string): Promise<any> {
    const scan = await Scan.findOne({ _id: scanId, workspaceId }).lean();
    return scan;
  }

  /**
   * Reads scan and joins grid points from PostgreSQL.
   */
  public static async readFromPostgres(scanId: string, workspaceId: string): Promise<any | null> {
    const run = await ScanRunsRepository.getScanRun(scanId);
    if (!run || run.workspaceId !== workspaceId) {
      return null;
    }

    const gridPoints = await RankingHistoryRepository.getGridPointsForScan(scanId);

    return {
      _id: run.id,
      workspaceId: run.workspaceId,
      locationId: run.locationId,
      idempotencyKey: run.idempotencyKey,
      keyword: run.keyword,
      status: run.status,
      gridSize: run.gridSize,
      pointCount: run.pointCount,
      radiusKm: run.radiusKm,
      center: {
        lat: run.centerLat,
        lng: run.centerLng,
      },
      metrics: run.metrics,
      gridSpec: run.gridSpec,
      costTracking: {
        actualCostUsd: run.costUsd,
      },
      gridPoints: gridPoints.map((gp) => ({
        lat: gp.lat,
        lng: gp.lng,
        row: gp.row,
        col: gp.col,
        pinIndex: gp.pinIndex,
        rank: gp.rank,
        targetRank: gp.targetRank,
        isTarget: gp.isTarget,
        found: gp.found,
        observationState: gp.observationState,
        items: gp.items,
        provider: gp.provider,
        cached: gp.cached,
        latencyMs: gp.latencyMs,
        error: gp.error,
        scannedAt: gp.createdAt,
      })),
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  /**
   * Compares MongoDB record vs Postgres record and logs shadow audit telemetry.
   */
  public static async performShadowComparison(
    scanId: string,
    workspaceId: string,
    mongoDoc: any
  ): Promise<DualReadComparisonResult> {
    if (!mongoDoc) {
      return {
        scanId,
        source: 'dual',
        match: true,
        mongoPointCount: 0,
        postgresPointCount: 0,
      };
    }

    const pgData = await this.readFromPostgres(scanId, workspaceId);
    const mongoPoints = mongoDoc.gridPoints || [];
    const pgPoints = pgData?.gridPoints || [];

    const discrepancies: string[] = [];
    if (!pgData) {
      discrepancies.push('ScanRun missing in PostgreSQL');
    } else {
      if (mongoPoints.length !== pgPoints.length) {
        discrepancies.push(
          `Grid point count mismatch: Mongo=${mongoPoints.length} vs PG=${pgPoints.length}`
        );
      }
      if (mongoDoc.status !== pgData.status) {
        discrepancies.push(
          `Status mismatch: Mongo=${mongoDoc.status} vs PG=${pgData.status}`
        );
      }
    }

    const match = discrepancies.length === 0;

    if (!match) {
      console.warn(
        `[DualRankingRouter:ShadowMismatch] Scan ${scanId}: ${discrepancies.join('; ')}`
      );
      postgresDualReadMismatchesTotal.inc({ discrepancy_type: discrepancies[0].split(':')[0] });
    }

    return {
      scanId,
      source: 'dual',
      match,
      mongoPointCount: mongoPoints.length,
      postgresPointCount: pgPoints.length,
      discrepancies: match ? undefined : discrepancies,
    };
  }

  /**
   * Lists historical scan runs for a location from PostgreSQL or Mongo.
   */
  public static async getLocationScans(
    workspaceId: string,
    locationId: string,
    limit = 20
  ): Promise<any[]> {
    const readSource = ENV.RANKING_READ_SOURCE;

    if (readSource === 'postgres') {
      try {
        const pgRuns = await ScanRunsRepository.listScanRuns(workspaceId, locationId, limit);
        if (pgRuns && pgRuns.length > 0) {
          return pgRuns.map((r) => ({
            _id: r.id,
            workspaceId: r.workspaceId,
            locationId: r.locationId,
            idempotencyKey: r.idempotencyKey,
            keyword: r.keyword,
            status: r.status,
            gridSize: r.gridSize,
            pointCount: r.pointCount,
            radiusKm: r.radiusKm,
            center: { lat: r.centerLat, lng: r.centerLng },
            metrics: r.metrics,
            gridSpec: r.gridSpec,
            createdAt: r.createdAt,
            completedAt: r.completedAt,
          }));
        }
      } catch (err: any) {
        console.warn(`[DualRankingRouter] Postgres listScanRuns failed, fallback to Mongo: ${err.message}`);
      }
    }

    // Default Mongo query
    return Scan.find({ workspaceId, locationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-rawResponses')
      .lean();
  }
}

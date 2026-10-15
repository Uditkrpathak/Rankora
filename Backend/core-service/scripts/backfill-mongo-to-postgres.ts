import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { Scan } from '../src/models/Scan';
import { PostgresMigrationService } from '../src/database/postgres/migration.service';
import { PostgresPartitionManager } from '../src/database/postgres/partition-manager';
import { ScanRunsRepository, ScanRunRecord } from '../src/database/postgres/scan-runs.repository';
import {
  RankingHistoryRepository,
  RankingHistoryRecord,
} from '../src/database/postgres/ranking-history.repository';
import { closePostgresPools } from '../src/database/postgres/postgres.client';

export interface BackfillOptions {
  batchSize?: number;
  limit?: number;
  dryRun?: boolean;
  workspaceId?: string;
}

export interface BackfillSummary {
  mode: 'LIVE' | 'DRY_RUN';
  scansProcessed: number;
  gridPointsInserted: number;
  errors: number;
  durationMs: number;
}

export async function runMongoToPostgresBackfill(
  options: BackfillOptions = {}
): Promise<BackfillSummary> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 50;
  const dryRun = options.dryRun || false;
  let scansProcessed = 0;
  let gridPointsInserted = 0;
  let errors = 0;

  console.log(`[Backfill] Starting Mongo -> Postgres Backfill (DryRun: ${dryRun}, BatchSize: ${batchSize})...`);

  // Ensure DB connections and partitions ready
  if (!dryRun) {
    await PostgresMigrationService.runMigrations();
    await PostgresPartitionManager.ensureUpcomingPartitions(3);
  }

  const query: any = {};
  if (options.workspaceId) {
    query.workspaceId = options.workspaceId;
  }

  const totalMatchingScans = await Scan.countDocuments(query);
  console.log(`[Backfill] Found ${totalMatchingScans} matching scans in MongoDB.`);

  const cursor = Scan.find(query).sort({ createdAt: 1 }).cursor();
  let currentBatch: any[] = [];

  for await (const scan of cursor) {
    currentBatch.push(scan);

    if (currentBatch.length >= batchSize) {
      await processScanBatch(currentBatch);
      scansProcessed += currentBatch.length;
      currentBatch = [];
      console.log(`[Backfill] Progress: ${scansProcessed}/${totalMatchingScans} scans processed.`);

      if (options.limit && scansProcessed >= options.limit) {
        break;
      }
    }
  }

  if (currentBatch.length > 0 && (!options.limit || scansProcessed < options.limit)) {
    await processScanBatch(currentBatch);
    scansProcessed += currentBatch.length;
  }

  async function processScanBatch(batch: any[]) {
    for (const scan of batch) {
      try {
        if (dryRun) {
          gridPointsInserted += (scan.gridPoints || []).length;
          continue;
        }

        const scanId = scan._id.toString();
        const workspaceId = scan.workspaceId.toString();
        const locationId = scan.locationId.toString();
        const createdAt = scan.createdAt || new Date();

        const scanRun: ScanRunRecord = {
          id: scanId,
          workspaceId,
          locationId,
          idempotencyKey: scan.idempotencyKey || `${scanId}_legacy`,
          keyword: scan.keyword,
          status: scan.status || 'COMPLETED',
          gridSize: scan.gridSize || 3,
          pointCount: scan.pointCount || (scan.gridPoints || []).length || 9,
          radiusKm: scan.radiusKm || 5.0,
          centerLat: scan.center?.lat || 0,
          centerLng: scan.center?.lng || 0,
          metrics: scan.metrics || null,
          gridSpec: scan.gridSpec || null,
          costUsd: scan.costTracking?.actualCostUsd || 0.0,
          error: scan.error || null,
          startedAt: scan.startedAt || null,
          completedAt: scan.completedAt || null,
          createdAt,
          updatedAt: scan.updatedAt || new Date(),
        };

        await ScanRunsRepository.upsertScanRun(scanRun);

        const historyRecords: RankingHistoryRecord[] = (scan.gridPoints || []).map(
          (gp: any) => ({
            scanId,
            workspaceId,
            locationId,
            keyword: scan.keyword,
            cellId: gp.cellId || `cell_${gp.row}_${gp.col}`,
            lat: gp.lat,
            lng: gp.lng,
            row: gp.row,
            col: gp.col,
            pinIndex: gp.pinIndex,
            rank: gp.rank,
            targetRank: gp.targetRank,
            isTarget: Boolean(gp.isTarget),
            found: Boolean(gp.found),
            observationState: gp.observationState || 'OBSERVED',
            items: gp.items || [],
            provider: gp.provider || null,
            cached: Boolean(gp.cached),
            latencyMs: gp.latencyMs || null,
            error: gp.error || null,
            createdAt: gp.scannedAt || createdAt,
          })
        );

        if (historyRecords.length > 0) {
          const { totalProcessed } = await RankingHistoryRepository.insertBatch(historyRecords);
          gridPointsInserted += totalProcessed;
        }
      } catch (err: any) {
        errors++;
        console.error(`[Backfill] Error processing scan ${scan._id}:`, err.message);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const summary: BackfillSummary = {
    mode: dryRun ? 'DRY_RUN' : 'LIVE',
    scansProcessed,
    gridPointsInserted,
    errors,
    durationMs,
  };

  console.log(`[Backfill] Finished in ${durationMs}ms:`, summary);
  return summary;
}

// Direct CLI Execution
if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      const dryRun = process.argv.includes('--dry-run');
      await runMongoToPostgresBackfill({ dryRun });
    } catch (err) {
      console.error('[Backfill:Fatal]', err);
    } finally {
      await disconnectDatabase();
      await closePostgresPools();
      process.exit(0);
    }
  })();
}

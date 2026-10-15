import { Worker, Job } from 'bullmq';
import { redisConnection, redisClient, memoryFallback } from '../config/redis';
import {
  SCAN_ONDEMAND_QUEUE_NAME,
  SCAN_WEEKLY_QUEUE_NAME,
  SCAN_QUEUE_NAME,
  ScanJobPayload,
  getIstScrapeWindowStatus,
  decrementBackpressure,
} from './scan.queue';
import { moveToDeadLetterQueue } from './scan-dead-letter';
import { Scan, ScanDocument, refundScanCredit, reconcileScanSpend, sweepUnreconciledScans, IRawSERPRecord } from '../models/Scan';
import { Location } from '../models/Location';
import { TrackedKeyword } from '../models/TrackedKeyword';
import { Competitor } from '../models/Competitor';
import { GridGenerator } from '../modules/rankings/grid-generator';
import { H3SpatialService } from '../modules/rankings/h3-spatial.service';
import { MetricsCalculator } from '../modules/rankings/metrics-calculator';
import { TaskEngineService } from '../modules/rankings/task-engine.service';
import { serpManager } from '../providers/serp/serp.manager';
import { onScanCompleted, onScanFailed } from '../events/scan-completed.hook';
import { invalidateLocationChatCache } from '../modules/chat/chat.cache';
import { IGridPointResult, IRankItem, ObservationState, GridPinStatus } from '@localo/types';
import { logger } from '../config/logger';
import { matchBusiness } from '../modules/rankings/business-matcher';
import { ENV } from '../config/env';
import { ScanRunsRepository, ScanRunRecord } from '../database/postgres/scan-runs.repository';
import { RankingHistoryRepository, RankingHistoryRecord } from '../database/postgres/ranking-history.repository';
import { queueFailedJobs } from '../monitoring/metrics';

export function getCompetitorGroupingKey(item: { cid?: string; placeId?: string; name?: string; address?: string }): string {
  if (item.cid && item.cid.trim()) return `cid:${item.cid.trim().toLowerCase()}`;
  if (item.placeId && item.placeId.trim() && !item.placeId.startsWith('gm_')) return `pid:${item.placeId.trim()}`;
  const namePart = (item.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const addrPart = (item.address || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `name_addr:${namePart}::${addrPart}`;
}

let scanWorker: Worker<ScanJobPayload> | null = null;

async function persistScanToPostgres(
  scan: ScanDocument,
  finalStatus: string,
  finalError?: string
): Promise<void> {
  try {
    const scanId = scan._id.toString();
    const workspaceId = scan.workspaceId.toString();
    const locationId = scan.locationId.toString();
    const createdAt = scan.createdAt || new Date();

    const scanRun: ScanRunRecord = {
      id: scanId,
      workspaceId,
      locationId,
      idempotencyKey: scan.idempotencyKey,
      keyword: scan.keyword,
      status: finalStatus,
      gridSize: scan.gridSize || 3,
      pointCount: scan.pointCount || (scan.gridPoints || []).length || 9,
      radiusKm: scan.radiusKm || 5.0,
      centerLat: scan.center?.lat || 0,
      centerLng: scan.center?.lng || 0,
      metrics: scan.metrics || null,
      gridSpec: scan.gridSpec || null,
      costUsd: scan.costTracking?.actualCostUsd || 0.0,
      error: finalError || scan.error || null,
      startedAt: scan.startedAt || null,
      completedAt: scan.completedAt || new Date(),
      createdAt,
      updatedAt: new Date(),
    };

    await ScanRunsRepository.upsertScanRun(scanRun);

    const timeWindowBucket = (scan.gridSpec as any)?.windowTimestamp || (scan.createdAt || createdAt).toISOString().slice(0, 13);
    const historyRecords: RankingHistoryRecord[] = (scan.gridPoints || []).map((gp: any) => ({
      idempotencyHash: RankingHistoryRepository.computeIdempotencyHash(
        locationId,
        scan.keyword,
        `${gp.lat.toFixed(6)},${gp.lng.toFixed(6)}`,
        timeWindowBucket
      ),
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
    }));

    if (historyRecords.length > 0) {
      await RankingHistoryRepository.insertBatch(historyRecords);
    }
  } catch (pgErr: any) {
    console.warn(`[Scan Runner:PostgresDualWrite] Warning: ${pgErr.message}`);
  }
}

async function acquireScanLock(scanId: string, ttlSeconds = 300): Promise<boolean> {
  const lockKey = `lock:scan:${scanId}`;
  if (redisClient && redisClient.status === 'ready') {
    try {
      const res = await redisClient.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (e) {
      console.warn('[Scan Worker] Redis lock error, falling back to memory lock:', e);
    }
  }
  const now = Date.now();
  const current = memoryFallback.get(lockKey);
  if (current && current.exp > now) {
    return false;
  }
  memoryFallback.set(lockKey, { val: 'locked', exp: now + ttlSeconds * 1000 });
  return true;
}

async function releaseScanLock(scanId: string): Promise<void> {
  const lockKey = `lock:scan:${scanId}`;
  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.del(lockKey);
    } catch {}
  }
  memoryFallback.delete(lockKey);
}

export function isItemTarget(
  it: { placeId?: string; name: string; address?: string; phone?: string; website?: string; isTarget?: boolean; cid?: string; lat?: number; lng?: number },
  target: { placeId?: string | null; name: string; address?: string; phone?: string; website?: string; mapsCid?: string | null; lat?: number; lng?: number }
): boolean {
  return matchBusiness(
    {
      placeId: target.placeId,
      mapsCid: target.mapsCid,
      name: target.name,
      address: target.address,
      phone: target.phone,
      website: target.website,
      lat: target.lat,
      lng: target.lng,
    },
    it,
    { mode: 'search' }
  ).match;
}

export async function processScanExecution(
  scanId: string,
  workspaceId?: string,
  locationId?: string
): Promise<ScanDocument | null> {
  console.log(`🚀 [Scan Runner] Starting execution for Scan ${scanId}`);

  // 1. Acquire distributed lock to defend against duplicate concurrent worker processing
  // A 31-point provider run can exceed five minutes when requests are throttled.
  const lockAcquired = await acquireScanLock(scanId, 1800);
  if (!lockAcquired) {
    console.warn(`[Scan Worker] Scan ${scanId} is already actively executing in another worker/job. Skipping duplicate run.`);
    return null;
  }

  try {
    const scan = await Scan.findById(scanId);
    if (!scan) {
      console.warn(`[Scan Runner] Scan ${scanId} not found. Skipping.`);
      return null;
    }

    if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
      console.log(`[Scan Runner] Scan ${scanId} is already completed/failed with status: ${scan.status}.`);
      return scan;
    }

    const resolvedWorkspaceId = workspaceId || scan.workspaceId?.toString();
    const resolvedLocationId = locationId || scan.locationId?.toString();

    const location = await Location.findById(resolvedLocationId);
    if (!location) {
      const failedUpdate = await Scan.updateOne(
        { _id: scanId, status: { $in: ['QUEUED', 'RUNNING', 'PARTIAL'] } },
        { $set: { status: 'FAILED', error: 'Location not found' } }
      );
      if (failedUpdate.modifiedCount > 0) await refundScanCredit(scan._id, resolvedWorkspaceId!, scan.credits.required);
      return await Scan.findById(scanId);
    }

    const { isKnownFallbackCoordinate } = await import('../providers/places-autocomplete.provider');
    const coords = location.coordinates;
    const isMockFallback = location.coordinatesSource === 'MOCK_FALLBACK';
    const isInvalidCoords = !coords || (coords.lat === 0 && coords.lng === 0) || isKnownFallbackCoordinate(coords.lat, coords.lng);

    if (isMockFallback || isInvalidCoords) {
      const failedUpdate = await Scan.updateOne(
        { _id: scanId, status: { $in: ['QUEUED', 'RUNNING', 'PARTIAL'] } },
        {
          $set: {
            status: 'FAILED',
            error: `UNVERIFIED_LOCATION_COORDINATES: Location '${location.name}' has unverified fallback coordinates (${coords?.lat ?? 0}, ${coords?.lng ?? 0}). Please confirm business location coordinates on the map before running scans.`,
          },
        }
      );
      if (failedUpdate.modifiedCount > 0) await refundScanCredit(scan._id, resolvedWorkspaceId!, scan.credits.required);
      return await Scan.findById(scanId);
    }

    const started = await Scan.updateOne(
      { _id: scanId, status: { $in: ['QUEUED', 'RUNNING', 'PARTIAL'] } },
      { $set: { status: 'RUNNING', startedAt: scan.startedAt || new Date() } }
    );
    if (started.matchedCount === 0) return await Scan.findById(scanId);

    const centerSource = scan.gridSpec?.centerSource || 'BUSINESS';
    const isRadial = scan.scanShape === 'RINGS' || scan.scanShape === 'SUNFLOWER';
    const grid = isRadial
      ? GridGenerator.generateRadialGrid(scan.center.lat, scan.center.lng, scan.radiusKm, centerSource)
      : scan.scanShape === 'QUICK'
      ? GridGenerator.generateQuickGrid(scan.center.lat, scan.center.lng, scan.radiusKm, centerSource)
      : GridGenerator.generateGrid(scan.center.lat, scan.center.lng, scan.gridSize, scan.radiusKm);

    // 2. Checkpoint recovery: identify points already completed in a prior partial run
    const completedPointKeys = new Set(
      scan.gridPoints.map((p) => `${p.row},${p.col}`)
    );

    // Canonical H3 resolution determined ONCE per scan across all pins (Item 1 & 2)
    const canonicalH3 = H3SpatialService.resolveScanResolution(
      grid.coordinates.map((c) => ({ lat: c.lat, lng: c.lng })),
      scan.radiusKm,
      scan.scanShape
    );
    const seenCellIdsInScan = new Set<string>(
      scan.gridPoints.filter((p) => !p.isDuplicateCell && p.cellId).map((p) => p.cellId!)
    );

    let budgetHalted = false;
    const targetPlaceId = location.placeId;
    const pendingCoords = grid.coordinates.filter((coord) => !completedPointKeys.has(`${coord.row},${coord.col}`));
    const BATCH_SIZE = 8;

    for (let i = 0; i < pendingCoords.length; i += BATCH_SIZE) {
      const batch = pendingCoords.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (coord) => {
          if (budgetHalted) {
            return {
              pointResult: {
                lat: coord.lat,
                lng: coord.lng,
                row: coord.row,
                col: coord.col,
                targetRank: null,
                observationState: 'MISSING' as ObservationState,
                pinStatus: 'ERROR' as GridPinStatus,
                items: [],
                scannedAt: new Date(),
                error: 'SERP daily spend budget limit reached',
              },
              rawRecord: null,
            };
          }

          const MAX_PIN_RETRIES = 3;
          let pinAttempt = 0;
          let pinSuccess = false;
          let searchResponse: any = null;

          while (pinAttempt < MAX_PIN_RETRIES && !pinSuccess && !budgetHalted) {
            pinAttempt++;
            searchResponse = await serpManager.executeSearchWithTimeout({
              keyword: scan.keyword,
              lat: coord.lat,
              lng: coord.lng,
              radiusKm: scan.radiusKm,
              h3Resolution: canonicalH3.resolution,
              localization: scan.localization,
              targetPlaceId: location.placeId || undefined,
              targetName: location.name,
            });

            if (searchResponse.budgetExceeded) {
              budgetHalted = true;
              break;
            }

            const isPinTimeout = searchResponse.result?.error === 'POINT_TIMEOUT' || searchResponse.error === 'POINT_TIMEOUT';
            const isPinFailure = !searchResponse.result || Boolean(searchResponse.error);

            if (!isPinTimeout && !isPinFailure) {
              pinSuccess = true;
              break;
            }

            if (pinAttempt < MAX_PIN_RETRIES) {
              logger.warn(`[Scan Runner] Pin (${coord.row},${coord.col}) encountered technical failure (attempt ${pinAttempt}/${MAX_PIN_RETRIES}): ${searchResponse.error || 'Unknown error'}. Retrying with exponential backoff...`);
              await new Promise((resolve) => setTimeout(resolve, pinAttempt * 300));
            }
          }

          const { result, budgetExceeded, error: providerError } = searchResponse || {};

          if (result?.error === 'POINT_TIMEOUT' || providerError === 'POINT_TIMEOUT') {
            logger.warn({
              scanId,
              pinIndex: coord.pinIndex,
              keyword: scan.keyword,
            }, `[Scan Runner] Grid point (${coord.lat}, ${coord.lng}) timed out after ${MAX_PIN_RETRIES} attempts`);
            return {
              pointResult: {
                lat: coord.lat,
                lng: coord.lng,
                row: coord.row,
                col: coord.col,
                pinIndex: coord.pinIndex,
                targetRank: null,
                observationState: 'MISSING' as ObservationState,
                pinStatus: 'TIMEOUT' as GridPinStatus,
                items: [],
                scannedAt: new Date(),
                error: 'POINT_TIMEOUT',
              },
              rawRecord: null,
            };
          }

          logger.info(`[Scan Runner] Pin (${coord.row},${coord.col}) lat=${coord.lat} lng=${coord.lng} cacheHit=${Boolean(result?.cached)} itemsCount=${result?.items?.length ?? 0}`);

          if (budgetExceeded) {
            budgetHalted = true;
          }

          if (budgetExceeded || !result) {
            return {
              pointResult: {
                lat: coord.lat,
                lng: coord.lng,
                row: coord.row,
                col: coord.col,
                pinIndex: coord.pinIndex,
                targetRank: null,
                observationState: 'MISSING' as ObservationState,
                pinStatus: 'ERROR' as GridPinStatus,
                items: [],
                scannedAt: new Date(),
                error: budgetExceeded
                  ? 'SERP daily spend budget reached'
                  : providerError || 'SERP provider returned no ranked places.',
              },
              rawRecord: null,
            };
          }

          // Exact searched coordinates returned by serpManager (Item 2: remove worker re-snap)
          const searchedLat = typeof result.snappedLat === 'number' ? result.snappedLat : coord.lat;
          const searchedLng = typeof result.snappedLng === 'number' ? result.snappedLng : coord.lng;
          const cellId = result.cellId || '';
          const h3Resolution = result.h3Resolution || canonicalH3.resolution;
          const snapOffsetM = Math.round(
            GridGenerator.haversineDistanceKm(coord.lat, coord.lng, searchedLat, searchedLng) * 1000
          );

          // Duplicate cell detection at resolution cap (Item 1)
          let isDuplicateCell = false;
          if (cellId && canonicalH3.duplicateCellIds.has(cellId)) {
            if (seenCellIdsInScan.has(cellId)) {
              isDuplicateCell = true;
            } else {
              seenCellIdsInScan.add(cellId);
            }
          }

          let targetRank: number | null = null;
          let matchedCid: string | undefined;

          const normalizedItems: IRankItem[] = (result.items || []).map((it: any) => {
            const match = matchBusiness(
              {
                placeId: targetPlaceId,
                mapsCid: location.mapsCid || undefined,
                name: location.name,
                address: location.address,
                phone: location.phone,
                website: location.website,
                lat: location.placesCoordinates?.lat ?? location.coordinates?.lat ?? coord.lat,
                lng: location.placesCoordinates?.lng ?? location.coordinates?.lng ?? coord.lng,
              },
              it,
              { mode: 'search' }
            );

            const isTarget = match.match;
            if (isTarget && targetRank === null) {
              targetRank = it.rank;
              if (match.by === 'placeId' && it.cid) {
                matchedCid = it.cid;
              }
            }

            return {
              placeId: it.placeId,
              cid: it.cid,
              name: it.name,
              address: it.address,
              rating: it.rating,
              reviewsCount: it.reviewsCount,
              primaryCategory: it.primaryCategory,
              phone: it.phone,
              website: it.website,
              rank: it.rank,
              lat: it.lat,
              lng: it.lng,
              isTarget,
              matchedBy: match.by,
            };
          });

          // Persist discovered mapsCid on Location document upon placeId match (Item 8)
          if (matchedCid && !location.mapsCid) {
            location.mapsCid = matchedCid;
            Location.findByIdAndUpdate(location._id, { mapsCid: matchedCid }).catch((e) =>
              logger.warn({ err: e }, '[Scan Runner] Failed to persist discovered mapsCid on Location')
            );
          }

          const pinStatus = isDuplicateCell
            ? ('DUPLICATE' as GridPinStatus)
            : ((result.pinStatus || (result.items && result.items.length > 0 ? 'OK' : 'EMPTY')) as GridPinStatus);
          const observationState: ObservationState = isDuplicateCell
            ? 'MISSING'
            : (result.items && result.items.length > 0 ? 'OBSERVED' : 'OBSERVED');

          const pointResult: IGridPointResult = {
            lat: coord.lat,
            lng: coord.lng,
            row: coord.row,
            col: coord.col,
            pinIndex: coord.pinIndex,
            ring: coord.ring,
            ringIndex: coord.ringIndex,
            distanceKm: coord.distanceKm,
            bearingDeg: coord.bearingDeg ?? null,
            searchLat: searchedLat,
            searchLng: searchedLng,
            cellId,
            h3Resolution,
            snapOffsetM,
            targetRank: isDuplicateCell ? null : targetRank,
            observationState,
            pinStatus,
            isDuplicateCell,
            items: isDuplicateCell ? [] : normalizedItems,
            scannedAt: new Date(),
            provider: result.provider,
            cached: Boolean(result.cached),
            difficulty: MetricsCalculator.calculatePinDifficulty(normalizedItems),
          };

          const rawRecord: IRawSERPRecord = {
            provider: result.provider,
            providerRequestId: result.providerRequestId,
            parserVersion: result.parserVersion,
            gridPoint: { lat: coord.lat, lng: coord.lng, row: coord.row, col: coord.col },
            fetchedAt: result.fetchedAt,
            rawPayload: result.rawPayload,
          };

          return { pointResult, rawRecord };
        })
      );

      for (const item of batchResults) {
        scan.gridPoints.push(item.pointResult);
        if (item.rawRecord) {
          scan.rawResponses.push(item.rawRecord);
        }
      }

      await Scan.updateOne(
        { _id: scanId, status: 'RUNNING' },
        {
          $push: {
            gridPoints: { $each: batchResults.map((b) => b.pointResult) },
            rawResponses: { $each: batchResults.map((b) => b.rawRecord).filter(Boolean) as IRawSERPRecord[] },
          },
        }
      );

      if (redisClient && redisClient.status === 'ready') {
        const progressPayload = {
          scanId,
          status: 'RUNNING',
          scanShape: scan.scanShape || 'GRID',
          totalPoints: grid.coordinates.length,
          completedPoints: scan.gridPoints.length,
          gridPoints: scan.gridPoints,
        };
        redisClient.publish(`scan:progress:${scanId}`, JSON.stringify(progressPayload)).catch(() => {});
      }
    }

    // 2.5 Compute competitor spatial rank metrics across all grid points in this scan
    const totalGridPoints = scan.gridPoints.filter((point) => point.observationState !== 'MISSING').length;
    const competitorMap = new Map<
      string,
      {
        placeId?: string;
        cid?: string;
        name: string;
        address?: string;
        rating?: number;
        reviewsCount?: number;
        primaryCategory?: string;
        phone?: string;
        website?: string;
        ranks: number[];
      }
    >();

    for (const pt of scan.gridPoints) {
      if (pt.isDuplicateCell) continue;
      for (const item of pt.items || []) {
        if (!item.isTarget) {
          const compKey = getCompetitorGroupingKey(item);
          let existing = competitorMap.get(compKey);
          if (!existing) {
            existing = {
              placeId: item.placeId?.startsWith('gm_') ? undefined : item.placeId,
              cid: item.cid,
              name: item.name,
              address: item.address,
              rating: item.rating,
              reviewsCount: item.reviewsCount,
              primaryCategory: item.primaryCategory,
              phone: item.phone,
              website: item.website,
              ranks: [],
            };
            competitorMap.set(compKey, existing);
          }
          if (typeof item.rank === 'number' && item.rank >= 1 && item.rank <= 20) {
            existing.ranks.push(item.rank);
          }
        }
      }
    }

    // 3. Compute final metrics
    const metrics = MetricsCalculator.calculate(scan.gridPoints);
    const observedCount = metrics.observedCount ?? (metrics.totalPoints - metrics.missingCount);
    const totalPoints = metrics.totalPoints || 1;
    const requiredCredits = scan.credits.required || 1;
    const observedRatio = observedCount / totalPoints;
    const totalObservedPlaces = scan.gridPoints.reduce((acc, pt) => acc + (pt.items?.length || 0), 0);

    let finalStatus: 'FAILED' | 'PARTIAL' | 'COMPLETED' = 'COMPLETED';
    let finalError: string | undefined;
    let finalCharged = true;
    let refundAmount = 0;
    const isNoLocalResults = observedCount > 0 && totalObservedPlaces === 0;

    if (isNoLocalResults) {
      /**
       * Policy: NO_LOCAL_RESULTS outcome (§2.2c / Phase 2)
       * When all observed grid pins return 0 local places (e.g. no local pack for query):
       * 1. End scan with FAILED status and error code 'NO_LOCAL_RESULTS'.
       * 2. Flag keyword on TrackedKeyword with noLocalResults: true and timestamp.
       * 3. Block immediate unforced re-scans for 24h cooldown.
       * 4. Windowed refund policy: Refund credits at most once per keyword per 24h window.
       *    Subsequent repeated scans on the same dead keyword within the window consume credits.
       */
      finalStatus = 'FAILED';
      finalError = 'NO_LOCAL_RESULTS: No local pack or organic places found for this keyword in this geographic area.';

      const { TrackedKeyword } = await import('../models/TrackedKeyword');
      const normalized = scan.keyword.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      const trackedKeyword = await TrackedKeyword.findOne({
        locationId: scan.locationId,
        normalizedKeyword: { $in: [normalized, scan.keyword.trim().toLowerCase().replace(/\s+/g, ' ')] },
      });

      const refundCooldownMs = 24 * 60 * 60 * 1000;
      const refundWindowKey = `serp:refund:nolocal:${scan.workspaceId}:${scan.locationId}:${normalized}`;
      const dailyCapKey = `serp:refund:daily_nolocal_cap:${scan.workspaceId}:${new Date().toISOString().slice(0, 10)}`;
      const MAX_DAILY_NOLOCAL_REFUNDS_PER_WS = 5;

      const { cacheStore } = await import('../config/redis');
      const inWindow = await cacheStore.get(refundWindowKey);
      const dailyCount = parseInt((await cacheStore.get(dailyCapKey)) || '0', 10);

      let isRefundPermitted = true;
      if (inWindow || dailyCount >= MAX_DAILY_NOLOCAL_REFUNDS_PER_WS) {
        isRefundPermitted = false;
      }

      if (trackedKeyword) {
        const lastRefund = trackedKeyword.lastRefundedNoLocalResultsAt;
        const alreadyRefundedInWindow = Boolean(lastRefund && (Date.now() - lastRefund.getTime() < refundCooldownMs));
        if (alreadyRefundedInWindow) {
          isRefundPermitted = false;
        }
      }

      if (isRefundPermitted) {
        refundAmount = requiredCredits;
        finalCharged = false;
        if (trackedKeyword) {
          trackedKeyword.lastRefundedNoLocalResultsAt = new Date();
        }
        await cacheStore.set(refundWindowKey, '1', 86400).catch(() => {});
        await cacheStore.set(dailyCapKey, String(dailyCount + 1), 86400).catch(() => {});
      } else {
        refundAmount = 0;
        finalCharged = true;
      }

      if (trackedKeyword) {
        trackedKeyword.noLocalResults = true;
        trackedKeyword.noLocalResultsAt = new Date();
        trackedKeyword.lastScanError = 'NO_LOCAL_RESULTS';
        await trackedKeyword.save();
      }
    } else if (observedCount === 0) {
      // 0% points observed: All provider lookups failed/errored -> 100% refund
      finalStatus = 'FAILED';
      const hasTierFailure = scan.gridPoints.some((point) => point.error?.includes('SCRAPER_ALL_TIERS_FAILED'));
      if (hasTierFailure) {
        finalError = 'temporarily unavailable, retry later (SCRAPER_ALL_TIERS_FAILED)';
      } else {
        finalError = scan.gridPoints.find((point) => point.error)?.error || 'All grid points failed provider lookup.';
      }
      finalCharged = false;
      refundAmount = requiredCredits;
    } else if (metrics.missingCount > 0) {
      // Partial scan
      finalStatus = 'PARTIAL';
      if (requiredCredits === 1) {
        // Single-credit / trial scans (e.g. 7 points): Charge 1 only if >= 50% points observed, else refund
        if (observedRatio < 0.5) {
          finalCharged = false;
          refundAmount = 1;
          finalError = `Degraded scan: Only ${observedCount}/${totalPoints} points observed (<50%). Credit refunded.`;
        } else {
          finalCharged = true;
          refundAmount = 0;
        }
      } else {
        // Multi-credit scans (e.g. 4 credits for 31-point grid): Prorated charging with 25% minimum floor
        if (observedRatio < 0.25) {
          finalCharged = false;
          refundAmount = requiredCredits;
          finalError = `Degraded scan: Only ${observedCount}/${totalPoints} points observed (<25%). Full credits refunded.`;
        } else {
          const chargedCredits = Math.max(1, Math.round(observedRatio * requiredCredits));
          refundAmount = Math.max(0, requiredCredits - chargedCredits);
          finalCharged = chargedCredits > 0;
        }
      }
    }

    const searchedPins = scan.gridPoints.filter((point) => !point.isDuplicateCell && point.pinStatus !== 'DUPLICATE');
    const okPinsCount = searchedPins.filter((point) => point.pinStatus === 'OK').length;
    const scanMinOkRatio = process.env.SCAN_MIN_OK_RATIO ? parseFloat(process.env.SCAN_MIN_OK_RATIO) : 0.7;
    const okRatio = searchedPins.length > 0 ? okPinsCount / searchedPins.length : 0;
    const isInconclusive = okRatio < scanMinOkRatio;
    if (isInconclusive) {
      scan.inconclusive = true;
      logger.warn(
        `[Scan Runner] Scan ${scanId} is INCONCLUSIVE: OK pins ratio ${(okRatio * 100).toFixed(1)}% (${okPinsCount}/${searchedPins.length}) is below required ratio ${(scanMinOkRatio * 100).toFixed(1)}%`
      );
    }

    const areaDifficulty = MetricsCalculator.calculateAreaDifficultyRollup(scan.gridPoints);

    const updatedScan = await Scan.findOneAndUpdate(
      { _id: scanId, status: 'RUNNING' },
      {
        $set: {
          metrics: finalStatus === 'FAILED' ? null : metrics,
          areaDifficulty: finalStatus === 'FAILED' ? null : areaDifficulty,
          completedAt: new Date(),
          status: finalStatus,
          error: finalError,
          noLocalResults: isNoLocalResults,
          inconclusive: isInconclusive,
          'credits.charged': finalCharged,
        },
      },
      { new: true }
    );
    if (!updatedScan) return await Scan.findById(scanId);
    if (refundAmount > 0) {
      await refundScanCredit(scan._id, resolvedWorkspaceId!, refundAmount);
    }

    // Reconcile actual SERP spend vs estimated spend using CAS guard (§4)
    const liveSerpPoints = (updatedScan.gridPoints || []).filter(
      (p: any) => p.observationState === 'OBSERVED' && !p.cached
    ).length;
    const actualCostUsd = Number((liveSerpPoints * (ENV.SERP_COST_PER_POINT_USD || 0.002)).toFixed(4));
    const estimatedCostUsd = Number((totalGridPoints * (ENV.SERP_COST_PER_POINT_USD || 0.002)).toFixed(4));
    await reconcileScanSpend(scanId, resolvedWorkspaceId!, actualCostUsd, estimatedCostUsd);

    // Materialize competitors only after the final status CAS succeeds. A stale
    // worker must not update market data from a scan canceled during execution.
    if (finalStatus !== 'FAILED') {
      for (const [_, data] of competitorMap.entries()) {
        const spatial = MetricsCalculator.calculateCompetitorSpatialMetrics(data.ranks, totalGridPoints);
        const resolvedPlaceId = data.placeId || (data.cid ? `cid_${data.cid.replace(/:/g, '_')}` : `name_${Buffer.from(data.name).toString('hex').slice(0, 20)}`);

        try {
          await Competitor.findOneAndUpdate(
            { workspaceId: scan.workspaceId, locationId: scan.locationId, placeId: resolvedPlaceId },
            {
              $set: {
                placeId: resolvedPlaceId,
                cid: data.cid,
                name: data.name,
                address: data.address,
                rating: data.rating,
                reviewsCount: data.reviewsCount,
                primaryCategory: data.primaryCategory,
                phone: data.phone,
                website: data.website,
                avgRank: spatial.atrp, // ATRP: Consistent grid denominator (unranked = 21)
                solv: spatial.solv,
                visibilityIndex: spatial.visibilityIndex,
                lastObservedAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
        } catch (competitorErr) {
          logger.warn({ err: competitorErr, placeId: resolvedPlaceId }, '[Scan Runner] Competitor update warning');
        }
      }
    }

    // Sync matching TrackedKeyword documents
    if (updatedScan) {
      try {
        if (finalStatus === 'FAILED') {
          await onScanFailed(updatedScan, finalError);
        } else {
          await onScanCompleted(updatedScan);
        }
      } catch (hookErr) {
        console.warn(`[Scan Runner] scan hook warning:`, hookErr);
      }
    }

    // Also update Location cachedKpis across all active tracked keywords & generate evidence-backed recommended tasks
    if (updatedScan && finalStatus !== 'FAILED') {
      try {
        const allKeywords = await TrackedKeyword.find({ locationId: resolvedLocationId, status: 'active' }).lean();
        const scannedKws = allKeywords.filter((k: any) => k.lastScannedAt != null || typeof k.currentRank === 'number');
        const rankedKws = scannedKws.filter((k: any) => typeof k.currentRank === 'number' && k.currentRank > 0 && k.currentRank <= 20);

        let aggregateVis = Math.round(metrics.visibilityIndex ?? 0);
        let aggregateRank: number | null = metrics.arp ? Math.round(metrics.arp) : null;

        if (scannedKws.length > 0) {
          aggregateVis = Math.round(scannedKws.reduce((acc: number, k: any) => acc + (k.visibilityScore || 0), 0) / scannedKws.length);
          if (rankedKws.length > 0) {
            aggregateRank = Math.round((rankedKws.reduce((acc: number, k: any) => acc + (k.currentRank ?? 0), 0) / rankedKws.length) * 10) / 10;
          } else {
            aggregateRank = 21;
          }
        }

        const generatedTasks = TaskEngineService.generateTasks(location, scan.gridPoints);

        await Location.findByIdAndUpdate(resolvedLocationId, {
          'cachedKpis.averagePosition': aggregateRank,
          'cachedKpis.visibilityScore': aggregateVis,
          'cachedKpis.areaDifficulty': areaDifficulty,
          'cachedKpis.lastCalculatedAt': new Date(),
          recommendedTasks: generatedTasks,
        });
      } catch (locErr) {
        console.warn(`[Scan Runner] Location cachedKpis update warning:`, locErr);
      }
    }

    if (resolvedLocationId) {
      invalidateLocationChatCache(resolvedLocationId).catch(() => {});
    }

    console.log(
      `✅ [Scan Runner] Scan ${scanId} finished with status ${finalStatus}. ARP=${metrics.arp}, SoLV=${metrics.solv}%, VisibilityIndex=${metrics.visibilityIndex}%`
    );

    if (redisClient && redisClient.status === 'ready') {
      const completionPayload = {
        scanId,
        status: finalStatus,
        scanShape: scan.scanShape || 'GRID',
        totalPoints: scan.gridPoints.length,
        completedPoints: scan.gridPoints.length,
        metrics: updatedScan?.metrics || metrics,
        gridPoints: updatedScan?.gridPoints || scan.gridPoints,
      };
      redisClient.publish(`scan:progress:${scanId}`, JSON.stringify(completionPayload)).catch(() => {});
    }

    // Dual-write to PostgreSQL partitioned tables (§Phase 4)
    if (updatedScan) {
      persistScanToPostgres(updatedScan, finalStatus, finalError).catch((e) => {
        console.warn(`[Scan Runner:PostgresDualWrite] Background write warning: ${e.message}`);
      });
    }

    const finalResult = await Scan.findById(scanId);
    return finalResult || updatedScan;
  } catch (err: any) {
    console.error(`❌ [Scan Runner] Error processing Scan ${scanId}:`, err);
    throw err;
  } finally {
    await releaseScanLock(scanId);
  }
}

export function isConnectionError(err: Error): boolean {
  const msg = (err?.message || '').toLowerCase();
  const code = ((err as any)?.code || '').toUpperCase();
  return (
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('ehostunreach') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    code === 'TIMEOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET'
  );
}



let onDemandWorker: Worker<ScanJobPayload> | null = null;
let weeklyWorker: Worker<ScanJobPayload> | null = null;
let scanSweepTimer: NodeJS.Timeout | null = null;
let weeklyPacingTimer: NodeJS.Timeout | null = null;

export function getOnDemandWorker(): Worker<ScanJobPayload> | null {
  return onDemandWorker;
}

export function getWeeklyWorker(): Worker<ScanJobPayload> | null {
  return weeklyWorker;
}

export function startScanWorker(): Worker<ScanJobPayload> | null {
  if (onDemandWorker) {
    return onDemandWorker;
  }
  if (!redisClient || redisClient.status !== 'ready') {
    console.warn('[Scan Worker] Redis is not ready; scan queue worker was not started.');
    return null;
  }

  // Separate worker concurrency pools: weekly work cannot starve on-demand scans
  const onDemandConcurrency = parseInt(process.env.ONDEMAND_WORKER_CONCURRENCY || '5', 10);
  const weeklyConcurrency = parseInt(process.env.WEEKLY_WORKER_CONCURRENCY || '2', 10);

  const baseWorkerConfig = {
    connection: redisConnection,
    maxStalledCount: 2,          // Re-enqueue up to 2 times if stalled (Item 4.3 & 5.1)
    stalledInterval: 5000,       // Check every 5s
    lockDuration: 60000,         // Hold lock for 60s max
    lockRenewTime: 10000,        // Renew lock every 10s
  };

  // On-demand job processor: High priority, always runs immediately
  const onDemandJobProcessor = async (job: Job<ScanJobPayload>) => {
    const { scanId, workspaceId, locationId } = job.data;
    try {
      return await processScanExecution(scanId, workspaceId, locationId);
    } finally {
      if (workspaceId) {
        await decrementBackpressure(workspaceId);
      }
    }
  };

  // Weekly job processor: Runs ONLY between 00:00 and 06:00 Asia/Kolkata
  const weeklyJobProcessor = async (job: Job<ScanJobPayload>) => {
    const { scanId, workspaceId, locationId } = job.data;

    const windowStatus = getIstScrapeWindowStatus();
    if (!windowStatus.isInsideWindow) {
      console.log(
        `[Scan Worker:Weekly] Job ${job.id} execution attempted outside IST window (00:00-06:00 Asia/Kolkata). Delaying by ${(
          windowStatus.msUntilNextWindow / 1000 / 60
        ).toFixed(1)} minutes.`
      );
      await job.moveToDelayed(Date.now() + windowStatus.msUntilNextWindow, job.token);
      return null;
    }

    try {
      return await processScanExecution(scanId, workspaceId, locationId);
    } finally {
      if (workspaceId) {
        await decrementBackpressure(workspaceId);
      }
    }
  };

  onDemandWorker = new Worker<ScanJobPayload>(SCAN_ONDEMAND_QUEUE_NAME, onDemandJobProcessor, {
    ...baseWorkerConfig,
    concurrency: onDemandConcurrency,
  });

  weeklyWorker = new Worker<ScanJobPayload>(SCAN_WEEKLY_QUEUE_NAME, weeklyJobProcessor, {
    ...baseWorkerConfig,
    concurrency: weeklyConcurrency,
  });

  // On boot: check window status. If outside 00:00-06:00 Asia/Kolkata window, pause weekly worker immediately (survive restarts)
  const initialWindow = getIstScrapeWindowStatus();
  if (!initialWindow.isInsideWindow) {
    console.log(
      `[Scan Worker:Weekly] On boot: Current time is outside IST scrape window (00:00-06:00 Asia/Kolkata). Weekly worker initialized in PAUSED state until next window in ${(
        initialWindow.msUntilNextWindow / 1000 / 60
      ).toFixed(1)} minutes.`
    );
    weeklyWorker.pause().catch((err) => {
      console.warn('[Scan Worker:Weekly] Initial pause warning:', err.message);
    });
  } else {
    console.log('[Scan Worker:Weekly] On boot: Inside IST scrape window (00:00-06:00 Asia/Kolkata). Weekly worker active.');
  }

  // Periodic off-peak pacing scheduler: inspects IST window every 60s and toggles pause/resume
  weeklyPacingTimer = setInterval(async () => {
    if (!weeklyWorker) return;
    try {
      const status = getIstScrapeWindowStatus();
      const isPaused = weeklyWorker.isPaused();
      if (!status.isInsideWindow && !isPaused) {
        console.log(`[Scan Worker:Weekly] IST scrape window closed (06:00 Asia/Kolkata). Pausing weekly worker.`);
        await weeklyWorker.pause();
      } else if (status.isInsideWindow && isPaused) {
        console.log(`[Scan Worker:Weekly] IST scrape window opened (00:00 Asia/Kolkata). Resuming weekly worker.`);
        await weeklyWorker.resume();
      }
    } catch (err: any) {
      console.warn('[Scan Worker:Weekly] Periodic pacing check error:', err.message);
    }
  }, 60 * 1000);
  if (weeklyPacingTimer.unref) weeklyPacingTimer.unref();

  const setupWorkerEvents = (w: Worker<ScanJobPayload>, name: string) => {
    w.on('completed', (job: Job) => {
      console.log(`[Scan Worker:${name}] Job ${job.id} completed for Scan ${job.data.scanId}`);
    });

    w.on('stalled', async (jobId: string, prev: string) => {
      console.warn(`[Scan Worker:${name}] Job ${jobId} stalled (was in state: ${prev}). Auto-recovering.`);
    });

    w.on('failed', async (job: Job | undefined, err: Error) => {
      const queueKey = name.toLowerCase().includes('weekly') ? 'weekly' : 'ondemand';
      queueFailedJobs.inc({ queue: queueKey });

      const attemptsMade = job?.attemptsMade || 1;
      const maxAttempts = job?.opts?.attempts || 3;
      const isFinalAttempt = attemptsMade >= maxAttempts;

      console.error(
        `[Scan Worker:${name}] Job ${job?.id} failed (attempt ${attemptsMade}/${maxAttempts}):`,
        err.message
      );

      if (isConnectionError(err) && !isFinalAttempt) {
        console.warn(`[Scan Worker:${name}] Connection error on job ${job?.id}; BullMQ will retry.`);
        return;
      }

      if (isFinalAttempt) {
        console.error(
          `🚨 [Scan Worker:${name}] Job ${job?.id} exhausted all ${attemptsMade} attempts. Moving to Dead Letter Queue.`
        );

        await moveToDeadLetterQueue(name, job, err).catch((dlqErr) => {
          console.error(`[Scan Worker:${name}] Failed to move job to DLQ:`, dlqErr);
        });

        if (job?.data?.scanId && job?.data?.workspaceId) {
          try {
            const isTierFailure = (err as any)?.code === 'SCRAPER_ALL_TIERS_FAILED' || err?.message?.includes('SCRAPER_ALL_TIERS_FAILED');
            const displayError = isTierFailure
              ? 'temporarily unavailable, retry later (SCRAPER_ALL_TIERS_FAILED)'
              : (err?.message || 'Internal scan processing error');

            const scan = await Scan.findById(job.data.scanId);
            const claimed =
              scan &&
              (await Scan.findOneAndUpdate(
                { _id: scan._id, status: { $in: ['QUEUED', 'RUNNING', 'PARTIAL'] } },
                { $set: { status: 'FAILED', error: displayError, completedAt: new Date() } },
                { new: true }
              ));
            if (claimed) {
              await onScanFailed(claimed, displayError).catch(() => {});
              if ((claimed.credits?.required || 0) > 0) {
                await refundScanCredit(job.data.scanId, job.data.workspaceId, claimed.credits.required);
              }
              const estimatedCost = claimed.costTracking?.estimatedCostUsd || 0;
              await reconcileScanSpend(job.data.scanId, job.data.workspaceId, 0, estimatedCost);
              persistScanToPostgres(claimed, 'FAILED', displayError).catch(() => {});
            }
          } catch (refundErr) {
            console.warn(`[Scan Worker:${name}] DLQ safety refund failed:`, refundErr);
          }
        }
      }
    });

    w.on('error', (err: Error) => {
      console.error(`[Scan Worker:${name}] Redis queue error:`, err.message);
    });
  };

  setupWorkerEvents(onDemandWorker, 'OnDemand');
  setupWorkerEvents(weeklyWorker, 'Weekly');

  scanSweepTimer = setInterval(() => {
    sweepUnreconciledScans().catch((err) => console.error('[Scan Worker] Reconciliation sweep failed:', err));
  }, 5 * 60 * 1000);
  scanSweepTimer.unref();

  return onDemandWorker;
}

export async function stopScanWorker(): Promise<void> {
  if (weeklyPacingTimer) {
    clearInterval(weeklyPacingTimer);
    weeklyPacingTimer = null;
  }
  if (scanSweepTimer) {
    clearInterval(scanSweepTimer);
    scanSweepTimer = null;
  }
  if (onDemandWorker) {
    await onDemandWorker.close();
    onDemandWorker = null;
  }
  if (weeklyWorker) {
    await weeklyWorker.close();
    weeklyWorker = null;
  }
}

export async function gracefulShutdownScanWorker(signal: string = 'SIGTERM', timeoutMs = 30000): Promise<void> {
  console.log(`[Scan Worker] Received ${signal}, starting graceful shutdown...`);
  if (onDemandWorker) {
    await onDemandWorker.pause().catch(() => {});
  }
  if (weeklyWorker) {
    await weeklyWorker.pause().catch(() => {});
  }
  const shutdownTimeout = setTimeout(() => {
    console.warn('[Scan Worker] Graceful shutdown timeout; forcing exit');
  }, timeoutMs);

  try {
    await stopScanWorker();
    clearTimeout(shutdownTimeout);
    console.log('[Scan Worker] Graceful shutdown complete');
  } catch (err) {
    console.error('[Scan Worker] Error during shutdown:', err);
  }
}

export const closeScanWorker = stopScanWorker;


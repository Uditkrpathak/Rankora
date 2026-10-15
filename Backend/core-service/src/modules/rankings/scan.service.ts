import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { Scan, ScanDocument, computeBillingCycleKey, refundScanCredit } from '../../models/Scan';
import { Location } from '../../models/Location';
import { Workspace, resetWorkspaceBillingCycleIfExpired } from '../../models/Workspace';
import { DEFAULT_GRID_SIZE, DEFAULT_RADIUS_KM, DEFAULT_SCAN_SHAPE, DEFAULT_RINGS_RADIUS_KM, DEFAULT_SUNFLOWER_RADIUS_KM, MIN_RADIUS_KM, MAX_RADIUS_KM, FAILED_SCAN_REUSE_MS, GridGenerator, SCAN_STALE_AFTER_MS, STALLED_SCAN_AFTER_MS } from './grid-generator';
import { SCAN_SHAPES, ScanShape } from './scan-settings';
import { enqueueScanJob, checkQueueBackpressure } from '../../jobs/scan.queue';
import { IScanLocalization } from '@localo/types';
import { ENV } from '../../config/env';
import { redisClient, memoryFallback } from '../../config/redis';

async function checkForceScanFixedWindowRateLimit(workspaceId: string, planKey: string = 'starter', windowSec = 60): Promise<boolean> {
  const planLimits: Record<string, number> = {
    free: 5,
    starter: 5,
    growth: 15,
    pro: 15,
    agency: 30,
    enterprise: 50,
  };
  const limit = planLimits[planKey.toLowerCase()] || 10;
  const key = `ratelimit:forcescan:${workspaceId}`;
  if (redisClient && redisClient.status === 'ready') {
    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSec);
      }
      return current <= limit;
    } catch {}
  }
  const now = Date.now();
  const entry = memoryFallback.get(key);
  if (!entry || entry.exp < now) {
    memoryFallback.set(key, { val: '1', exp: now + windowSec * 1000 });
    return true;
  }
  const count = (Number(entry.val) || 0) + 1;
  entry.val = String(count);
  return count <= limit;
}

export interface TriggerScanInput {
  workspaceId: string;
  locationId: string;
  keyword: string;
  scanShape?: ScanShape;
  gridSize?: number;
  radiusKm?: number;
  center?: { lat: number; lng: number };
  centerSource?: 'BUSINESS' | 'CUSTOM';
  localization?: Partial<IScanLocalization>;
  idempotencyKey?: string;
  force?: boolean;
  scheduled?: boolean;
}

function hasMeasuredPoints(scan: ScanDocument, expectedPoints: number): boolean {
  const points = scan.gridPoints || [];
  const isRealObservation = (point: (typeof points)[number]) =>
    point.observationState === 'OBSERVED' && Boolean(point.provider?.trim()) && point.provider?.trim().toUpperCase() !== 'MOCK';
  return points.length === expectedPoints && points.some(isRealObservation) && points.every((point) =>
    point.provider?.trim().toUpperCase() !== 'MOCK' && (point.observationState === 'MISSING' || isRealObservation(point))
  );
}

function hasMockProvider(scan: ScanDocument): boolean {
  return (scan.gridPoints || []).some((point) => point.provider?.trim().toUpperCase() === 'MOCK');
}

function resolveGoogleCountryCode(locationCountry: string, requestedCode?: string): string {
  const raw = (requestedCode || locationCountry || '').trim();
  const normalized = raw.toLowerCase();
  const aliases: Record<string, string> = {
    india: 'in',
    'united states': 'us',
    'united states of america': 'us',
    usa: 'us',
    'united kingdom': 'gb',
    britain: 'gb',
    uk: 'gb',
    canada: 'ca',
    australia: 'au',
    germany: 'de',
    france: 'fr',
    'united arab emirates': 'ae',
    uae: 'ae',
    japan: 'jp',
    brazil: 'br',
    mexico: 'mx',
    spain: 'es',
    italy: 'it',
    netherlands: 'nl',
    singapore: 'sg',
    'new zealand': 'nz',
  };
  const code = aliases[normalized] || (/^[a-z]{2}$/.test(normalized) ? normalized : null);
  if (!code) {
    throw new Error('Location country must be a two-letter code for Google Maps searches. Update the location country or pass localization.gl.');
  }
  return code;
}

export class ScanService {
  private async expireStalledScan(scan: ScanDocument): Promise<ScanDocument> {
    if (!scan.dedupeFingerprint || !['QUEUED', 'RUNNING'].includes(scan.status) ||
        scan.updatedAt.getTime() >= Date.now() - STALLED_SCAN_AFTER_MS) return scan;
    const expired = await Scan.findOneAndUpdate(
      {
        _id: scan._id,
        status: { $in: ['QUEUED', 'RUNNING'] },
        updatedAt: { $lt: new Date(Date.now() - STALLED_SCAN_AFTER_MS) },
      },
      { $set: { status: 'FAILED', error: 'The rank scan stalled before completion. Retry when the worker and Redis are available.', completedAt: new Date() } },
      { new: true }
    );
    if (!expired) return (await Scan.findById(scan._id)) || scan;
    await refundScanCredit(expired._id, expired.workspaceId, expired.credits.required);
    const estimatedCost = expired.costTracking?.estimatedCostUsd || 0;
    const { reconcileScanSpend } = await import('../../models/Scan');
    await reconcileScanSpend(expired._id, expired.workspaceId, 0, estimatedCost);
    expired.credits.refunded = true;
    expired.credits.charged = false;
    return expired;
  }

  /**
   * Initiates a measured regional scan, reserving credits for its actual point count.
   */
  public async triggerScan(input: TriggerScanInput): Promise<ScanDocument> {
    const { workspaceId, locationId, keyword } = input;
    const scanShape = input.scanShape ?? DEFAULT_SCAN_SHAPE;
    if (!SCAN_SHAPES.includes(scanShape)) {
      throw Object.assign(new Error(`Unsupported scan shape: ${scanShape}`), { statusCode: 400, code: 'INVALID_SCAN_SHAPE' });
    }
    const isRadial = scanShape === 'RINGS' || scanShape === 'SUNFLOWER';
    const gridSize = isRadial ? DEFAULT_GRID_SIZE : input.gridSize ?? DEFAULT_GRID_SIZE;
    const radiusKm = input.radiusKm ?? (isRadial ? DEFAULT_RINGS_RADIUS_KM : DEFAULT_RADIUS_KM);

    // Validate Radius
    if (typeof radiusKm !== 'number' || !Number.isFinite(radiusKm) || isNaN(radiusKm) || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
      throw Object.assign(
        new Error(`Scan radius must be a finite number between ${MIN_RADIUS_KM} km and ${MAX_RADIUS_KM} km (received ${radiusKm})`),
        { statusCode: 400, code: 'INVALID_RADIUS' }
      );
    }

    if (input.centerSource && !['BUSINESS', 'CUSTOM'].includes(input.centerSource)) {
      throw Object.assign(
        new Error(`Invalid centerSource: ${input.centerSource}. Allowed values: 'BUSINESS', 'CUSTOM'`),
        { statusCode: 400, code: 'INVALID_CENTER_SOURCE' }
      );
    }

    // 1. Verify location belongs to workspace
    const [location, workspaceDoc] = await Promise.all([
      Location.findOne({
        _id: locationId,
        workspaceId,
        deletedAt: null,
      }),
      Workspace.findById(workspaceId).select('plan limits').lean(),
    ]);

    if (!location) {
      throw Object.assign(new Error('Location not found in workspace'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });
    }
    if (!workspaceDoc) {
      throw Object.assign(new Error('Workspace not found'), { statusCode: 404, code: 'WORKSPACE_NOT_FOUND' });
    }

    // Location Coordinate Integrity Verification (Task 5a)
    const { isKnownFallbackCoordinate } = await import('../../providers/places-autocomplete.provider');
    const coords = location.coordinates;
    const isMockFallback = location.coordinatesSource === 'MOCK_FALLBACK';
    const isInvalidCoords = !coords || (coords.lat === 0 && coords.lng === 0) || isKnownFallbackCoordinate(coords.lat, coords.lng);

    if (isMockFallback || isInvalidCoords) {
      throw Object.assign(
        new Error(
          `Scan refused: Location '${location.name}' has unverified fallback coordinates (${coords?.lat ?? 0}, ${coords?.lng ?? 0}). Please confirm business location coordinates on the map before running scans.`
        ),
        { statusCode: 422, code: 'UNVERIFIED_LOCATION_COORDINATES' }
      );
    }

    // 2. Server-side Plan Tier Gate Enforcement (Direct API tamper prevention)
    const planKey = (workspaceDoc.plan?.key || 'free_trial').toLowerCase();
    const { getMaxRadiusForPlan } = await import('./scan-settings');
    const maxRadiusAllowed = getMaxRadiusForPlan(planKey);
    if (radiusKm > maxRadiusAllowed) {
      throw Object.assign(
        new Error(`Plan '${planKey}' allows maximum scan radius of ${maxRadiusAllowed} km (requested: ${radiusKm} km). Please upgrade your plan for larger coverage.`),
        { statusCode: 403, code: 'PLAN_RADIUS_LIMIT_EXCEEDED' }
      );
    }

    const isStarterOrFree = planKey === 'starter' || planKey === 'free' || planKey === 'trial' || planKey === 'free_trial';
    if (isStarterOrFree && isRadial && !['trial', 'free_trial'].includes(planKey)) {
      // Starter plans restricted from 31-pin scans
    }
    if (isStarterOrFree && gridSize > 5) {
      throw Object.assign(
        new Error(`Grid size ${gridSize}x${gridSize} requires a Pro or Agency plan. Starter plans support up to 5x5 grid scans.`),
        { statusCode: 403, code: 'PLAN_UPGRADE_REQUIRED' }
      );
    }

    // 3. Resolve center coordinates & validation
    const center = input.center || location.coordinates;
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number' || isNaN(center.lat) || isNaN(center.lng) || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
      throw Object.assign(new Error('Valid latitude and longitude coordinates are required for scan'), { statusCode: 400, code: 'INVALID_COORDINATES' });
    }
    if (center.lat < -90 || center.lat > 90 || center.lng < -180 || center.lng > 180 || Math.abs(center.lat) > 89) {
      throw Object.assign(new Error('Coordinates out of range (-90..90 lat, -180..180 lng, within 89° of poles)'), { statusCode: 400, code: 'INVALID_COORDINATES' });
    }
    const centerSource: 'BUSINESS' | 'CUSTOM' = input.centerSource || (input.center ? 'CUSTOM' : 'BUSINESS');

    const sampling = isRadial
      ? GridGenerator.generateRadialGrid(center.lat, center.lng, radiusKm, centerSource)
      : scanShape === 'QUICK'
      ? GridGenerator.generateQuickGrid(center.lat, center.lng, radiusKm, centerSource)
      : GridGenerator.generateGrid(center.lat, center.lng, gridSize, radiusKm);
    const creditsRequired = sampling.creditsRequired;

    const localization: IScanLocalization = {
      hl: input.localization?.hl || 'en',
      gl: resolveGoogleCountryCode(location.country, input.localization?.gl),
      device: input.localization?.device || 'DESKTOP',
    };
    const dedupeFingerprint = createHash('sha256').update(JSON.stringify({
      locationId,
      keyword: keyword.trim().toLowerCase().replace(/\s+/g, ' '),
      scanShape,
      gridSize: scanShape === 'GRID' ? gridSize : null,
      radiusKm,
      center: { lat: Number(center.lat.toFixed(6)), lng: Number(center.lng.toFixed(6)) },
      localization,
      forceNonce: input.force ? (input.idempotencyKey || Date.now().toString()) : undefined,
    })).digest('hex');

    // A retried request with the same key must return its original immutable snapshot.
    const idempotencyKey = input.idempotencyKey || `scan_${workspaceId}_${locationId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const existing = await Scan.findOne({ workspaceId, idempotencyKey });
    if (existing) return existing;

    // Check NO_LOCAL_RESULTS cooldown: block immediate re-scans for 24h unless forced
    const { TrackedKeyword } = await import('../../models/TrackedKeyword');
    const normalizedKw = keyword.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const trackedKw = await TrackedKeyword.findOne({ locationId, normalizedKeyword: { $in: [normalizedKw, keyword.trim().toLowerCase().replace(/\s+/g, ' ')] } });
    if (trackedKw && trackedKw.noLocalResults && trackedKw.noLocalResultsAt) {
      const cooldownMs = 24 * 60 * 60 * 1000;
      if (Date.now() - trackedKw.noLocalResultsAt.getTime() < cooldownMs && !input.force) {
        throw Object.assign(
          new Error('NO_LOCAL_RESULTS_COOLDOWN: Keyword has no local pack results in this area. Re-scans are paused for 24h (use forceFresh to override).'),
          { statusCode: 400, code: 'NO_LOCAL_RESULTS_COOLDOWN' }
        );
      }
    }

    if (input.force) {
      // Rate-limit forced fresh scans to protect against abuse (plan-based & Redis-backed)
      const allowed = await checkForceScanFixedWindowRateLimit(workspaceId, planKey, 60);
      if (!allowed) {
        throw Object.assign(
          new Error(`RATE_LIMIT_EXCEEDED: Force-fresh scan rate limit reached for plan '${planKey}'. Please try again shortly.`),
          { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' }
        );
      }
    } else {
      // Reuse an active run across tabs. A partial unique index below also closes
      // the simultaneous-request race between this lookup and Scan.create().
      const active = await Scan.findOne({ workspaceId, dedupeFingerprint, status: { $in: ['QUEUED', 'RUNNING'] } });
      if (active) {
        const resolved = await this.expireStalledScan(active);
        if (resolved.status === 'QUEUED' || resolved.status === 'RUNNING') return resolved;
      }

      const recentTerminal = await Scan.findOne({
        workspaceId, dedupeFingerprint,
        status: { $in: ['COMPLETED', 'PARTIAL', 'FAILED'] },
        completedAt: { $gte: new Date(Date.now() - FAILED_SCAN_REUSE_MS) },
      }).sort({ completedAt: -1 });
      if (recentTerminal && !hasMockProvider(recentTerminal)) {
        // A failed or unusable run must be visible, but automatic revisits must
        // not repeatedly spend provider quota. Explicit force skips this delay.
        return recentTerminal;
      }
      const completed = await Scan.findOne({
        workspaceId, dedupeFingerprint, status: 'COMPLETED',
        completedAt: { $gte: new Date(Date.now() - SCAN_STALE_AFTER_MS) },
      }).sort({ completedAt: -1 });
      if (completed && hasMeasuredPoints(completed, sampling.pointCount)) return completed;
    }

    // 4. Calculate estimated USD cost & check/advance billing cycle
    const estimatedUsdCost = Number((sampling.pointCount * (ENV.SERP_COST_PER_POINT_USD || 0.002)).toFixed(4));
    await resetWorkspaceBillingCycleIfExpired(workspaceId);

    // 4.5 Check Provider Capacity / Balance
    const { serpBalanceService } = await import('../../providers/serp/serp-balance.service');
    const configuredProvider = (process.env.SERP_PROVIDER || ENV.SERP_PROVIDER || 'GOOGLE_MAPS_HTTP').toUpperCase();
    const capacity = await serpBalanceService.canCoverEstimatedCost(configuredProvider, estimatedUsdCost, input.scheduled === true);
    if (!capacity.available && capacity.reason === 'PAUSED_SCHEDULED_SCAN_LOW_BALANCE') {
      throw Object.assign(new Error('PAUSED_SCHEDULED_SCAN_LOW_BALANCE: Provider balance is too low for a scheduled scan.'), {
        code: 'PAUSED_SCHEDULED_SCAN_LOW_BALANCE',
      });
    }
    if (!capacity.available && capacity.reason === 'PROVIDER_CAPACITY_UNAVAILABLE') {
      throw Object.assign(
        new Error(`PROVIDER_CAPACITY_UNAVAILABLE: Insufficient provider search capacity (balance: $${capacity.balanceUsd.toFixed(2)}, scan estimated cost: $${estimatedUsdCost.toFixed(4)}). Please top up provider credits.`),
        { statusCode: 503, code: 'PROVIDER_CAPACITY_UNAVAILABLE' }
      );
    }

    // 4.9 Queue Backpressure Check (Item 2)
    await checkQueueBackpressure(workspaceId);

    // 5. Spend cap tracking (Unlimited / Free Scan Mode)
    let workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }

    const billingCycleKey = computeBillingCycleKey(workspaceId, workspace.spendLimits?.billingCycleStart);

    // 6. Create Scan record
    let scan: ScanDocument;
    try {
      scan = await Scan.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        locationId: new mongoose.Types.ObjectId(locationId),
        idempotencyKey,
        dedupeFingerprint,
        billingCycleKey,
        keyword: keyword.trim(),
        scanShape,
        gridSize,
        pointCount: sampling.pointCount,
        gridSpecVersion: 2,
        gridSpec: sampling.gridSpec,
        radiusKm,
        center: { lat: center.lat, lng: center.lng },
        localization,
        status: 'QUEUED',
        metricsVersion: '2.0',
        costTracking: {
          estimatedCostUsd: estimatedUsdCost,
          actualCostUsd: 0,
          reconciled: false,
          billingCycleKey,
        },
        credits: {
          required: 0,
          reserved: false,
          charged: false,
          refunded: false,
        },
        gridPoints: [],
        rawResponses: [],
      });
    } catch (createErr: any) {
      if (createErr?.code === 11000) {
        const prior = await Scan.findOne({ workspaceId, idempotencyKey });
        if (prior) return prior;
        const concurrent = await Scan.findOne({ workspaceId, dedupeFingerprint, status: { $in: ['QUEUED', 'RUNNING'] } });
        if (concurrent) return concurrent;
      }
      throw createErr;
    }

    // 7. Enqueue BullMQ job
    try {
      await enqueueScanJob({
        scanId: (scan._id as any).toString(),
        workspaceId,
        locationId,
        planKey,
      });
    } catch (enqueueErr) {
      scan.status = 'FAILED';
      scan.error = 'Could not queue this scan. Please retry.';
      await scan.save();
      const { reconcileScanSpend } = await import('../../models/Scan');
      await reconcileScanSpend(scan._id, workspaceId, 0, estimatedUsdCost);
      throw enqueueErr;
    }

    return scan;
  }

  public async getScanById(scanId: string, workspaceId: string): Promise<ScanDocument | null> {
    const query: any = Scan.findOne({ _id: scanId, workspaceId });
    const scan: ScanDocument | null = await (typeof query?.select === 'function' ? query.select('-rawResponses') : query);
    if (!scan) return null;
    const resolved = await this.expireStalledScan(scan);
    return resolved.status === scan.status ? scan : Scan.findOne({ _id: scanId, workspaceId }).select('-rawResponses');
  }

  public async getLocationScans(
    locationId: string,
    workspaceId: string,
    limit: number = 20
  ): Promise<ScanDocument[]> {
    const query: any = Scan.find({ locationId, workspaceId })
      .sort({ createdAt: -1 })
      .limit(limit);
    const scans: ScanDocument[] = await (typeof query?.select === 'function' ? query.select('-rawResponses') : query);
    const resolved = await Promise.all(scans.map(async (scan) => this.expireStalledScan(scan)));
    return resolved.filter((scan) => !hasMockProvider(scan));
  }

  /**
   * Returns chronological completed scans for Time Machine playback
   */
  public async getLocationScanHistory(
    locationId: string,
    workspaceId: string,
    keyword?: string
  ): Promise<ScanDocument[]> {
    const filter: any = {
      locationId,
      workspaceId,
      status: 'COMPLETED',
    };
    if (keyword && keyword.trim()) {
      filter.keyword = keyword.trim();
    }

    const query: any = Scan.find(filter)
      .sort({ createdAt: 1 })
      .limit(50);
    const scans: ScanDocument[] = await (typeof query?.select === 'function' ? query.select('-rawResponses') : query);
    const realScans = scans.filter((s) => !hasMockProvider(s));
    const latest = realScans.at(-1);
    if (!latest) return [];
    const version = latest.gridSpec?.gridSpecVersion ?? 1;
    return realScans.filter((s) => (s.gridSpec?.gridSpecVersion ?? 1) === version && s.radiusKm === latest.radiusKm);
  }

  /**
   * Generates or updates public share token and agency branding for a scan
   */
  public async shareScan(
    scanId: string,
    workspaceId: string,
    branding?: {
      agencyName?: string;
      logoUrl?: string;
      primaryColor?: string;
      contactEmail?: string;
      websiteUrl?: string;
      notes?: string;
    },
    isPublic: boolean = true
  ): Promise<ScanDocument> {
    const scan = await Scan.findOne({ _id: scanId, workspaceId });
    if (!scan) {
      throw new Error('Scan not found in workspace');
    }

    if (!scan.shareToken && isPublic) {
      const { randomBytes } = await import('crypto');
      scan.shareToken = randomBytes(12).toString('hex');
    }

    scan.isPublicShareable = isPublic;
    if (branding) {
      scan.agencyBranding = {
        agencyName: branding.agencyName || scan.agencyBranding?.agencyName || null,
        logoUrl: branding.logoUrl || scan.agencyBranding?.logoUrl || null,
        primaryColor: branding.primaryColor || scan.agencyBranding?.primaryColor || null,
        contactEmail: branding.contactEmail || scan.agencyBranding?.contactEmail || null,
        websiteUrl: branding.websiteUrl || scan.agencyBranding?.websiteUrl || null,
        notes: branding.notes || scan.agencyBranding?.notes || null,
      };
    }

    await scan.save();
    return scan;
  }

  /**
   * Fetches public sanitized scan report for non-authenticated clients
   */
  public async getPublicScanByToken(shareToken: string): Promise<{
    scan: any;
    location: any;
  } | null> {
    const scan = await Scan.findOne({ shareToken, isPublicShareable: true }).select('-rawResponses -credits');
    if (!scan) {
      return null;
    }

    const location = await Location.findById(scan.locationId).select('name address coordinates country website primaryCategory placeId rating reviewsCount');

    return {
      scan: {
        _id: scan._id,
        keyword: scan.keyword,
        scanShape: scan.scanShape,
        gridSize: scan.gridSize,
        pointCount: scan.pointCount,
        radiusKm: scan.radiusKm,
        center: scan.center,
        status: scan.status,
        gridPoints: scan.gridPoints,
        metrics: scan.metrics,
        agencyBranding: scan.agencyBranding,
        completedAt: scan.completedAt,
        createdAt: scan.createdAt,
      },
      location,
    };
  }
}

export const scanService = new ScanService();

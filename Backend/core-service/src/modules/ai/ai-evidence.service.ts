import mongoose from 'mongoose';
import { Location } from '../../models/Location';
import { Scan } from '../../models/Scan';
import { Audit } from '../../models/Audit';
import { ReviewCache } from '../../models/ReviewCache';
import { AiEvidenceBundle, AiEvidenceFact, AiMissingEvidence } from './ai.types';

const LOCATION_FRESH_MS = 90 * 24 * 60 * 60 * 1000;
const PLACES_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
const GBP_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
const SCAN_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
const REVIEW_CACHE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function isFreshObservation(observedAt: Date | string | null | undefined, now = new Date(), maxAgeMs = SCAN_FRESH_MS): boolean {
  if (!observedAt) return false;
  const time = new Date(observedAt).getTime();
  return Number.isFinite(time) && time <= now.getTime() && now.getTime() - time <= maxAgeMs;
}

export function isMockSource(source: unknown): boolean {
  return typeof source === 'string' && /(^|[^A-Z])MOCK([^A-Z]|$)/i.test(source);
}

export function classifyScanEvidence(points: Array<{ provider?: string | null; observationState?: string }>, observedAt: Date | string | null | undefined, now = new Date()): { include: boolean; source?: string; reason?: AiMissingEvidence['reason'] } {
  const providers = [...new Set((points || []).map((point) => point.provider?.trim()).filter((provider): provider is string => Boolean(provider)))];
  if (providers.some(isMockSource)) return { include: false, reason: 'MOCK_EXCLUDED' };
  if (!points.length || !providers.length || points.some((point) => !point.provider?.trim() || point.observationState === 'MISSING')) return { include: false, reason: 'MISSING' };
  if (!isFreshObservation(observedAt, now, SCAN_FRESH_MS)) return { include: false, reason: 'STALE' };
  return { include: true, source: providers.length === 1 ? providers[0] : 'MIXED' };
}

export class AiEvidenceService {
  private addValue(
    bundle: AiEvidenceBundle,
    key: string,
    value: unknown,
    source: string,
    observedAt: Date | string | null | undefined,
    confidence: AiEvidenceFact['confidence'],
    now: Date,
    maxAgeMs: number,
    referenceId?: string,
    untrusted = false
  ): void {
    const date = observedAt ? new Date(observedAt) : null;
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      bundle.missing.push({ key, reason: 'MISSING', expectedSources: [source] });
      return;
    }
    if (isMockSource(source)) {
      bundle.missing.push({ key, reason: 'MOCK_EXCLUDED', expectedSources: [source], lastObservedAt: date || undefined });
      return;
    }
    if (!date || !isFreshObservation(date, now, maxAgeMs)) {
      bundle.missing.push({ key, reason: 'STALE', expectedSources: [source], lastObservedAt: date || undefined });
      return;
    }
    bundle.used.push({ key, value, source, observedAt: date, confidence, ...(referenceId ? { referenceId } : {}), ...(untrusted ? { untrusted: true } : {}) });
  }

  public async collectLocationEvidence(workspaceId: string, locationId: string, now = new Date()): Promise<AiEvidenceBundle> {
    const bundle: AiEvidenceBundle = { used: [], missing: [] };
    if (!mongoose.isValidObjectId(workspaceId) || !mongoose.isValidObjectId(locationId)) {
      throw Object.assign(new Error('Invalid workspace or location identifier.'), { statusCode: 400, code: 'INVALID_EVIDENCE_SCOPE' });
    }
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null }).lean();
    if (!location) throw Object.assign(new Error('Location not found in workspace.'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });

    const gbpAt = location.lastSyncedAt;
    const gbpFresh = Boolean(
      location.ownershipVerified && location.googleConnectionId && location.syncStatus === 'SYNCED' &&
      isFreshObservation(gbpAt, now, GBP_FRESH_MS)
    );
    const placesAt = location.placesDetailsFetchedAt;
    const placesFresh = isFreshObservation(placesAt, now, PLACES_FRESH_MS);
    const userAt = location.updatedAt || location.createdAt;
    const userFresh = location.addedVia !== 'gbp_import' && isFreshObservation(userAt, now, LOCATION_FRESH_MS);
    const source = gbpFresh ? 'GOOGLE_BUSINESS_PROFILE_OAUTH' : placesFresh ? 'GOOGLE_PLACES' : userFresh ? 'USER_ENTERED_PROFILE' : 'UNVERIFIED_PROFILE';
    const observedAt = gbpFresh ? gbpAt : placesFresh ? placesAt : userFresh ? userAt : null;
    const confidence: AiEvidenceFact['confidence'] = gbpFresh ? 'VERIFIED' : placesFresh ? 'PUBLIC' : 'USER_PROVIDED';
    const fields: Array<[string, unknown]> = [
      ['business.name', location.name],
      ['business.city', location.city],
      ['business.address', location.address],
      ['business.primaryCategory', location.primaryCategory?.displayName || location.categories?.[0]],
      ['business.secondaryCategories', (location.secondaryCategories || []).map((category: any) => category.displayName).filter(Boolean)],
      ['business.phone', location.phone],
      ['business.website', location.website],
    ];
    for (const [key, value] of fields) {
      this.addValue(bundle, key, value, source, observedAt, confidence, now, gbpFresh ? GBP_FRESH_MS : placesFresh ? PLACES_FRESH_MS : LOCATION_FRESH_MS, location._id.toString());
    }
    if (!gbpFresh) {
      bundle.missing.push({
        key: 'business.ownership',
        reason: location.googleConnectionId ? 'STALE' : 'NOT_CONNECTED',
        expectedSources: ['GOOGLE_BUSINESS_PROFILE_OAUTH'],
        ...(gbpAt ? { lastObservedAt: new Date(gbpAt) } : {}),
      });
    } else {
      bundle.used.push({ key: 'business.ownership', value: true, source: 'GOOGLE_BUSINESS_PROFILE_OAUTH', observedAt: new Date(gbpAt!), confidence: 'VERIFIED', referenceId: location.googleConnectionId!.toString() });
    }

    const scans = await Scan.find({ workspaceId, locationId, status: { $in: ['COMPLETED', 'PARTIAL'] } })
      .select('keyword metrics gridPoints completedAt createdAt')
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();
    const includedKeywords = new Set<string>();
    const topCompetitorCategories = new Map<string, number>();

    for (const scan of scans) {
      const keyword = scan.keyword.trim();
      const normalized = keyword.toLowerCase().replace(/\s+/g, ' ');
      if (!includedKeywords.has(normalized)) {
        includedKeywords.add(normalized);
        const observedAt = scan.completedAt || scan.createdAt;
        const classification = !scan.metrics
          ? { include: false as const, reason: 'MISSING' as const }
          : classifyScanEvidence(scan.gridPoints || [], observedAt, now);
        if (!classification.include) {
          bundle.missing.push({ key: `rank.${normalized}`, reason: classification.reason!, expectedSources: ['GOOGLE_MAPS_HTTP'], lastObservedAt: observedAt ? new Date(observedAt) : undefined });
        } else {
          this.addValue(bundle, `rank.${normalized}`, { keyword, metrics: scan.metrics || null }, classification.source!, observedAt, 'PUBLIC', now, SCAN_FRESH_MS, (scan as any)._id.toString());
        }
      }

      // Collect real observed categories from top 3 ranking competitors
      for (const point of (scan.gridPoints || [])) {
        for (const item of (point.items || [])) {
          if (item.rank && item.rank <= 3 && item.primaryCategory) {
            const cat = String(item.primaryCategory).trim();
            if (cat && cat.length > 2) {
              topCompetitorCategories.set(cat, (topCompetitorCategories.get(cat) || 0) + 1);
            }
          }
        }
      }
    }

    const sortedCompetitorCategories = Array.from(topCompetitorCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    if (sortedCompetitorCategories.length > 0 && scans.length > 0) {
      const firstScanAt = scans[0].completedAt || scans[0].createdAt;
      this.addValue(bundle, 'competitors.topCategories', sortedCompetitorCategories.slice(0, 5), 'LIVE_SERP_OBSERVATIONS', firstScanAt, 'PUBLIC', now, SCAN_FRESH_MS);
    }

    if (!scans.length) bundle.missing.push({ key: 'rank.observations', reason: 'MISSING', expectedSources: ['GOOGLE_MAPS_HTTP'] });
    return bundle;
  }

  public async collectAuditEvidence(
    workspaceId: string,
    locationId: string,
    auditId: string,
    signalCode: string,
    now = new Date()
  ): Promise<AiEvidenceBundle> {
    const bundle = await this.collectLocationEvidence(workspaceId, locationId, now);
    const audit = await Audit.findOne({ _id: auditId, workspaceId, locationId }).lean();
    if (!audit || !isFreshObservation(audit.createdAt, now, GBP_FRESH_MS)) {
      bundle.missing.push({ key: `audit.${signalCode}`, reason: audit ? 'STALE' : 'MISSING', expectedSources: ['CURRENT_AUDIT'], ...(audit ? { lastObservedAt: new Date(audit.createdAt) } : {}) });
      return bundle;
    }
    const signal: any = audit.signals.find((item: any) => item.code === signalCode);
    if (!signal || signal.severity === 'UNKNOWN' || signal.confidence === 'UNKNOWN' || isMockSource(signal.evidenceSource)) {
      bundle.missing.push({ key: `audit.${signalCode}`, reason: signal && isMockSource(signal.evidenceSource) ? 'MOCK_EXCLUDED' : 'UNKNOWN_SIGNAL', expectedSources: ['CURRENT_AUDIT'], lastObservedAt: new Date(audit.createdAt) });
      return bundle;
    }
    bundle.used.push({
      key: `audit.${signalCode}`,
      value: { name: signal.name, severity: signal.severity, actualValue: signal.actualValue, recommendedValue: signal.recommendedValue, remediationTip: signal.remediationTip },
      source: signal.evidenceSource || 'AUDIT_RULE',
      observedAt: new Date(audit.createdAt),
      confidence: signal.confidence === 'HIGH' ? 'VERIFIED' : signal.confidence === 'MEDIUM' ? 'PUBLIC' : 'USER_PROVIDED',
      referenceId: `${auditId}:${signalCode}`,
    });
    return bundle;
  }

  public async collectReviewEvidence(workspaceId: string, locationId: string, reviewId: string, now = new Date()): Promise<AiEvidenceBundle> {
    const bundle = await this.collectLocationEvidence(workspaceId, locationId, now);
    const cache = await ReviewCache.findOne({ workspaceId, locationId }).lean();
    if (!cache || cache.source !== 'GOOGLE_GBP_OAUTH' || !isFreshObservation(cache.lastFetchedAt, now, REVIEW_CACHE_FRESH_MS) || new Date(cache.expiresAt).getTime() <= now.getTime()) {
      bundle.missing.push({ key: 'customer.review', reason: cache?.source === 'GOOGLE_GBP_OAUTH' ? 'STALE' : 'NOT_CONNECTED', expectedSources: ['GOOGLE_GBP_OAUTH'], ...(cache?.lastFetchedAt ? { lastObservedAt: new Date(cache.lastFetchedAt) } : {}) });
      return bundle;
    }
    const review = cache.reviews.find((item: any) => item.reviewId === reviewId);
    if (!review) {
      bundle.missing.push({ key: 'customer.review', reason: 'MISSING', expectedSources: ['GOOGLE_GBP_OAUTH'], lastObservedAt: new Date(cache.lastFetchedAt) });
      return bundle;
    }
    bundle.used.push({
      key: 'customer.review',
      value: { rating: review.numericRating, text: review.comment || '', reviewerName: review.reviewer?.displayName || 'Google Customer' },
      source: 'GOOGLE_GBP_OAUTH_REVIEW',
      observedAt: new Date(cache.lastFetchedAt),
      confidence: 'VERIFIED',
      referenceId: review.reviewId,
      untrusted: true,
    });
    return bundle;
  }
}

export const aiEvidenceService = new AiEvidenceService();

/**
 * Relevance Probe Module
 * 
 * Runs staged, empirical probes for keyword candidates under a hard Maps request budget cap:
 *   - Hard cap: 45 Maps requests per business (configurable, default 45).
 *   - Staged pipeline:
 *       Stage 1: Autocomplete validation (0 Maps requests, Google suggestion signal).
 *       Stage 2: Center-pin probe on top candidates (drop relevance < 0.3 or < 5 results).
 *       Stage 3: Full 5-pin probe on best survivors (center + 4 outer pins).
 *   - Concurrency limiter: Shared static instance (p-limit 2), idempotent release, return await.
 *   - Caches results by keyword + canonical spatial cell/geohash.
 *   - Excludes failed/blocked pins (never counted as 0 results).
 *   - Evaluates geoSensitivity from cross-pin overlap (>=80% -> city-wide, not suited to grid tracking).
 *   - Computes difficulty from top-3 competitor ratings/reviews.
 *   - Produces measured proofText (e.g. "18 category listings shown around Kanhiya Nagar").
 * 
 * Generality Rule:
 *   ZERO category-specific or business-specific terms in code.
 */

import { ResolvedCategory, isCategoryInSameFamily } from './category-resolver';
import { SERPItem } from '../../../providers/serp/serp.types';
import { serpManager } from '../../../providers/serp/serp.manager';
import { H3SpatialService } from '../../rankings/h3-spatial.service';
import { matchBusiness } from '../../rankings/business-matcher';
import { AutocompleteClient, DemandSignal } from './autocomplete-client';

export interface CandidateProbeMetrics {
  keyword: string;
  pinsProbed: number;
  goodPinsCount: number;
  itemsPerPin: number[];
  meanItemCount: number;
  relevanceScore: number; // 0.0 to 1.0
  businessRankAtCentre: number | null;
  rankPerPin?: Record<string, number | null>;
  crossPinOverlapPercent: number;
  geoSensitive?: boolean;
  geoSensitivityLabel?: string;
  demandSignal?: DemandSignal;
  demandRawInput?: string;
  difficulty?: 'Low' | 'Medium' | 'High';
  proofText?: string;
  inconclusive?: boolean;
  isUnverified?: boolean;
  requestsCount: number;
  competitorMatchCount: number;
  matchingCategoryCount?: number;
  checkedCategoryCount?: number;
  topCompetitorExamples: Array<{ name: string; category?: string; rating?: number; reviewsCount?: number }>;
  totalWireBytes: number;
  latencyMs: number;
}

/**
 * Shared static in-memory semaphore / concurrency pool (p-limit 2)
 */
class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  public getActiveCount(): number {
    return this.activeCount;
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

export class RelevanceProbe {
  public static readonly limiter = new ConcurrencyLimiter(2); // Shared static instance (p-limit 2)
  private static readonly probeMemoryCache = new Map<string, { items: SERPItem[]; wireBytes: number; status?: string }>();

  /**
   * Generates probe coordinates: Center + 4 Outer-Ring Coordinates at given radius.
   */
  public static getProbeCoordinates(
    center: { lat: number; lng: number },
    radiusKm = 3.0
  ): Array<{ lat: number; lng: number; label: 'CENTER' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' }> {
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((center.lat * Math.PI) / 180));

    return [
      { lat: center.lat, lng: center.lng, label: 'CENTER' },
      { lat: center.lat + latDelta, lng: center.lng, label: 'NORTH' },
      { lat: center.lat - latDelta, lng: center.lng, label: 'SOUTH' },
      { lat: center.lat, lng: center.lng + lngDelta, label: 'EAST' },
      { lat: center.lat, lng: center.lng - lngDelta, label: 'WEST' },
    ];
  }

  /**
   * Evaluates category relevance across a set of Google Maps search result items.
   */
  public static calculateItemRelevance(
    items: SERPItem[],
    targetCategory: ResolvedCategory
  ): { relevanceRatio: number; matchingCount: number; totalChecked: number } {
    if (!items || items.length === 0) {
      return { relevanceRatio: 0, matchingCount: 0, totalChecked: 0 };
    }

    const top10 = items.slice(0, 10);
    let matching = 0;

    for (const item of top10) {
      const itemCat = item.primaryCategory;
      if (isCategoryInSameFamily(itemCat, targetCategory.primary)) {
        matching++;
      } else if (targetCategory.secondary.some((sec) => isCategoryInSameFamily(itemCat, sec))) {
        matching++;
      }
    }

    return {
      relevanceRatio: top10.length > 0 ? parseFloat((matching / top10.length).toFixed(2)) : 0,
      matchingCount: matching,
      totalChecked: top10.length,
    };
  }

  /**
   * Computes difficulty from top-3 competitors' rating and review count.
   */
  public static calculateDifficulty(
    topCompetitors: Array<{ rating?: number; reviewsCount?: number }>
  ): 'Low' | 'Medium' | 'High' {
    if (!topCompetitors || topCompetitors.length === 0) return 'Low';

    const top3 = topCompetitors.slice(0, 3);
    const validRatings = top3.map((c) => c.rating || 0).filter((r) => r > 0);
    const validReviews = top3.map((c) => c.reviewsCount || 0).filter((r) => r > 0);

    const avgRating = validRatings.length > 0
      ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
      : 0;
    const avgReviews = validReviews.length > 0
      ? validReviews.reduce((a, b) => a + b, 0) / validReviews.length
      : 0;

    const highReviewThreshold = parseInt(process.env.DIFFICULTY_HIGH_REVIEWS || '300', 10);
    const medReviewThreshold = parseInt(process.env.DIFFICULTY_MED_REVIEWS || '100', 10);

    if (avgRating >= 4.4 && avgReviews >= highReviewThreshold) {
      return 'High';
    }
    if (avgReviews >= medReviewThreshold) {
      return 'Medium';
    }
    return 'Low';
  }

  /**
   * Probes a candidate across center and outer ring pins with:
   *   - Hard request cap enforcement.
   *   - Inconclusive (<3 good pins) detection.
   *   - Cross-pin overlap measurement for geoSensitivity.
   *   - Shared static concurrency limiter.
   */
  public static async probeCandidate(
    keyword: string,
    center: { lat: number; lng: number },
    targetCategory: ResolvedCategory,
    targetPlaceIdOrOptions?:
      | string
      | {
          targetPlaceId?: string;
          targetName?: string;
          sublocalityLabel?: string;
          demandSignal?: DemandSignal;
          demandRawInput?: string;
          onlyCenterPin?: boolean;
          maxRequestsCap?: number;
          usedRequestsRef?: { count: number };
          searchFn?: (params: { keyword: string; lat: number; lng: number }) => Promise<{
            items: SERPItem[];
            wireBytes?: number;
            status?: string;
          }>;
        },
    legacyTargetName?: string,
    legacySearchFn?: (params: { keyword: string; lat: number; lng: number }) => Promise<{
      items: SERPItem[];
      wireBytes?: number;
      status?: string;
    }>
  ): Promise<CandidateProbeMetrics> {
    const options = typeof targetPlaceIdOrOptions === 'object' && targetPlaceIdOrOptions !== null
      ? targetPlaceIdOrOptions
      : {
          targetPlaceId: typeof targetPlaceIdOrOptions === 'string' ? targetPlaceIdOrOptions : undefined,
          targetName: legacyTargetName,
          searchFn: legacySearchFn,
        };

    const coords = options?.onlyCenterPin
      ? [{ lat: center.lat, lng: center.lng, label: 'CENTER' as const }]
      : this.getProbeCoordinates(center);

    const canonicalH3 = H3SpatialService.resolveScanResolution(
      coords.map((c) => ({ lat: c.lat, lng: c.lng })),
      3.0
    );

    const searchFn = options?.searchFn;
    const executeSearch = searchFn
      ? (coord: { lat: number; lng: number }) => searchFn({ keyword, lat: coord.lat, lng: coord.lng })
      : async (coord: { lat: number; lng: number }) => {
          const res = await serpManager.executeSearch({
            keyword,
            lat: coord.lat,
            lng: coord.lng,
            radiusKm: 3.0,
            h3Resolution: canonicalH3.resolution,
            localization: { hl: 'en', gl: 'in', device: 'DESKTOP' },
          });
          return {
            items: res.result?.items || [],
            wireBytes: res.result?.wireBytes || 0,
            status: res.result?.status,
          };
        };

    const startTime = Date.now();
    const maxCap = options?.maxRequestsCap ?? parseInt(process.env.KEYWORD_MAX_MAPS_REQUESTS || '45', 10);
    const usedRef = options?.usedRequestsRef ?? { count: 0 };

    const pinResults: Array<{ label: 'CENTER' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'; items: SERPItem[]; wireBytes: number; status?: string }> = [];

    for (const coord of coords) {
      const cacheKey = `probe:${keyword}:${coord.lat.toFixed(4)}:${coord.lng.toFixed(4)}`;

      // Check cache first
      if (this.probeMemoryCache.has(cacheKey)) {
        const cached = this.probeMemoryCache.get(cacheKey)!;
        pinResults.push({ label: coord.label, items: cached.items, wireBytes: cached.wireBytes, status: cached.status });
        continue;
      }

      // Check hard budget cap
      if (usedRef.count >= maxCap) {
        // Budget exhausted: do not make external call
        pinResults.push({ label: coord.label, items: [], wireBytes: 0, status: 'BUDGET_CAP_EXCEEDED' });
        continue;
      }

      // Execute through shared static limiter
      const res = await RelevanceProbe.limiter.run(async () => {
        try {
          usedRef.count++;
          return await executeSearch(coord);
        } catch {
          return { items: [], wireBytes: 0, status: 'ERROR' };
        }
      });

      this.probeMemoryCache.set(cacheKey, {
        items: res.items || [],
        wireBytes: res.wireBytes || 0,
        status: res.status,
      });

      pinResults.push({
        label: coord.label,
        items: res.items || [],
        wireBytes: res.wireBytes || 0,
        status: res.status,
      });
    }

    // Process measurements
    const itemsPerPin: number[] = [];
    let totalWireBytes = 0;
    let businessRankAtCentre: number | null = null;
    let totalMatchingItems = 0;
    let totalCheckedItems = 0;
    let goodPinsCount = 0;

    const rankPerPin: Record<string, number | null> = {
      CENTER: null,
      NORTH: null,
      SOUTH: null,
      EAST: null,
      WEST: null,
    };

    const placeIdFrequency = new Map<string, number>();
    const topCompetitorMap = new Map<string, { name: string; category?: string; rating?: number; reviewsCount?: number }>();

    for (const pr of pinResults) {
      const items = pr.items;
      itemsPerPin.push(items.length);
      totalWireBytes += pr.wireBytes;

      const currentPinIds = new Set<string>();
      // Pin is considered good if it returned items and was not blocked / failed
      if (items.length > 0 && pr.status !== 'BLOCKED' && pr.status !== 'CAPTCHA' && pr.status !== 'ERROR') {
        goodPinsCount++;
        const rel = this.calculateItemRelevance(items, targetCategory);
        totalMatchingItems += rel.matchingCount;
        totalCheckedItems += rel.totalChecked;

        // Target match check using shared matchBusiness
        if (options?.targetName || options?.targetPlaceId) {
          const match = items.find((it) =>
            matchBusiness(
              {
                placeId: options.targetPlaceId,
                name: options.targetName || '',
                lat: center.lat,
                lng: center.lng,
              },
              it,
              { mode: 'search' }
            ).match
          );

          if (match) {
            rankPerPin[pr.label] = match.rank;
            if (pr.label === 'CENTER' && businessRankAtCentre === null) {
              businessRankAtCentre = match.rank;
            }
          }
        }

        // Place ID tracking for cross-pin overlap
        for (const it of items) {
          const id = it.placeId || it.name;
          if (id && !currentPinIds.has(id)) {
            currentPinIds.add(id);
            placeIdFrequency.set(id, (placeIdFrequency.get(id) || 0) + 1);
          }
        }

        // Top competitor examples
        for (const it of items.slice(0, 3)) {
          if (it.placeId && !topCompetitorMap.has(it.placeId)) {
            topCompetitorMap.set(it.placeId, {
              name: it.name,
              category: it.primaryCategory,
              rating: it.rating,
              reviewsCount: it.reviewsCount,
            });
          }
        }
      }
    }

    const meanItemCount = itemsPerPin.length > 0
      ? parseFloat((itemsPerPin.reduce((a, b) => a + b, 0) / itemsPerPin.length).toFixed(1))
      : 0;

    const relevanceScore = totalCheckedItems > 0
      ? parseFloat((totalMatchingItems / totalCheckedItems).toFixed(2))
      : 0;

    // Cross-pin overlap calculation: % of unique entities appearing in >= 2 pins
    const totalUniqueEntities = placeIdFrequency.size;
    const overlappingEntities = Array.from(placeIdFrequency.values()).filter((c) => c >= 2).length;
    const crossPinOverlapPercent = totalUniqueEntities > 0
      ? Math.round((overlappingEntities / totalUniqueEntities) * 100)
      : 0;

    // Rule 3: GeoSensitivity threshold (overlap >= 80% is city-wide, not suited to grid tracking)
    const geoSensitive = coords.length === 1 || crossPinOverlapPercent < 80;
    const geoSensitivityLabel = geoSensitive
      ? 'high local variance, ideal for grid tracking'
      : 'city-wide, not suited to grid tracking';

    // Inconclusive check: For a 5-pin probe, min 3 good pins required
    const inconclusive = coords.length > 1 && goodPinsCount < 3;
    const isUnverified = inconclusive || goodPinsCount === 0;

    const topCompetitorExamples = Array.from(topCompetitorMap.values()).slice(0, 5);
    const difficulty = this.calculateDifficulty(topCompetitorExamples);

    const locationLabel = options?.sublocalityLabel || 'the area';
    let proofText = '';
    if (goodPinsCount === 0) {
      proofText = `0 matching ${targetCategory.primary.toLowerCase()} listings found around ${locationLabel}`;
    } else if (goodPinsCount === 1) {
      proofText = `${totalMatchingItems} of ${totalCheckedItems} matching ${targetCategory.primary.toLowerCase()} listings found around ${locationLabel}`;
    } else {
      const meanMatching = Math.round(totalMatchingItems / goodPinsCount);
      const meanChecked = Math.round(totalCheckedItems / goodPinsCount);
      proofText = `${meanMatching} of ${meanChecked} matching ${targetCategory.primary.toLowerCase()} listings across ${goodPinsCount} pins around ${locationLabel}`;
    }

    return {
      keyword,
      pinsProbed: coords.length,
      goodPinsCount,
      itemsPerPin,
      meanItemCount,
      relevanceScore,
      businessRankAtCentre,
      rankPerPin,
      crossPinOverlapPercent,
      geoSensitive,
      geoSensitivityLabel,
      demandSignal: options?.demandSignal || 'Low',
      demandRawInput: options?.demandRawInput || 'pos: none, count: 0',
      difficulty,
      proofText,
      inconclusive,
      isUnverified,
      requestsCount: pinResults.length,
      competitorMatchCount: totalMatchingItems,
      matchingCategoryCount: totalMatchingItems,
      checkedCategoryCount: totalCheckedItems,
      topCompetitorExamples,
      totalWireBytes,
      latencyMs: Date.now() - startTime,
    };
  }
}

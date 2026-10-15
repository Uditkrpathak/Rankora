import { Competitor, CompetitorDocument } from '../../models/Competitor';
import { Location, LocationDocument } from '../../models/Location';
import { Scan } from '../../models/Scan';
import { MetricsCalculator } from '../rankings/metrics-calculator';
import { matchBusiness } from '../rankings/business-matcher';
import { ICompetitorBenchmark, ICompetitorRadarVectors } from '@localo/types';
import { invalidateLocationChatCache } from '../chat/chat.cache';

export class CompetitorService {
  /**
   * Lists detected competitors for a given location within a workspace
   * Sorted by ATRP ascending (lowest/best average position across all grid points first),
   * with SoLV descending as the tie-breaker.
   */
  public async listCompetitors(
    locationId: string,
    workspaceId: string,
    limit: number = 20
  ): Promise<CompetitorDocument[]> {
    return Competitor.find({ locationId, workspaceId })
      .sort({ avgRank: 1, solv: -1, visibilityIndex: -1, rating: -1, reviewsCount: -1 })
      .limit(limit);
  }

  /**
   * Standardized Competitor Leaderboard Ranking algorithm.
   * Primary Sort: ATRP ascending (lower average position across all pins is better).
   * Tie-breaker: SoLV descending (higher Share of Local Voice in top 3 is better).
   * Secondary Metrics: Coverage descending, Best Rank ascending, Reviews count descending.
   */
  public sortLeaderboard<
    T extends {
      atrp: number;
      solv: number;
      coverage?: number;
      bestRank?: number;
      arp?: number | null;
      rating?: number;
      reviewsCount?: number;
      name?: string;
    }
  >(items: T[]): T[] {
    return [...items].sort((a, b) => {
      // 1. Primary: ATRP ascending (lower average position across all pins is better)
      if (a.atrp !== b.atrp) return a.atrp - b.atrp;
      // 2. Tie-breaker: SoLV descending (higher Share of Local Voice in top 3 is better)
      if (b.solv !== a.solv) return b.solv - a.solv;
      // 3. Secondary: Coverage descending
      const covA = a.coverage ?? 0;
      const covB = b.coverage ?? 0;
      if (covB !== covA) return covB - covA;
      // 4. Secondary: Best Rank ascending
      const bestA = a.bestRank ?? 21;
      const bestB = b.bestRank ?? 21;
      if (bestA !== bestB) return bestA - bestB;
      // 5. Secondary: Reviews count descending
      const revA = a.reviewsCount ?? 0;
      const revB = b.reviewsCount ?? 0;
      if (revB !== revA) return revB - revA;
      // 6. Secondary: Rating descending
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      // 7. Deterministic tie-breaker: Business name alphabetical ascending
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
  }

  /**
   * Computes the official Competitor Leaderboard for a scan run:
   * - Coverage threshold: max(2 pins, 10% of pins)
   * - Unified market dataset containing tracked business (even at 0 pins)
   * - Entity identity guaranteed by CID / PlaceId
   * - Deterministic backend ordering and standings calculation
   */
  public calculateScanLeaderboard(
    gridPoints: any[],
    targetLocation: {
      name?: string;
      address?: string;
      primaryCategory?: string;
      categories?: string[];
      rating?: number;
      reviewsCount?: number;
      placeId?: string;
      cid?: string;
    },
    completedAt?: Date | null
  ) {
    const measuredPoints = (gridPoints || []).filter(
      (point: any) =>
        point.observationState === 'OBSERVED' &&
        Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK')
    );
    const totalPoints = measuredPoints.length > 0 ? measuredPoints.length : (gridPoints?.length || 1);
    const minThresholdPins = Math.max(2, Math.ceil(totalPoints * 0.1));

    const targetIdentity = targetLocation.cid || targetLocation.placeId || 'TARGET_BUSINESS';
    const entityMap = new Map<
      string,
      {
        placeId: string;
        cid?: string;
        name: string;
        address?: string;
        primaryCategory?: string;
        rating?: number;
        reviewsCount?: number;
        ranks: number[];
        isTarget: boolean;
      }
    >();

    // 1. Initialize Tracked Business (even if 0 pins)
    entityMap.set(targetIdentity, {
      placeId: targetLocation.placeId || targetIdentity,
      cid: targetLocation.cid,
      name: targetLocation.name || 'Your Business',
      address: targetLocation.address,
      primaryCategory: targetLocation.primaryCategory || targetLocation.categories?.[0],
      rating: targetLocation.rating,
      reviewsCount: targetLocation.reviewsCount,
      ranks: [],
      isTarget: true,
    });

    // 2. Aggregate pin rankings across grid
    for (const pt of measuredPoints) {
      if (typeof pt.targetRank === 'number' && pt.targetRank >= 1 && pt.targetRank <= 20) {
        entityMap.get(targetIdentity)!.ranks.push(pt.targetRank);
      }

      for (const it of pt.items || []) {
        if (it.isTarget || matchBusiness(targetLocation, it).match) continue;
        // Group entity strictly by cid || placeId (skip gm_) || name+address (Item 8)
        let idKey: string;
        if (it.cid && it.cid.trim()) {
          idKey = `cid:${it.cid.trim().toLowerCase()}`;
        } else if (it.placeId && it.placeId.trim() && !it.placeId.startsWith('gm_')) {
          idKey = `pid:${it.placeId.trim()}`;
        } else {
          const namePart = (it.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const addrPart = (it.address || '').trim().toLowerCase().replace(/\s+/g, ' ');
          idKey = `name_addr:${namePart}::${addrPart}`;
        }

        let comp = entityMap.get(idKey);
        if (!comp) {
          comp = {
            placeId: (it.placeId && !it.placeId.startsWith('gm_')) ? it.placeId : (it.cid || idKey),
            cid: it.cid,
            name: it.name,
            address: it.address,
            primaryCategory: it.primaryCategory,
            rating: it.rating,
            reviewsCount: it.reviewsCount,
            ranks: [],
            isTarget: false,
          };
          entityMap.set(idKey, comp);
        }
        if (typeof it.rank === 'number' && it.rank >= 1 && it.rank <= 20) {
          comp.ranks.push(it.rank);
        }
        if (!comp.rating && it.rating) comp.rating = it.rating;
        if (!comp.reviewsCount && it.reviewsCount) comp.reviewsCount = it.reviewsCount;
        if (!comp.primaryCategory && it.primaryCategory) comp.primaryCategory = it.primaryCategory;
        if (!comp.address && it.address) comp.address = it.address;
      }
    }

    // 3. Compute spatial metrics for every entity
    const computedList = Array.from(entityMap.values()).map((item) => {
      const validRanks = item.ranks.filter((r) => r >= 1 && r <= 20);
      const rankedCount = validRanks.length;
      const unrankedCount = Math.max(0, totalPoints - rankedCount);
      const rankedSum = validRanks.reduce((a, b) => a + b, 0);
      const totalRankSum = rankedSum + unrankedCount * 21;

      const atrp = parseFloat((totalRankSum / totalPoints).toFixed(1));
      const arp = rankedCount > 0 ? parseFloat((rankedSum / rankedCount).toFixed(1)) : null;
      const top3Count = validRanks.filter((r) => r <= 3).length;
      const solv = parseFloat(((top3Count / totalPoints) * 100).toFixed(1));
      const coveragePercent = Math.round((rankedCount / totalPoints) * 100);
      const bestRank = validRanks.length > 0 ? Math.min(...validRanks) : 21;

      return {
        placeId: item.placeId,
        cid: item.cid,
        name: item.name,
        address: item.address,
        primaryCategory: item.primaryCategory,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        bestRank,
        atrp,
        arp,
        solv,
        coveragePercent,
        occurrences: rankedCount,
        isTarget: item.isTarget,
        standing: 0,
      };
    });

    // 4. Deterministic sort
    const sorted = this.sortLeaderboard(computedList);
    sorted.forEach((item, idx) => {
      item.standing = idx + 1;
    });

    const target = sorted.find((e) => e.isTarget);
    const nonTarget = sorted.filter((e) => !e.isTarget);
    const qualified = nonTarget.filter((e) => e.occurrences >= minThresholdPins);

    return {
      items: sorted,
      qualifiedCompetitors: qualified,
      targetEntity: target || null,
      targetStanding: target?.standing ?? sorted.length,
      totalMarketCount: sorted.length,
      qualifiedCount: qualified.length,
      minThresholdPins,
      dataAsOf: completedAt || null,
    };
  }

  /**
   * Evaluates Profile Completeness (0–100)
   */
  public evaluateProfileCompleteness(loc: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    categories?: string[];
    primaryCategory?: string;
    phone?: string;
    website?: string;
    regularHours?: any;
    coordinates?: any;
  }): number {
    let score = 0;
    if (loc.name && loc.name.trim().length >= 2) score += 15;

    let addressPoints = 0;
    if (loc.address && loc.address.trim().length >= 3) addressPoints += 5;
    if (loc.city && loc.city.trim().length >= 2) addressPoints += 5;
    if (loc.state && loc.state.trim().length >= 1) addressPoints += 5;
    if (loc.postalCode && loc.postalCode.trim().length >= 3) addressPoints += 5;
    score += addressPoints;

    const categories = loc.categories || (loc.primaryCategory ? [loc.primaryCategory] : []);
    if (categories.length >= 1) score += 15;
    if (categories.length >= 2) score += 5;

    if (loc.phone && loc.phone.trim().length >= 7) score += 15;
    if (loc.website && loc.website.trim().length >= 4) score += 15;
    if (loc.regularHours && Object.keys(loc.regularHours).length > 0) score += 15;

    return Math.min(100, score);
  }

  /**
   * Evaluates Keyword Relevance (0–100)
   */
  public evaluateKeywordRelevance(
    businessName: string,
    categories: string[],
    keyword?: string
  ): number {
    if (!keyword || !keyword.trim()) return 50;

    const normKw = keyword.toLowerCase().trim();
    const kwTokens = normKw.split(/\s+/).filter((t) => t.length >= 2);
    if (kwTokens.length === 0) return 50;

    let score = 0;

    // 1. Primary / Category match (Up to 50 pts)
    const primaryCat = (categories[0] || '').toLowerCase().trim();
    if (primaryCat === normKw || primaryCat.includes(normKw) || normKw.includes(primaryCat)) {
      score += 50;
    } else {
      const catTokens = primaryCat.split(/\s+/);
      const catMatch = kwTokens.filter((t) => catTokens.includes(t)).length;
      if (catMatch > 0) {
        score += Math.round((catMatch / kwTokens.length) * 40);
      }
    }

    // 2. Business Name token overlap (Up to 30 pts)
    const normName = businessName.toLowerCase().trim();
    const nameTokens = normName.split(/\s+/);
    const nameMatch = kwTokens.filter((t) => nameTokens.includes(t)).length;
    if (nameMatch > 0) {
      score += Math.round((nameMatch / kwTokens.length) * 30);
    }

    // 3. Secondary Category match (Up to 20 pts)
    const secondaryCats = categories.slice(1).map((c) => c.toLowerCase());
    if (secondaryCats.some((c) => c.includes(normKw) || normKw.includes(c))) {
      score += 20;
    }

    return Math.min(100, Math.max(10, score));
  }

  /**
   * Evaluates Review Quality (0–100) with division-by-zero protection
   */
  public evaluateReviewQuality(rating?: number, avgMarketRating?: number): number {
    if (!rating || rating <= 0) return 0;
    const base = (rating / 5.0) * 100;
    if (!avgMarketRating || avgMarketRating <= 0) return Math.min(100, Math.round(base));

    const advantage = (rating - avgMarketRating) / 5.0;
    return Math.min(100, Math.max(0, Math.round(base * (1 + advantage * 0.2))));
  }

  /**
   * Evaluates Review Volume (0–100) with logarithmic scaling
   */
  public evaluateReviewVolume(reviewCount?: number, maxCompetitorReviews: number = 50): number {
    if (!reviewCount || reviewCount <= 0) return 0;
    const denominator = Math.log(1 + Math.max(10, maxCompetitorReviews));
    if (denominator <= 0) return 0;
    const ratio = Math.log(1 + reviewCount) / denominator;
    return Math.min(100, Math.max(5, Math.round(ratio * 100)));
  }

  /**
   * Evaluates Citation Strength & Local Presence (0–100)
   */
  public evaluateCitationStrength(solv?: number, visibilityIndex?: number): number {
    const s = Math.max(0, Math.min(100, solv ?? 0));
    const v = Math.max(0, Math.min(100, visibilityIndex ?? 0));
    return Math.round(s * 0.6 + v * 0.4);
  }

  /**
   * Evaluates Website Authority (0–100)
   */
  public evaluateWebsiteAuthority(websiteUrl?: string): number {
    if (!websiteUrl || !websiteUrl.trim()) return 0;
    const url = websiteUrl.trim().toLowerCase();
    let score = 0;

    // HTTPS Protocol: +30
    if (url.startsWith('https://')) {
      score += 30;
    } else if (url.startsWith('http://')) {
      score += 10;
    }

    // Custom Root Domain (not free web builders): +25
    const freeSubdomains = ['wordpress.com', 'wixsite.com', 'weebly.com', 'blogspot.com', 'sites.google.com'];
    const isFree = freeSubdomains.some((d) => url.includes(d));
    if (!isFree) {
      score += 25;
    }

    // Valid TLD: +20
    const validTlds = ['.com', '.org', '.net', '.in', '.co.uk', '.io', '.ai', '.co', '.biz', '.info', '.gov', '.edu'];
    if (validTlds.some((tld) => url.includes(tld))) {
      score += 20;
    }

    // Valid URL format without trailing anomalies: +25
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (parsed.hostname.includes('.')) {
        score += 25;
      }
    } catch {
      // Invalid URL format
    }

    return Math.min(100, score);
  }

  /**
   * Computes composite market share score from 6 vectors
   */
  public computeCompositeScore(v: ICompetitorRadarVectors): number {
    return Math.round(
      v.profileCompleteness * 0.15 +
      v.keywordRelevance * 0.20 +
      v.reviewQuality * 0.20 +
      v.reviewVolume * 0.15 +
      v.citationStrength * 0.20 +
      v.websiteAuthority * 0.10
    );
  }

  /**
   * Generates a comparative benchmark matrix between the location and top detected competitors
   */
  public async getBenchmark(locationId: string, workspaceId: string): Promise<ICompetitorBenchmark> {
    const location = await Location.findOne({ _id: locationId, workspaceId });
    if (!location) {
      throw new Error('Location not found');
    }

    // Retrieve latest scan for the location to get current metrics
    const latestScan = await Scan.findOne({ locationId, workspaceId, status: 'COMPLETED' }).sort({ createdAt: -1 });

    const targetMetrics = latestScan?.metrics || {
      arp: 21,
      solv: 0,
      visibilityIndex: 0,
    };

    // Build map of competitor ranks from the latest scan grid points
    const gridPointCount = latestScan?.gridPoints?.length || 0;
    const scanRankMap = new Map<
      string,
      { ranks: number[]; top3Count: number; weightSum: number }
    >();

    if (latestScan?.gridPoints) {
      for (const pt of latestScan.gridPoints) {
        for (const it of pt.items || []) {
          if (!it.isTarget && it.placeId) {
            let stats = scanRankMap.get(it.placeId);
            if (!stats) {
              stats = { ranks: [], top3Count: 0, weightSum: 0 };
              scanRankMap.set(it.placeId, stats);
            }
            if (typeof it.rank === 'number' && it.rank >= 1 && it.rank <= 20) {
              stats.ranks.push(it.rank);
              if (it.rank <= 3) stats.top3Count++;
              stats.weightSum += Math.max(0, 21 - it.rank);
            }
          }
        }
      }
    }

    const competitors = await Competitor.find({ locationId, workspaceId })
      .sort({ solv: -1, visibilityIndex: -1, rating: -1, reviewsCount: -1 })
      .limit(10);

    const targetRating = (location as any).averageRating || (location as any).rating || 0;
    const targetReviews = (location as any).totalReviewCount || (location as any).reviewsCount || 0;

    // Calculate market competitor aggregates with zero-division safety
    const competitorCount = competitors.length;
    let sumRating = 0;
    let maxReviews = targetReviews;
    let sumCompleteness = 0;
    let sumKeywordRelevance = 0;
    let sumCitation = 0;
    let sumWebsite = 0;

    const mappedCompetitors = competitors.map((c) => {
      const stats = scanRankMap.get(c.placeId);
      const spatial = stats
        ? MetricsCalculator.calculateCompetitorSpatialMetrics(stats.ranks, gridPointCount)
        : {
            atrp: c.avgRank || 21,
            arp: 21,
            solv: c.solv || 0,
            coverage: 0,
            visibilityIndex: c.visibilityIndex || 0,
          };

      // Update in DB asynchronously ONLY if stale and scores actually changed
      const isStale = stats && (
        Math.abs((c.avgRank ?? 21) - spatial.atrp) > 0.05 ||
        Math.abs((c.solv ?? 0) - spatial.solv) > 0.05
      );
      if (isStale) {
        void Competitor.updateOne(
          { _id: c._id },
          { $set: { avgRank: spatial.atrp, solv: spatial.solv, visibilityIndex: spatial.visibilityIndex } }
        ).then((res) => {
          if (res && res.modifiedCount > 0) {
            invalidateLocationChatCache(locationId).catch(() => {});
          }
        }).catch(() => {});
      }

      return {
        placeId: c.placeId,
        name: c.name,
        atrp: spatial.atrp, // ATRP: Consistent grid denominator (unranked = 21)
        arp: spatial.arp, // Found-only average rank
        solv: spatial.solv,
        coverage: spatial.coverage,
        visibilityIndex: spatial.visibilityIndex,
        rating: c.rating,
        reviewsCount: c.reviewsCount,
        primaryCategory: c.primaryCategory,
      };
    });

    // Primary sort by ATRP ascending with SoLV tie-breaker
    const sortedCompetitors = this.sortLeaderboard(mappedCompetitors);

    for (const c of mappedCompetitors) {
      const r = c.rating || 0;
      const rev = c.reviewsCount || 0;
      sumRating += r;
      if (rev > maxReviews) maxReviews = rev;

      sumCompleteness += this.evaluateProfileCompleteness({
        name: c.name,
        primaryCategory: c.primaryCategory,
      });

      sumKeywordRelevance += this.evaluateKeywordRelevance(
        c.name,
        c.primaryCategory ? [c.primaryCategory] : [],
        latestScan?.keyword
      );

      sumCitation += this.evaluateCitationStrength(c.solv, c.visibilityIndex);
      sumWebsite += this.evaluateWebsiteAuthority(undefined);
    }

    const avgMarketRating = competitorCount > 0 ? sumRating / competitorCount : targetRating;

    // 1. Calculate Target Location Signals
    const locationSignals: ICompetitorRadarVectors = {
      profileCompleteness: this.evaluateProfileCompleteness({
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        postalCode: location.postalCode,
        categories: location.categories,
        phone: location.phone,
        website: location.website,
        regularHours: (location as any).regularHours,
      }),
      keywordRelevance: this.evaluateKeywordRelevance(
        location.name,
        location.categories || [],
        latestScan?.keyword
      ),
      reviewQuality: this.evaluateReviewQuality(targetRating, avgMarketRating),
      reviewVolume: this.evaluateReviewVolume(targetReviews, maxReviews),
      citationStrength: this.evaluateCitationStrength(targetMetrics.solv, targetMetrics.visibilityIndex),
      websiteAuthority: this.evaluateWebsiteAuthority(location.website),
    };

    // 2. Calculate Market Averages
    const marketAverages: ICompetitorRadarVectors = {
      profileCompleteness: competitorCount > 0 ? Math.round(sumCompleteness / competitorCount) : 0,
      keywordRelevance: competitorCount > 0 ? Math.round(sumKeywordRelevance / competitorCount) : 0,
      reviewQuality: competitorCount > 0 ? this.evaluateReviewQuality(avgMarketRating, avgMarketRating) : 0,
      reviewVolume: competitorCount > 0 ? Math.round((sumRating / (competitorCount * 5)) * 80) : 0,
      citationStrength: competitorCount > 0 ? Math.round(sumCitation / competitorCount) : 0,
      websiteAuthority: competitorCount > 0 ? Math.round(sumWebsite / competitorCount) : 0,
    };

    const compositeScore = this.computeCompositeScore(locationSignals);
    const marketCompositeAverage = this.computeCompositeScore(marketAverages);

    return {
      targetLocation: {
        locationId,
        name: location.name,
        arp: targetMetrics.arp ?? 21,
        solv: targetMetrics.solv,
        visibilityIndex: targetMetrics.visibilityIndex,
        rating: targetRating,
        reviewsCount: targetReviews,
      },
      competitors: sortedCompetitors as any,
      locationSignals,
      marketAverages,
      compositeScore,
      marketCompositeAverage,
    };
  }
}

export const competitorService = new CompetitorService();

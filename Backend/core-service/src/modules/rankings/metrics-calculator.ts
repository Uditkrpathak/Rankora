import { IGridPointResult, IRankMetrics, IRankItem } from '@localo/types';

export type PinState =
  | { type: 'RANKED'; rank: number }
  | { type: 'NOT_IN_TOP_20' }
  | { type: 'NO_RESULTS' }
  | { type: 'TECHNICAL_FAILURE'; error?: string };

export interface ICompetitorSpatialMetrics {
  atrp: number; // Average Total Rank Position across measured grid points (unranked = 21)
  arp: number | null; // Average Rank Position only across nodes where ranked in top 20 (null if unranked)
  solv: number; // Share of Local Voice (% of measured grid points with rank <= 3)
  coverage: number; // % of measured grid points with rank <= 20
  visibilityIndex: number; // Sum(max(0, 21 - rank)) / (measuredPoints * 20) * 100
}

export class MetricsCalculator {
  /**
   * Classifies a grid point into one of four deterministic states:
   * - RANKED(rank): Target is found in the top 20 local pack.
   * - NOT_IN_TOP_20: Provider returned valid search results, but target is unranked (>20).
   * - NO_RESULTS: Provider executed successfully, but 0 places exist at this coordinate.
   * - TECHNICAL_FAILURE: Request timed out, proxy died, or was blocked upstream.
   */
  public static classifyPinState(pt: IGridPointResult): PinState {
    if (pt.observationState === 'MISSING' || (pt.error && (!pt.items || pt.items.length === 0))) {
      return { type: 'TECHNICAL_FAILURE', error: pt.error || 'Measurement unavailable' };
    }
    if (typeof pt.targetRank === 'number' && pt.targetRank >= 1 && pt.targetRank <= 20) {
      return { type: 'RANKED', rank: pt.targetRank };
    }
    if (pt.items && pt.items.length > 0) {
      return { type: 'NOT_IN_TOP_20' };
    }
    return { type: 'NO_RESULTS' };
  }

  /**
   * Calculates standardized spatial rank aggregation metrics for a scan run.
   * - measured = RANKED + NOT_IN_TOP_20 + NO_RESULTS
   * - coverage = (measured / total) * 100
   * - SoLV = top-3 pins / measured pins
   * - ATRP / ARP = average rank over measured pins only (never dividing unmeasured/failed pins)
   */
  public static calculate(gridPoints: IGridPointResult[]): IRankMetrics {
    // Exclude duplicate-cell pins from all rank metrics calculations (Item B.1)
    const effectivePoints = gridPoints.filter(
      (pt) => !pt.isDuplicateCell && pt.pinStatus !== 'DUPLICATE'
    );
    const totalPoints = effectivePoints.length;
    if (totalPoints === 0) {
      return {
        arp: null,
        atrp: 21,
        solv: 0,
        coverage: 0,
        visibilityIndex: 0,
        top3Count: 0,
        top10Count: 0,
        top20Count: 0,
        unrankedCount: 0,
        missingCount: 0,
        observedCount: 0,
        totalPoints: 0,
      };
    }

    const rankedRanks: number[] = [];
    let rankedCount = 0;
    let notInTop20Count = 0;
    let noResultsCount = 0;
    let technicalFailureCount = 0;
    let top10Count = 0;

    for (const pt of effectivePoints) {
      const state = MetricsCalculator.classifyPinState(pt);
      switch (state.type) {
        case 'RANKED':
          rankedCount++;
          rankedRanks.push(state.rank);
          if (state.rank <= 10) top10Count++;
          break;
        case 'NOT_IN_TOP_20':
          notInTop20Count++;
          break;
        case 'NO_RESULTS':
          noResultsCount++;
          break;
        case 'TECHNICAL_FAILURE':
          technicalFailureCount++;
          break;
      }
    }

    const measuredCount = rankedCount + notInTop20Count + noResultsCount;
    const missingCount = technicalFailureCount;
    const top3Count = rankedRanks.filter((r) => r <= 3).length;
    const top20Count = rankedCount;
    const unrankedCount = notInTop20Count + noResultsCount;

    let arp: number | null = null;
    let atrp = 21;
    let solv = 0;
    let coverage = 0;
    let visibilityIndex = 0;

    if (measuredCount > 0) {
      arp = rankedCount > 0 ? parseFloat((rankedRanks.reduce((a, b) => a + b, 0) / rankedCount).toFixed(1)) : null;
      const totalRankSum = rankedRanks.reduce((a, b) => a + b, 0) + unrankedCount * 21;
      atrp = parseFloat((totalRankSum / measuredCount).toFixed(1));
      solv = parseFloat(((top3Count / measuredCount) * 100).toFixed(1));
      coverage = parseFloat(((rankedCount / measuredCount) * 100).toFixed(1));
      const totalWeight = rankedRanks.reduce((sum, r) => sum + Math.max(0, 21 - r), 0);
      const maxPossibleWeight = measuredCount * 20;
      visibilityIndex = maxPossibleWeight > 0 ? parseFloat(((totalWeight / maxPossibleWeight) * 100).toFixed(1)) : 0;
    }

    return {
      arp,
      atrp,
      solv,
      coverage,
      visibilityIndex,
      top3Count,
      top10Count,
      top20Count,
      unrankedCount,
      missingCount,
      observedCount: measuredCount,
      totalPoints,
    };
  }

  /**
   * Calculates consistent spatial rank aggregation metrics for any entity (target or competitor) across a grid scan.
   * Ensures consistent denominator across ATRP, SoLV, and Visibility Index using total measured points.
   */
  public static calculateCompetitorSpatialMetrics(
    observedRanks: number[],
    totalMeasuredPoints: number
  ): ICompetitorSpatialMetrics {
    if (totalMeasuredPoints <= 0) {
      return { atrp: 21, arp: null, solv: 0, coverage: 0, visibilityIndex: 0 };
    }

    const validRanks = observedRanks.filter((r) => r >= 1 && r <= 20);
    const rankedCount = validRanks.length;
    const unrankedCount = Math.max(0, totalMeasuredPoints - rankedCount);

    const rankedSum = validRanks.reduce((a, b) => a + b, 0);
    const totalRankSum = rankedSum + unrankedCount * 21;

    const atrp = parseFloat((totalRankSum / totalMeasuredPoints).toFixed(1));
    const arp = rankedCount > 0 ? parseFloat((rankedSum / rankedCount).toFixed(1)) : null;

    const top3Count = validRanks.filter((r) => r <= 3).length;
    const solv = parseFloat(((top3Count / totalMeasuredPoints) * 100).toFixed(1));
    const coverage = parseFloat(((rankedCount / totalMeasuredPoints) * 100).toFixed(1));

    const totalWeight = validRanks.reduce((sum, r) => sum + Math.max(0, 21 - r), 0);
    const maxPossibleWeight = totalMeasuredPoints * 20;
    const visibilityIndex =
      maxPossibleWeight > 0 ? parseFloat(((totalWeight / maxPossibleWeight) * 100).toFixed(1)) : 0;

    return {
      atrp,
      arp,
      solv,
      coverage,
      visibilityIndex,
    };
  }

  /**
   * Calculates the competition difficulty (0-10) for a single grid pin based on
   * the competitive strength, review depth, and rating density of the top 3 ranked businesses.
   */
  public static calculatePinDifficulty(items: IRankItem[]): number {
    if (!items || items.length === 0) {
      return 0;
    }

    const top3 = items.filter((it) => typeof it.rank === 'number' && it.rank >= 1 && it.rank <= 3);
    if (top3.length === 0) {
      return 0;
    }

    // Base score from occupied top-3 pack positions (each spot contributes up to 2.0 pts)
    let score = top3.length * 2.0;

    // Review counts factor
    const reviewCounts = top3
      .map((it) => it.reviewsCount)
      .filter((r): r is number => typeof r === 'number' && !isNaN(r));
    const avgReviews = reviewCounts.length > 0 ? reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length : 0;

    if (avgReviews >= 300) score += 2.5;
    else if (avgReviews >= 100) score += 2.0;
    else if (avgReviews >= 30) score += 1.0;
    else if (avgReviews >= 10) score += 0.5;

    // Ratings factor
    const ratings = top3
      .map((it) => it.rating)
      .filter((r): r is number => typeof r === 'number' && !isNaN(r));
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    if (avgRating >= 4.7) score += 1.5;
    else if (avgRating >= 4.4) score += 1.0;
    else if (avgRating >= 4.0) score += 0.5;

    return Math.min(10, Math.max(0, Math.round(score)));
  }

  /**
   * Rolls up pin-level difficulties to a scan-level area difficulty classification.
   * If scan coverage is < 80%, returns undefined (suppresses Area Difficulty on degraded scans).
   * Median pin difficulty mapped to LOW (0–3), MEDIUM (4–6), HIGH (7–10).
   */
  public static calculateAreaDifficultyRollup(
    gridPoints: IGridPointResult[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
    if (!gridPoints || gridPoints.length === 0) {
      return undefined;
    }

    const effectivePoints = gridPoints.filter((p) => !p.isDuplicateCell && p.pinStatus !== 'DUPLICATE');
    if (effectivePoints.length === 0) return undefined;

    const validPoints = effectivePoints.filter((p) => {
      const state = MetricsCalculator.classifyPinState(p);
      return state.type !== 'TECHNICAL_FAILURE' && typeof p.difficulty === 'number';
    });

    const coverageRatio = validPoints.length / effectivePoints.length;
    if (coverageRatio < 0.8) {
      return undefined; // Incomplete scan (<80% measured points)
    }

    const difficulties = validPoints.map((p) => p.difficulty as number).sort((a, b) => a - b);
    const mid = Math.floor(difficulties.length / 2);
    const median =
      difficulties.length % 2 !== 0
        ? difficulties[mid]
        : (difficulties[mid - 1] + difficulties[mid]) / 2;

    if (median <= 3) {
      return 'LOW';
    } else if (median <= 6) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }
}



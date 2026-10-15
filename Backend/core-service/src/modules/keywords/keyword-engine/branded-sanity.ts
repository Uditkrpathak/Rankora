/**
 * Branded Sanity Check Module
 * 
 * Verifies that the business appears near the top of Google Maps search results
 * when searching for its own exact name at its own registered coordinates.
 * 
 * If unranked or missing, returns flag: LOCATION_OR_PLACE_ID_MISMATCH
 * preventing automated keyword locking on mismatched coordinates.
 */

import { CandidateProbeMetrics } from './relevance-probe';

export interface BrandedSanityResult {
  passed: boolean;
  status: 'VERIFIED' | 'LOCATION_OR_PLACE_ID_MISMATCH' | 'UNPROBED';
  businessRankAtCentre: number | null;
  message: string;
}

export class BrandedSanityCheck {
  public static evaluate(
    brandedProbe: CandidateProbeMetrics | undefined,
    businessName: string
  ): BrandedSanityResult {
    if (!brandedProbe) {
      return {
        passed: false,
        status: 'UNPROBED',
        businessRankAtCentre: null,
        message: `Branded search for "${businessName}" was not probed.`,
      };
    }

    const rank = brandedProbe.businessRankAtCentre;

    if (rank !== null && rank >= 1 && rank <= 5) {
      return {
        passed: true,
        status: 'VERIFIED',
        businessRankAtCentre: rank,
        message: `Verified: "${businessName}" ranks #${rank} at its own location.`,
      };
    }

    return {
      passed: false,
      status: 'LOCATION_OR_PLACE_ID_MISMATCH',
      businessRankAtCentre: rank,
      message: `LOCATION_OR_PLACE_ID_MISMATCH: Business did not rank in top 5 for its own name at its coordinates (rank: ${rank ? `#${rank}` : '20+ / not found'}). Please confirm location pin on map.`,
    };
  }
}

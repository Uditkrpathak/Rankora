/**
 * GBP Real Search Terms Module
 * 
 * Fetches actual search keywords and monthly impression metrics directly from Google
 * using the Business Profile Performance API (ListSearchKeywordImpressionsMonthly)
 * when a verified GBP OAuth connection exists.
 */

export interface GbpSearchKeywordImpression {
  keyword: string;
  monthlyImpressions: number;
  source: 'GBP_REAL_SEARCH';
}

export interface GbpSearchTermsResult {
  available: boolean;
  keywords: GbpSearchKeywordImpression[];
  error?: string;
}

export class GbpRealSearchTermsService {
  /**
   * Fetches real customer search keywords from Google Business Profile Performance API.
   */
  public static async fetchSearchKeywordImpressions(
    gbpLocationId?: string,
    accessToken?: string
  ): Promise<GbpSearchTermsResult> {
    if (!gbpLocationId || !accessToken) {
      return {
        available: false,
        keywords: [],
        error: 'Google Business Profile is not connected or OAuth token is missing.',
      };
    }

    try {
      // Format: locations/{locationId}
      const formattedLocationId = gbpLocationId.startsWith('locations/') ? gbpLocationId : `locations/${gbpLocationId}`;
      const url = `https://businessprofileperformance.googleapis.com/v1/${formattedLocationId}/searchkeywords/impressions/monthly?pageSize=100`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 403 || res.status === 401) {
        return {
          available: false,
          keywords: [],
          error: 'GBP Performance API access required. Enable the Business Profile Performance API in Google Cloud Console and grant business.manage scope.',
        };
      }

      if (!res.ok) {
        const errText = await res.text();
        return {
          available: false,
          keywords: [],
          error: `Google Performance API returned HTTP ${res.status}: ${errText}`,
        };
      }

      const data = await res.json();
      const results: GbpSearchKeywordImpression[] = [];

      for (const item of data.searchKeywordsCounts || []) {
        const kw = item.searchKeyword?.trim();
        const impressions = item.insightsValue?.value || 0;
        if (kw && typeof impressions === 'number' && impressions > 0) {
          results.push({
            keyword: kw,
            monthlyImpressions: impressions,
            source: 'GBP_REAL_SEARCH',
          });
        }
      }

      // Sort descending by monthly search impressions
      results.sort((a, b) => b.monthlyImpressions - a.monthlyImpressions);

      return {
        available: true,
        keywords: results,
      };
    } catch (err: any) {
      return {
        available: false,
        keywords: [],
        error: `Failed to fetch GBP real search terms: ${err.message}`,
      };
    }
  }
}

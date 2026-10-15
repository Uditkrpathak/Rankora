import { ENV } from '../../config/env';


/** Discovers keyword candidates from Google's live autocomplete suggestions. */
export class GoogleKeywordDiscoveryService {
  public async discover(query: string, countryCode = 'in', languageCode = 'en'): Promise<string[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    // Return only phrases actually supplied by an upstream autocomplete provider.
    try {
      const suggestUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(normalizedQuery)}&gl=${countryCode.toLowerCase()}&hl=${languageCode.toLowerCase()}`;
      const res = await fetch(suggestUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(ENV.SERP_REQUEST_TIMEOUT_MS || 5000),
      });

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && Array.isArray(raw[1])) {
          const suggestions = raw[1].filter((value: unknown): value is string => typeof value === 'string');
          const seen = new Set<string>();
          const cleaned = suggestions
            .map((s) => s.trim().replace(/\s+/g, ' '))
            .filter((s) => {
              const lower = s.toLowerCase();
              if (!lower || lower.length < 3 || seen.has(lower)) return false;
              seen.add(lower);
              return true;
            });

          if (cleaned.length > 0) {
            return cleaned.slice(0, 10);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[KeywordDiscovery] Google Suggest live query failed: ${err.message}.`);
    }

    // An empty result is more honest than labelling generated combinations as Google searches.
    return [];
  }
}

export const googleKeywordDiscoveryService = new GoogleKeywordDiscoveryService();

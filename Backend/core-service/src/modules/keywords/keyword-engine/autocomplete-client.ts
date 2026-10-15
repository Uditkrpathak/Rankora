/**
 * Google Autocomplete Client
 * 
 * Interacts with suggestqueries.google.com with:
 *   - 30-day Redis cache (with in-memory fallback).
 *   - Request throttling.
 *   - Demand signal classification ("High" | "Medium" | "Low").
 *   - Strictly returns empirical suggestion signals (never fake search volumes).
 */

import { redisClient } from '../../../config/redis';

export type DemandSignal = 'High' | 'Medium' | 'Low';

export interface AutocompleteDemandConfig {
  highMaxPosition: number;
  highMinSuggestions: number;
  mediumMaxPosition: number;
  mediumMinSuggestions: number;
}

export const DEFAULT_DEMAND_CONFIG: AutocompleteDemandConfig = {
  highMaxPosition: parseInt(process.env.AUTOCOMPLETE_HIGH_DEMAND_MAX_POSITION || '3', 10),
  highMinSuggestions: parseInt(process.env.AUTOCOMPLETE_HIGH_DEMAND_MIN_SUGGESTIONS || '5', 10),
  mediumMaxPosition: parseInt(process.env.AUTOCOMPLETE_MEDIUM_DEMAND_MAX_POSITION || '8', 10),
  mediumMinSuggestions: parseInt(process.env.AUTOCOMPLETE_MEDIUM_DEMAND_MIN_SUGGESTIONS || '1', 10),
};

export interface DemandEvaluationResult {
  demandLabel: DemandSignal;
  position: number | null;
  suggestionCount: number;
  rawInput: string;
}

export class AutocompleteClient {
  private static readonly memoryCache = new Map<string, { suggestions: string[]; expiresAt: number }>();
  private static lastRequestTimestamp = 0;
  private static readonly MIN_REQUEST_SPACING_MS = 50;

  /**
   * Fetches Google Autocomplete suggestions for a query.
   */
  public static async getSuggestions(
    query: string,
    options?: { hl?: string; gl?: string; skipCache?: boolean }
  ): Promise<string[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) return [];

    const hl = options?.hl || 'en';
    const gl = options?.gl || 'in';
    const cacheKey = `cache:autocomplete:${hl}:${gl}:${trimmed}`;

    // 1. Check Redis Cache
    if (!options?.skipCache && redisClient && redisClient.status === 'ready') {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Fall back to memory
      }
    }

    // 2. Check In-Memory Cache
    if (!options?.skipCache) {
      const inMem = this.memoryCache.get(cacheKey);
      if (inMem && inMem.expiresAt > Date.now()) {
        return inMem.suggestions;
      }
    }

    // 3. Throttling
    const now = Date.now();
    const elapsed = now - this.lastRequestTimestamp;
    if (elapsed < this.MIN_REQUEST_SPACING_MS) {
      await new Promise((resolve) => setTimeout(resolve, this.MIN_REQUEST_SPACING_MS - elapsed));
    }
    this.lastRequestTimestamp = Date.now();

    // 4. Network Fetch
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(trimmed)}&hl=${hl}&gl=${gl}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json,text/plain',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const suggestions: string[] = Array.isArray(data) && Array.isArray(data[1])
        ? data[1].map((s: string) => s.toLowerCase().trim())
        : [];

      // Cache for 30 Days (30 * 24 * 60 * 60 seconds)
      const ttlSec = 30 * 24 * 60 * 60;
      if (redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.set(cacheKey, JSON.stringify(suggestions), 'EX', ttlSec);
        } catch {
          // Ignore cache write error
        }
      }

      this.memoryCache.set(cacheKey, {
        suggestions,
        expiresAt: Date.now() + ttlSec * 1000,
      });

      return suggestions;
    } catch {
      return [];
    }
  }

  /**
   * Computes demand signal label and raw inputs from Autocomplete position and suggestion count.
   *   - "High": Returned in top positions (default <= 3) with sufficient suggestions (default >= 5).
   *   - "Medium": Returned in positions up to medium max (default <= 8).
   *   - "Low": Not returned by autocomplete or beyond medium threshold.
   */
  public static evaluateDemand(
    keyword: string,
    suggestions: string[],
    config: AutocompleteDemandConfig = DEFAULT_DEMAND_CONFIG
  ): DemandEvaluationResult {
    const normKw = keyword.toLowerCase().trim();
    const suggestionCount = suggestions.length;
    if (suggestionCount === 0) {
      return {
        demandLabel: 'Low',
        position: null,
        suggestionCount: 0,
        rawInput: 'pos: none, count: 0',
      };
    }

    let position: number | null = null;
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      if (s === normKw || normKw.includes(s) || s.includes(normKw)) {
        position = i + 1; // 1-based index
        break;
      }
    }

    let demandLabel: DemandSignal = 'Low';
    if (position !== null && position <= config.highMaxPosition && suggestionCount >= config.highMinSuggestions) {
      demandLabel = 'High';
    } else if (position !== null && position <= config.mediumMaxPosition && suggestionCount >= config.mediumMinSuggestions) {
      demandLabel = 'Medium';
    } else {
      demandLabel = 'Low';
    }

    const rawInput = `pos: ${position !== null ? position : 'none'}, count: ${suggestionCount}`;
    return {
      demandLabel,
      position,
      suggestionCount,
      rawInput,
    };
  }

  /**
   * Computes demand signal label for a candidate keyword given autocomplete responses.
   */
  public static evaluateDemandSignal(
    keyword: string,
    suggestions: string[],
    config?: AutocompleteDemandConfig
  ): DemandSignal {
    return this.evaluateDemand(keyword, suggestions, config).demandLabel;
  }
}

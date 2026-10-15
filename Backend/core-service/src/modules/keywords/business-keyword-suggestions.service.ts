import { cacheStore } from '../../config/redis';
import { CATEGORY_TEMPLATES } from '../../config/keyword-templates';
import { googleKeywordDiscoveryService } from './google-keyword-discovery.service';
import { ResolvedCategory } from './keyword-engine/category-resolver';
import { IntentAndJunkFilter } from './keyword-engine/intent-and-junk-filter';

export interface BusinessKeywordSuggestion {
  keyword: string;
  source: 'GOOGLE_AUTOCOMPLETE';
  evidence: string;
}

export interface BusinessKeywordSuggestions {
  status: 'AVAILABLE' | 'CATEGORY_REQUIRED' | 'NO_SUGGESTIONS';
  keywords: BusinessKeywordSuggestion[];
  message: string;
}

/** Shared by the business preview and onboarding; templates are query seeds, never results. */
export class BusinessKeywordSuggestionsService {
  public async suggest(input: {
    category: ResolvedCategory;
    city?: string;
    countryCode?: string;
    languageCode?: string;
    limit?: number;
  }): Promise<BusinessKeywordSuggestions> {
    if (input.category.needsUserConfirmation || input.category.confidence === 'LOW') {
      return {
        status: 'CATEGORY_REQUIRED',
        keywords: [],
        message: 'A specific business category is needed to discover relevant Google suggestions. You can also add keywords manually.',
      };
    }

    const country = /^[a-z]{2}$/i.test(input.countryCode || '') ? input.countryCode!.toLowerCase() : 'in';
    const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase())?.toLowerCase() || country;
    const language = input.languageCode?.toLowerCase() || 'en';
    const city = input.city?.trim().toLowerCase() || '';
    const template = CATEGORY_TEMPLATES[input.category.primaryKey];
    const seeds = [...new Set([
      input.category.primary.toLowerCase(),
      ...(template?.seedTemplates.slice(0, 2) || []),
    ])];
    const queries = seeds.flatMap((seed) => [
      ...(city ? [{ query: `${seed} ${city} ${countryName}`, seed }] : []),
      { query: `${seed} near me`, seed },
      { query: seed, seed },
    ]);

    const results = await Promise.all(queries.map(async ({ query, seed }) => {
      // Versioned keys cannot reuse the previous generated/template preview cache.
      const key = `kw:google-suggest:v2:${country}:${language}:${encodeURIComponent(query)}`;
      let suggestions: string[] = [];
      try {
        const cached = await cacheStore.get(key);
        if (cached) {
          const parsed: unknown = JSON.parse(cached);
          if (Array.isArray(parsed)) suggestions = parsed.filter((s): s is string => typeof s === 'string');
        }
      } catch {
        // Cache errors must not prevent live discovery.
      }

      if (suggestions.length === 0) {
        try {
          suggestions = await googleKeywordDiscoveryService.discover(query, country, language);
        } catch {
          return [];
        }
        if (suggestions.length > 0) {
          await cacheStore.set(key, JSON.stringify(suggestions), 24 * 60 * 60).catch(() => {});
        }
      }

      const seedTokens = this.tokens(seed);
      return suggestions.filter((keyword) => {
        if (!IntentAndJunkFilter.evaluateCandidate(keyword).accepted) return false;
        const tokens = this.tokens(keyword);
        // A provider response alone does not establish relevance to this business.
        if (!seedTokens.every((token) => tokens.includes(token))) return false;
        return this.hasRelevantModifiers(keyword, seed, city, countryName);
      }).map((keyword): BusinessKeywordSuggestion => ({
        keyword,
        source: 'GOOGLE_AUTOCOMPLETE',
        evidence: `Returned by Google autocomplete for "${query}"`,
      }));
    }));

    // Interleave query results so one seed cannot fill the list with similar phrases.
    const merged: BusinessKeywordSuggestion[] = [];
    const seen = new Set<string>();
    const limit = Math.max(1, Math.min(input.limit ?? 3, 20));
    const maxResults = Math.max(0, ...results.map((items) => items.length));
    for (let rank = 0; rank < maxResults && merged.length < limit; rank++) {
      for (const items of results) {
        const item = items[rank];
        if (!item) continue;
        const isNearMe = /\b(near me|nearby)\b/i.test(item.keyword);
        const key = `${IntentAndJunkFilter.getNormalizedTokenSignature(item.keyword)}:${isNearMe ? 'near_me' : 'standard'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
        if (merged.length >= limit) break;
      }
    }

    return {
      status: merged.length > 0 ? 'AVAILABLE' : 'NO_SUGGESTIONS',
      keywords: merged,
      message: merged.length > 0
        ? 'Google autocomplete suggestions for your business category and area. These are discovery ideas, not measured searches for your profile.'
        : 'No relevant Google suggestions were available. You can add keywords manually or try again later.',
    };
  }

  private tokens(value: string): string[] {
    const signature = IntentAndJunkFilter.getNormalizedTokenSignature(value);
    return (signature || value.toLowerCase()).split(/\s+/).map((token) => token.replace(/s$/, ''));
  }

  private hasRelevantModifiers(keyword: string, seed: string, city: string, countryName: string): boolean {
    // Country hints alone are insufficient: Google can return Delhi, NY / Delhi, Ontario.
    // Keep generic commercial modifiers and the known city/country; discard unknown places,
    // competitor brand names and unrelated product qualifiers rather than guessing relevance.
    const words = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter(Boolean).map((word) => word.replace(/s$/, ''));
    const allowed = new Set(words(`${seed} ${city} ${countryName} near me nearby in at the a an of and for to
      best top good cheap affordable cheapest local store shop
      new old north south east west central open now today 24 7 hour hours home delivery online`));
    return words(keyword).every((word) => allowed.has(word));
  }
}

export const businessKeywordSuggestionsService = new BusinessKeywordSuggestionsService();

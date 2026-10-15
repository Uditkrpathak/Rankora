import { Location } from '../../models/Location';
import { redisClient, memoryFallback } from '../../config/redis';

export interface ISuggestionResult {
  keyword: string;
  volumeTier: 'POPULAR' | 'MEDIUM' | 'LOW';
  triggersLocalPack: boolean;
  score: number;
  localityType: 'SUBLOCALITY' | 'CITY' | 'GENERIC';
  source: 'AUTOCOMPLETE' | 'CATEGORY_SEED' | 'COMPETITOR';
}

const HINDI_CATEGORY_DICTIONARY: Record<string, string> = {
  farmstay: 'फार्मस्टे',
  homestay: 'होमस्टे',
  'guest house': 'अतिथि गृह',
  resort: 'रिसॉर्ट',
  hotel: 'होटल',
  dentist: 'डेंटिस्ट',
  'dental clinic': 'डेंटल क्लिनिक',
  doctor: 'डॉक्टर',
  hospital: 'अस्पताल',
  electrician: 'इलेक्ट्रीशियन',
  plumber: 'प्लंबर',
  bakery: 'बेकरी',
  cafe: 'कैफे',
  restaurant: 'रेस्टोरेंट',
  lawyer: 'वकील',
  salon: 'सैलून',
  gym: 'जिम',
  spa: 'स्पा',
  school: 'स्कूल',
  pharmacy: 'फार्मेसी',
};

export class SuggestionsService {
  /**
   * Generates up to 30 ranked keyword suggestions without any paid third-party APIs.
   * Utilizes rule-based category x locality seeds and Google's public autocomplete engine.
   */
  public async getSuggestionsForLocation(
    locationId: string,
    workspaceId: string,
    hl: 'en' | 'hi' = 'en'
  ): Promise<{ data: ISuggestionResult[]; cached: boolean }> {
    const cacheKey = `suggestions:${locationId}:${hl}`;

    // 1. Check Redis or Memory Cache (7-day TTL)
    if (redisClient && redisClient.status === 'ready') {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return { data: JSON.parse(cached), cached: true };
        }
      } catch (err) {
        console.warn('[SuggestionsService] Redis cache lookup failed:', err);
      }
    } else {
      const mem = memoryFallback.get(cacheKey);
      if (mem && mem.val) {
        return { data: JSON.parse(mem.val), cached: true };
      }
    }

    // 2. Fetch location details
    const location = await Location.findOne({ _id: locationId, workspaceId });
    if (!location) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    const primaryCategory = location.primaryCategory?.displayName || location.categories?.[0] || 'Business';
    const city = location.city || '';
    
    // Extract sublocalities / neighborhoods
    const sublocalities = this.extractSublocalities(location);

    // 3. Generate Seeds
    const seeds = this.generateLocalitySeeds(primaryCategory, city, sublocalities, hl);

    // 4. Query Public Google Autocomplete
    const autocompleteMap = await this.queryGoogleAutocomplete(seeds, hl);

    // 5. Detect Local Pack & Compute Scores
    const suggestions: ISuggestionResult[] = [];
    const seenKeywords = new Set<string>();

    for (const [kwText, autoMeta] of autocompleteMap.entries()) {
      const cleanKw = kwText.trim();
      const norm = cleanKw.toLowerCase();
      if (seenKeywords.has(norm) || cleanKw.length < 3) continue;
      seenKeywords.add(norm);

      // Determine locality type
      let localityType: 'SUBLOCALITY' | 'CITY' | 'GENERIC' = 'GENERIC';
      const hasSublocality = sublocalities.some(sub => norm.includes(sub.toLowerCase()));
      const hasCity = city && norm.includes(city.toLowerCase());

      if (hasSublocality) {
        localityType = 'SUBLOCALITY';
      } else if (hasCity) {
        localityType = 'CITY';
      }

      // Check Local Pack heuristic
      const triggersLocalPack = this.heuristicTriggersLocalPack(cleanKw, primaryCategory, localityType);

      // Volume Tier based on autocomplete rank position
      let volumeTier: 'POPULAR' | 'MEDIUM' | 'LOW' = 'LOW';
      if (autoMeta.position <= 3) {
        volumeTier = 'POPULAR';
      } else if (autoMeta.position <= 7) {
        volumeTier = 'MEDIUM';
      }

      // Compute composite score (0 - 100)
      const score = this.calculateScore({
        triggersLocalPack,
        autoPosition: autoMeta.position,
        localityType,
        hasCategory: norm.includes(primaryCategory.toLowerCase()),
      });

      suggestions.push({
        keyword: cleanKw,
        volumeTier,
        triggersLocalPack,
        score,
        localityType,
        source: autoMeta.source,
      });
    }

    // 6. Sort and take top 30
    const sorted = suggestions.sort((a, b) => b.score - a.score).slice(0, 30);

    // 7. Cache for 7 days (604800 seconds)
    const jsonStr = JSON.stringify(sorted);
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.set(cacheKey, jsonStr, 'EX', 7 * 86400);
      } catch (err) {
        console.warn('[SuggestionsService] Redis cache write failed:', err);
      }
    } else {
      memoryFallback.set(cacheKey, { val: jsonStr, exp: Date.now() + 7 * 86400 * 1000 });
    }

    return { data: sorted, cached: false };
  }

  /**
   * Extracts micro sublocalities and neighborhoods from Location address components
   */
  private extractSublocalities(location: any): string[] {
    const list: string[] = [];
    if (Array.isArray(location.sublocalities)) {
      list.push(...location.sublocalities);
    }

    if (location.address) {
      // Split address by commas and clean parts
      const parts = location.address
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length >= 3 && p.length <= 30);

      // Exclude city, state, country, or purely numbers/pincodes
      const excluded = [location.city, location.state, location.country, location.postalCode].map(s => (s || '').toLowerCase());
      for (const part of parts) {
        if (/^\d+$/.test(part)) continue;
        if (excluded.includes(part.toLowerCase())) continue;
        if (!list.map(s => s.toLowerCase()).includes(part.toLowerCase())) {
          list.push(part);
        }
      }
    }

    return list.slice(0, 5); // Take up to top 5 sublocalities
  }

  /**
   * Generates bilingual seed query combinations for Google suggest
   */
  private generateLocalitySeeds(category: string, city: string, sublocalities: string[], hl: 'en' | 'hi'): string[] {
    const seeds: string[] = [];
    const catLower = category.toLowerCase();
    const hindiCat = HINDI_CATEGORY_DICTIONARY[catLower] || category;

    // 1. English Seeds
    seeds.push(category);
    if (city) {
      seeds.push(`${category} ${city}`);
      seeds.push(`${category} in ${city}`);
      seeds.push(`${category} near me`);
    }

    for (const sub of sublocalities) {
      seeds.push(`${category} ${sub}`);
      seeds.push(`${category} in ${sub}`);
      seeds.push(`${category} near ${sub}`);
      if (city) {
        seeds.push(`${category} ${sub} ${city}`);
      }
    }

    // 2. Hindi / Devanagari Seeds
    if (hl === 'hi' || Boolean(HINDI_CATEGORY_DICTIONARY[catLower])) {
      seeds.push(hindiCat);
      if (city) {
        seeds.push(`${hindiCat} ${city}`);
        seeds.push(`${city} में ${hindiCat}`);
      }
      for (const sub of sublocalities) {
        seeds.push(`${sub} में ${hindiCat}`);
        seeds.push(`${sub} के पास ${hindiCat}`);
      }
    }

    return [...new Set(seeds)];
  }

  /**
   * Scrapes Google's public autocomplete endpoint:
   * GET https://suggestqueries.google.com/complete/search?client=firefox&q={term}&hl={hl}&gl=IN
   */
  private async queryGoogleAutocomplete(
    seeds: string[],
    hl: 'en' | 'hi'
  ): Promise<Map<string, { position: number; source: 'AUTOCOMPLETE' | 'CATEGORY_SEED' }>> {
    const results = new Map<string, { position: number; source: 'AUTOCOMPLETE' | 'CATEGORY_SEED' }>();

    // Always include the basic seeds as candidate seeds
    for (const s of seeds) {
      results.set(s, { position: 4, source: 'CATEGORY_SEED' });
    }

    // Limit expansions to first 8 seeds to avoid rate spikes
    const targetSeeds = seeds.slice(0, 8);
    const expansions: string[] = [];
    for (const s of targetSeeds) {
      expansions.push(s);
      expansions.push(`${s} best`);
      expansions.push(`${s} near me`);
    }

    await Promise.allSettled(
      expansions.map(async (query) => {
        try {
          const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=${hl}&gl=IN`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(2500),
          });

          if (!res.ok) return;
          const data = (await res.json()) as any;
          const suggestions: string[] = Array.isArray(data?.[1]) ? data[1] : [];

          suggestions.forEach((text: string, index: number) => {
            const clean = text.trim();
            const pos = index + 1;
            if (!results.has(clean) || results.get(clean)!.position > pos) {
              results.set(clean, { position: pos, source: 'AUTOCOMPLETE' });
            }
          });
        } catch {
          // Non-blocking on network failure
        }
      })
    );

    return results;
  }

  /**
   * Determines if a query triggers Google's Local 3-Pack widget
   */
  private heuristicTriggersLocalPack(keyword: string, category: string, localityType: string): boolean {
    const lower = keyword.toLowerCase();
    // High intent terms that trigger Local Pack:
    if (localityType === 'SUBLOCALITY' || localityType === 'CITY') return true;
    if (lower.includes('near me') || lower.includes('in ') || lower.includes('के पास') || lower.includes('में ')) return true;
    if (lower.includes('best') || lower.includes('clinic') || lower.includes('shop') || lower.includes('doctor')) return true;
    return false;
  }

  /**
   * Composite scoring algorithm (0 - 100)
   */
  private calculateScore(params: {
    triggersLocalPack: boolean;
    autoPosition: number;
    localityType: 'SUBLOCALITY' | 'CITY' | 'GENERIC';
    hasCategory: boolean;
  }): number {
    let score = 0;

    // 1. Local Pack (40 points max)
    if (params.triggersLocalPack) score += 40;

    // 2. Autocomplete Position (40 points max)
    if (params.autoPosition <= 3) {
      score += 40;
    } else if (params.autoPosition <= 5) {
      score += 30;
    } else if (params.autoPosition <= 8) {
      score += 20;
    } else {
      score += 10;
    }

    // 3. Locality Match (20 points max)
    if (params.localityType === 'SUBLOCALITY') {
      score += 20; // Hyper-local neighborhood query gets highest boost
    } else if (params.localityType === 'CITY') {
      score += 15;
    } else {
      score += 5;
    }

    return Math.min(100, Math.max(10, score));
  }
}

export const suggestionsService = new SuggestionsService();

/**
 * Candidate Generator Module
 * 
 * Generates rich, multi-source keyword candidates:
 *   1. Curated category templates:
 *      - English templates loaded from data/templates-en.json.
 *      - Hinglish templates loaded from data/templates-hinglish.json (ONLY if country = IN).
 *   2. Locality hierarchy sublocality seeds (smallest first):
 *      - {category} in {sublocality}
 *      - {local term} in {sublocality}
 *   3. User "main service" expansion (optional).
 *   4. Website title, H1, and meta description extraction (SSRF guarded, 5s timeout, 500KB cap).
 *   5. MARKET-DISCOVERY: 1 real Maps search at location centre to harvest competitor categories.
 *   6. Autocomplete expansion of category and seed queries (cached in Redis for 30 days).
 *   7. One BRANDED candidate for identity verification.
 * 
 * Generality Rule:
 *   ZERO category-specific or business-specific terms in code.
 */

import templatesEnData from './data/templates-en.json';
import templatesHinglishData from './data/templates-hinglish.json';
import { ResolvedCategory } from './category-resolver';
import { IntentAndJunkFilter } from './intent-and-junk-filter';
import { LocalityHierarchy, LocalityHierarchyService } from './locality-hierarchy';
import { WebsiteScraper } from './website-scraper';
import { AutocompleteClient } from './autocomplete-client';

export type CandidateKind = 'MAIN_SERVICE' | 'NEAR_ME' | 'GEO_LOCAL' | 'BRANDED' | 'MARKET_DISCOVERY' | 'LOCAL_TERM' | 'EXTRA_SERVICE';
export type CandidateSource =
  | 'CURATED_TEMPLATE'
  | 'LOCAL_TERM_SEED'
  | 'GENERIC_TEMPLATE'
  | 'MARKET_DISCOVERY'
  | 'CATEGORY_AUTOCOMPLETE'
  | 'NEIGHBOURHOOD'
  | 'BRANDED_SEED'
  | 'USER_MAIN_SERVICE'
  | 'WEBSITE_CONTENT';

export interface KeywordCandidate {
  keyword: string;
  kind: CandidateKind;
  source: CandidateSource;
  evidence?: string;
  derivedFromCategory?: string;
  namedSublocality?: string;
  targetSlot?: 'a' | 'b' | 'c' | 'd' | 'e' | 'extra';
}

export class CandidateGenerator {
  /**
   * Generates candidate keywords from multiple high-intent sources.
   * Excludes branded keywords entirely (never suggested to users).
   */
  public static async generateCandidates(input: {
    category: ResolvedCategory;
    businessName: string;
    hierarchy?: LocalityHierarchy;
    city?: string;
    sublocality?: string;
    neighborhood?: string;
    state?: string;
    country?: string;
    userMainService?: string;
    websiteUrl?: string;
    countryCode?: string;
    fetchCompetitorsForMarketDiscovery?: () => Promise<Array<{ name: string; primaryCategory?: string }>>;
    fetchAutocompleteSuggestions?: (query: string) => Promise<string[]>;
  }): Promise<KeywordCandidate[]> {
    const rawCandidates: KeywordCandidate[] = [];
    const primaryCat = input.category.primary;
    const catKey = input.category.primaryKey;
    const hierarchy = input.hierarchy || LocalityHierarchyService.buildHierarchy({
      city: input.city,
      sublocality: input.sublocality,
      neighborhood: input.neighborhood,
      state: input.state,
      country: input.country,
      countryCode: input.countryCode,
    });
    const country = (hierarchy.countryCode || input.countryCode || 'in').toLowerCase();
    const sublocalities = hierarchy.sublocalities || [];
    const city = hierarchy.city;

    // Load templates
    const enTemplates = (templatesEnData as Record<string, { seedTemplates?: string[]; localTerms?: string[]; serviceNouns?: string[] }>)[catKey];
    const hinglishTemplates = country === 'in'
      ? (templatesHinglishData as Record<string, { seedTemplates?: string[]; localTerms?: string[] }>)[catKey]
      : undefined;

    const isGenericFallback = !enTemplates;

    // -------------------------------------------------------------
    // SLOT A SEED: Google-validated category term near me
    // -------------------------------------------------------------
    rawCandidates.push({
      keyword: `${primaryCat.toLowerCase()} near me`,
      kind: 'NEAR_ME',
      source: isGenericFallback ? 'GENERIC_TEMPLATE' : 'CURATED_TEMPLATE',
      derivedFromCategory: primaryCat,
      targetSlot: 'a',
      evidence: `Validated category near-me intent for ${primaryCat}`,
    });

    // -------------------------------------------------------------
    // SLOT B SEEDS: Local term near me (Colloquial / Local Variants)
    // -------------------------------------------------------------
    const localTerms: string[] = [];
    if (enTemplates?.localTerms) {
      for (const lt of enTemplates.localTerms) {
        if (!localTerms.includes(lt.toLowerCase())) localTerms.push(lt.toLowerCase());
      }
    }
    if (hinglishTemplates?.localTerms) {
      for (const lt of hinglishTemplates.localTerms) {
        if (!localTerms.includes(lt.toLowerCase())) localTerms.push(lt.toLowerCase());
      }
    }

    for (const lt of localTerms) {
      rawCandidates.push({
        keyword: `${lt} near me`,
        kind: 'LOCAL_TERM',
        source: 'LOCAL_TERM_SEED',
        derivedFromCategory: primaryCat,
        targetSlot: 'b',
        evidence: `Local colloquial term near me for ${primaryCat}`,
      });
    }

    // -------------------------------------------------------------
    // SLOT C SEEDS: Category in Sublocality (Smallest hierarchy level first!)
    // -------------------------------------------------------------
    for (const subloc of sublocalities) {
      rawCandidates.push({
        keyword: `${primaryCat.toLowerCase()} in ${subloc.toLowerCase()}`,
        kind: 'GEO_LOCAL',
        source: 'NEIGHBOURHOOD',
        derivedFromCategory: primaryCat,
        namedSublocality: subloc,
        targetSlot: 'c',
        evidence: `Category localized to sublocality ${subloc}`,
      });
      rawCandidates.push({
        keyword: `${primaryCat.toLowerCase()} ${subloc.toLowerCase()}`,
        kind: 'GEO_LOCAL',
        source: 'NEIGHBOURHOOD',
        derivedFromCategory: primaryCat,
        namedSublocality: subloc,
        targetSlot: 'c',
        evidence: `Category query with sublocality ${subloc}`,
      });
    }

    // -------------------------------------------------------------
    // SLOT D SEEDS: Local Term in Sublocality (Smallest hierarchy level first!)
    // -------------------------------------------------------------
    for (const subloc of sublocalities) {
      for (const lt of localTerms.slice(0, 3)) {
        rawCandidates.push({
          keyword: `${lt} in ${subloc.toLowerCase()}`,
          kind: 'GEO_LOCAL',
          source: 'LOCAL_TERM_SEED',
          derivedFromCategory: primaryCat,
          namedSublocality: subloc,
          targetSlot: 'd',
          evidence: `Local term localized to sublocality ${subloc}`,
        });
        rawCandidates.push({
          keyword: `${lt} ${subloc.toLowerCase()}`,
          kind: 'GEO_LOCAL',
          source: 'LOCAL_TERM_SEED',
          derivedFromCategory: primaryCat,
          namedSublocality: subloc,
          targetSlot: 'd',
          evidence: `Local term query with sublocality ${subloc}`,
        });
      }
    }

    // -------------------------------------------------------------
    // SLOT E SEEDS: Commercial Services, Competitors, Website, User Main Service
    // -------------------------------------------------------------
    // 1. Service nouns from template
    if (enTemplates?.serviceNouns) {
      for (const sn of enTemplates.serviceNouns.slice(0, 3)) {
        rawCandidates.push({
          keyword: `${sn.toLowerCase()} near me`,
          kind: 'EXTRA_SERVICE',
          source: 'CURATED_TEMPLATE',
          derivedFromCategory: primaryCat,
          targetSlot: 'e',
          evidence: `Specific service offering for ${primaryCat}`,
        });
      }
    }

    // 2. Competitor categories discovered from top-20 SERP
    if (input.fetchCompetitorsForMarketDiscovery) {
      try {
        const competitors = await input.fetchCompetitorsForMarketDiscovery();
        const competitorCategories = new Set<string>();
        for (const comp of competitors) {
          if (comp.primaryCategory && comp.primaryCategory.length > 2) {
            competitorCategories.add(comp.primaryCategory.trim());
          }
        }

        for (const compCat of Array.from(competitorCategories).slice(0, 3)) {
          if (compCat.toLowerCase() !== primaryCat.toLowerCase()) {
            rawCandidates.push({
              keyword: `${compCat.toLowerCase()} near me`,
              kind: 'NEAR_ME',
              source: 'MARKET_DISCOVERY',
              derivedFromCategory: compCat,
              targetSlot: 'e',
              evidence: `Competitor category discovered from probe: "${compCat}"`,
            });
          }
        }
      } catch {
        // Skip competitor discovery on error
      }
    }

    // 3. User Main Service
    if (input.userMainService && input.userMainService.trim().length >= 3) {
      const ms = input.userMainService.trim().toLowerCase();
      rawCandidates.push({
        keyword: `${ms} near me`,
        kind: 'NEAR_ME',
        source: 'USER_MAIN_SERVICE',
        targetSlot: 'e',
        evidence: 'User-specified main service near-me',
      });
      if (sublocalities[0]) {
        rawCandidates.push({
          keyword: `${ms} in ${sublocalities[0].toLowerCase()}`,
          kind: 'GEO_LOCAL',
          source: 'USER_MAIN_SERVICE',
          namedSublocality: sublocalities[0],
          targetSlot: 'e',
          evidence: `User main service in ${sublocalities[0]}`,
        });
      }
    }

    // 4. Website content extraction
    if (input.websiteUrl) {
      try {
        const scraped = await WebsiteScraper.scrape(input.websiteUrl);
        for (const kw of scraped.candidateKeywords.slice(0, 3)) {
          rawCandidates.push({
            keyword: kw,
            kind: 'EXTRA_SERVICE',
            source: 'WEBSITE_CONTENT',
            targetSlot: 'e',
            evidence: 'Extracted from business website title/H1/meta',
          });
        }
      } catch {
        // Graceful fail-soft
      }
    }

    // 5. Category Autocomplete suggestions
    const autocompleteFn = input.fetchAutocompleteSuggestions
      || ((q: string) => AutocompleteClient.getSuggestions(q, { hl: 'en', gl: country }));

    try {
      const suggestions = await autocompleteFn(primaryCat.toLowerCase());
      for (const s of suggestions.slice(0, 5)) {
        const isNearMe = s.includes('near me') || s.includes('nearby');
        rawCandidates.push({
          keyword: s,
          kind: isNearMe ? 'NEAR_ME' : 'MAIN_SERVICE',
          source: 'CATEGORY_AUTOCOMPLETE',
          derivedFromCategory: primaryCat,
          targetSlot: 'e',
          evidence: `Google Autocomplete suggestion for "${primaryCat}"`,
        });
      }
    } catch {
      // Skip autocomplete on error
    }

    // -------------------------------------------------------------
    // EXTRAS: Alternative templates & City-level anchors
    // -------------------------------------------------------------
    if (enTemplates?.seedTemplates) {
      for (const t of enTemplates.seedTemplates.slice(1, 4)) {
        rawCandidates.push({
          keyword: t.includes('near me') ? t : `${t} near me`,
          kind: 'NEAR_ME',
          source: 'CURATED_TEMPLATE',
          derivedFromCategory: primaryCat,
          targetSlot: 'extra',
          evidence: `Commercial synonym template for ${primaryCat}`,
        });
      }
    }

    if (city) {
      rawCandidates.push({
        keyword: `${primaryCat.toLowerCase()} in ${city.toLowerCase()}`,
        kind: 'GEO_LOCAL',
        source: isGenericFallback ? 'GENERIC_TEMPLATE' : 'CURATED_TEMPLATE',
        derivedFromCategory: primaryCat,
        targetSlot: 'extra',
        evidence: `City-level anchor for ${city}`,
      });
      rawCandidates.push({
        keyword: `${primaryCat.toLowerCase()} ${city.toLowerCase()}`,
        kind: 'GEO_LOCAL',
        source: isGenericFallback ? 'GENERIC_TEMPLATE' : 'CURATED_TEMPLATE',
        derivedFromCategory: primaryCat,
        targetSlot: 'extra',
        evidence: `City query for ${city}`,
      });
    }

    // Strict Branded Exclusion: Never suggest business name or branded keywords
    const businessNameClean = input.businessName.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    const businessTokens = businessNameClean
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['store', 'shop', 'clinic', 'hospital', 'company', 'services', 'center'].includes(t));

    const nonBrandedCandidates = rawCandidates.filter((cand) => {
      const kwLower = cand.keyword.toLowerCase();
      // Drop if exact business name is in query
      if (businessNameClean.length >= 4 && kwLower.includes(businessNameClean)) {
        return false;
      }
      // Drop if any unique branded token is present
      for (const bt of businessTokens) {
        const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${bt}($|[^\\p{L}\\p{N}])`, 'u');
        if (regex.test(kwLower)) {
          return false;
        }
      }
      return true;
    });

    // Filter and Deduplicate via IntentAndJunkFilter + Locality Hierarchy
    const { valid } = IntentAndJunkFilter.filterAndDedupe(nonBrandedCandidates, input.hierarchy);
    return valid;
  }
}

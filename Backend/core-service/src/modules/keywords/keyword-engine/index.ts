/**
 * Keyword Engine V2 - Unified Pipeline (§Step 2A Implementation)
 * 
 * Orchestrates:
 *   1. Locality Hierarchy Construction & Validation.
 *   2. Data-Driven Category Resolution (zero hardcoded categories in code).
 *   3. Multi-Source Candidate Generation (Templates, Sublocalities, User Main Service, Website, Competitors).
 *   4. Intent & Junk Filtering (Place outside hierarchy rejection, country suffix rejection, plural dedup).
 *   5. Staged Probing under Hard 45-Request Maps Cap (Stage 1 Autocomplete -> Stage 2 Center Pin -> Stage 3 5-Pin).
 *   6. Scope Classification & Slot Selection (Default 5 slots a-e + 10 extras).
 * 
 * Generality Rule:
 *   ZERO category-specific or business-specific terms in code.
 */

export * from './category-resolver';
export * from './intent-and-junk-filter';
export * from './locality-hierarchy';
export * from './website-scraper';
export * from './autocomplete-client';
export * from './candidate-generator';
export * from './relevance-probe';
export * from './branded-sanity';
export * from './selector';
export * from './gbp-real-search';

import { CategoryResolver, ResolvedCategory } from './category-resolver';
import { LocalityHierarchy, LocalityHierarchyService, AddressComponentLike } from './locality-hierarchy';
import { CandidateGenerator, KeywordCandidate } from './candidate-generator';
import { RelevanceProbe, CandidateProbeMetrics } from './relevance-probe';
import { BrandedSanityCheck, BrandedSanityResult } from './branded-sanity';
import { KeywordSelector, SelectionResult, SelectedKeywordOutput } from './selector';
import { AutocompleteClient, DemandEvaluationResult } from './autocomplete-client';
import { GbpRealSearchTermsService } from './gbp-real-search';
import { SERPItem } from '../../../providers/serp/serp.types';

export interface KeywordEngineInput {
  businessName: string;
  coordinates: { lat: number; lng: number };
  formattedAddress?: string;
  addressComponents?: AddressComponentLike[];
  city?: string;
  state?: string;
  sublocality?: string;
  neighborhood?: string;
  country?: string;
  countryCode?: string;
  websiteUrl?: string;
  userMainService?: string;
  placeId?: string;
  gbpPrimaryCategory?: string;
  gbpAdditionalCategories?: string[];
  placesPrimaryTypeDisplayName?: string;
  placesPrimaryType?: string;
  placesTypes?: string[];
  userSelectedCategory?: string;
  existingCategories?: string[];
  maxMapsRequestsCap?: number;
  maxKeywordsLimit?: number;
  gbpAccessToken?: string;
  gbpLocationId?: string;
  searchFn?: (params: { keyword: string; lat: number; lng: number }) => Promise<{
    items: SERPItem[];
    wireBytes?: number;
    status?: string;
  }>;
  autocompleteFn?: (query: string) => Promise<string[]>;
}

export interface CandidateFunnelEntry {
  candidate: string;
  source: string;
  targetSlot?: string;
  autocompletePresent: boolean;
  autocompletePosition: number | null;
  autocompleteSuggestionCount: number;
  demandSignal: string;
  stage1Relevance: number | null;
  stage1ItemCount: number | null;
  stage2Result: string;
  requestsUsed: number;
  finalStatus: string;
  dropReason?: string;
}

export interface KeywordEngineResult {
  category: ResolvedCategory;
  hierarchy: LocalityHierarchy;
  brandedSanity: BrandedSanityResult;
  selection: SelectionResult;
  defaultKeywords: SelectedKeywordOutput[];
  extraKeywords: SelectedKeywordOutput[];
  needsUserConfirmation: boolean;
  gbpRealSearchTerms?: {
    available: boolean;
    terms: Array<{ keyword: string; monthlyImpressions: number }>;
    error?: string;
  };
  diagnosticFunnel: CandidateFunnelEntry[];
  stageBreakdown: {
    stage1AutocompleteRequests: number;
    stage2CenterPinRequests: number;
    stage3FivePinRequests: number;
    marketDiscoveryRequests: number;
    totalRequests: number;
  };
  totalCandidatesEvaluated: number;
  totalMapsRequestsExecuted: number;
  totalWireBytesUsed: number;
}

export class KeywordEngineV2 {
  public static async execute(input: KeywordEngineInput): Promise<KeywordEngineResult> {
    const maxRequestsCap = input.maxMapsRequestsCap ?? parseInt(process.env.KEYWORD_MAX_MAPS_REQUESTS || '45', 10);
    const usedRequestsRef = { count: 0 };

    // 1. Build Locality Hierarchy
    const hierarchy = LocalityHierarchyService.buildHierarchy({
      addressComponents: input.addressComponents,
      formattedAddress: input.formattedAddress,
      city: input.city,
      state: input.state,
      sublocality: input.sublocality,
      neighborhood: input.neighborhood,
      country: input.country,
      countryCode: input.countryCode,
    });

    // 2. Resolve Category
    const category = CategoryResolver.resolve({
      gbpPrimaryCategory: input.gbpPrimaryCategory,
      gbpAdditionalCategories: input.gbpAdditionalCategories,
      placesPrimaryTypeDisplayName: input.placesPrimaryTypeDisplayName,
      placesPrimaryType: input.placesPrimaryType,
      placesTypes: input.placesTypes,
      userSelectedCategory: input.userSelectedCategory,
      existingCategories: input.existingCategories,
      businessName: input.businessName,
    });

    // If category is low confidence, do NOT spend probe requests until confirmed (Generality Rule 2)
    if (category.needsUserConfirmation && !input.userMainService) {
      return {
        category,
        hierarchy,
        brandedSanity: {
          passed: false,
          status: 'UNPROBED',
          businessRankAtCentre: null,
          message: 'Category requires user confirmation',
        },
        selection: {
          status: 'UNVERIFIED',
          defaultKeywords: [],
          extraKeywords: [],
          selectedKeywords: [],
          allEvaluatedCandidates: [],
          allScoredCandidates: [],
        },
        defaultKeywords: [],
        extraKeywords: [],
        needsUserConfirmation: true,
        diagnosticFunnel: [],
        stageBreakdown: {
          stage1AutocompleteRequests: 0,
          stage2CenterPinRequests: 0,
          stage3FivePinRequests: 0,
          marketDiscoveryRequests: 0,
          totalRequests: 0,
        },
        totalCandidatesEvaluated: 0,
        totalMapsRequestsExecuted: 0,
        totalWireBytesUsed: 0,
      };
    }

    // 3. Generate Multi-Source Candidates
    const candidates = await CandidateGenerator.generateCandidates({
      category,
      businessName: input.businessName,
      hierarchy,
      userMainService: input.userMainService,
      websiteUrl: input.websiteUrl,
      countryCode: hierarchy.countryCode,
      fetchCompetitorsForMarketDiscovery: input.searchFn && usedRequestsRef.count < maxRequestsCap
        ? async () => {
            usedRequestsRef.count++;
            const res = await input.searchFn!({
              keyword: category.primary,
              lat: input.coordinates.lat,
              lng: input.coordinates.lng,
            });
            return (res.items || []).map((it) => ({
              name: it.name,
              primaryCategory: it.primaryCategory,
            }));
          }
        : undefined,
      fetchAutocompleteSuggestions: input.autocompleteFn,
    });

    // 4. Staged Probing under Hard 45-Request Cap
    let marketDiscoveryRequests = 0;
    let stage2CenterPinRequests = 0;
    let stage3FivePinRequests = 0;

    // Stage 1: Autocomplete Validation (0 Maps Requests)
    const demandEvaluations = new Map<string, DemandEvaluationResult>();
    for (const cand of candidates) {
      try {
        const suggestions = input.autocompleteFn
          ? await input.autocompleteFn(cand.keyword)
          : await AutocompleteClient.getSuggestions(cand.keyword, {
              hl: 'en',
              gl: hierarchy.countryCode || 'in',
            });
        const evalRes = AutocompleteClient.evaluateDemand(cand.keyword, suggestions);
        demandEvaluations.set(cand.keyword, evalRes);
      } catch {
        demandEvaluations.set(cand.keyword, {
          demandLabel: 'Low',
          position: null,
          suggestionCount: 0,
          rawInput: 'pos: none, count: 0',
        });
      }
    }

    // Stage 2: Budget-Reserved Center-Pin Probing by Slot
    // Reserve probe budget so hyperlocal & sublocality candidates are never starved
    const candidatesBySlot = new Map<'a' | 'b' | 'c' | 'd' | 'e' | 'extra', KeywordCandidate[]>();
    for (const cand of candidates) {
      const slot = cand.targetSlot || 'extra';
      const list = candidatesBySlot.get(slot) || [];
      list.push(cand);
      candidatesBySlot.set(slot, list);
    }

    // Pick top candidates per slot for center probe:
    // Slot a: 1 candidate (exact category near me)
    // Slot b: top 2 local term near me candidates
    // Slot c: top 2 sublocality category candidates (smallest sublocality first)
    // Slot d: top 2 sublocality local term candidates (smallest sublocality first)
    // Slot e: top 2 service / competitor candidates
    const candidatesForCenterProbe: KeywordCandidate[] = [];
    const pickForSlot = (slotKey: 'a' | 'b' | 'c' | 'd' | 'e', count: number) => {
      const list = candidatesBySlot.get(slotKey) || [];
      // Prefer candidates with High/Medium demand signals or exact sublocality matches
      const sorted = [...list].sort((x, y) => {
        const sigX = demandEvaluations.get(x.keyword)?.demandLabel || 'Low';
        const sigY = demandEvaluations.get(y.keyword)?.demandLabel || 'Low';
        const score = (s: string) => (s === 'High' ? 2 : s === 'Medium' ? 1 : 0);
        return score(sigY) - score(sigX);
      });
      for (const item of sorted.slice(0, count)) {
        if (!candidatesForCenterProbe.some((c) => c.keyword === item.keyword)) {
          candidatesForCenterProbe.push(item);
        }
      }
    };

    pickForSlot('a', 1);
    pickForSlot('b', 2);
    pickForSlot('c', 2);
    pickForSlot('d', 2);
    pickForSlot('e', 2);

    const probes = new Map<string, CandidateProbeMetrics>();
    const stage1CenterProbes = new Map<string, CandidateProbeMetrics>();
    let totalWireBytes = 0;

    const startStage2Requests = usedRequestsRef.count;
    for (const cand of candidatesForCenterProbe) {
      if (usedRequestsRef.count >= maxRequestsCap) break;

      const evalRes = demandEvaluations.get(cand.keyword);
      const probe = await RelevanceProbe.probeCandidate(
        cand.keyword,
        input.coordinates,
        category,
        {
          targetPlaceId: input.placeId,
          targetName: input.businessName,
          sublocalityLabel: cand.namedSublocality || hierarchy.sublocalities[0] || hierarchy.city,
          demandSignal: evalRes?.demandLabel || 'Low',
          demandRawInput: evalRes?.rawInput,
          onlyCenterPin: true, // Center pin probe only
          maxRequestsCap,
          usedRequestsRef,
          searchFn: input.searchFn,
        }
      );

      totalWireBytes += probe.totalWireBytes;
      probes.set(cand.keyword, probe);
      stage1CenterProbes.set(cand.keyword, probe);
    }
    stage2CenterPinRequests = usedRequestsRef.count - startStage2Requests;

    // Stage 3: Full 5-Pin Probe on Slot Winners Only
    // For each slot (a, b, c, d, e), pick best candidate surviving Stage 2 (relevance >= 0.3, mean items >= 5)
    const slotWinners: KeywordCandidate[] = [];
    const slotsToPick: Array<'a' | 'b' | 'c' | 'd' | 'e'> = ['a', 'b', 'c', 'd', 'e'];

    for (const slotKey of slotsToPick) {
      const slotCands = candidatesForCenterProbe.filter((c) => c.targetSlot === slotKey);
      const survivors = slotCands
        .map((c) => ({ cand: c, probe: probes.get(c.keyword)! }))
        .filter((r) => r.probe && r.probe.relevanceScore >= 0.30 && r.probe.meanItemCount >= 5)
        .sort((x, y) => y.probe.relevanceScore - x.probe.relevanceScore);

      if (survivors.length > 0) {
        slotWinners.push(survivors[0].cand);
      }
    }

    const startStage3Requests = usedRequestsRef.count;
    for (const winner of slotWinners) {
      if (usedRequestsRef.count >= maxRequestsCap) break;

      const evalRes = demandEvaluations.get(winner.keyword);
      const fullProbe = await RelevanceProbe.probeCandidate(
        winner.keyword,
        input.coordinates,
        category,
        {
          targetPlaceId: input.placeId,
          targetName: input.businessName,
          sublocalityLabel: winner.namedSublocality || hierarchy.sublocalities[0] || hierarchy.city,
          demandSignal: evalRes?.demandLabel || 'Low',
          demandRawInput: evalRes?.rawInput,
          onlyCenterPin: false, // Full 5 pins
          maxRequestsCap,
          usedRequestsRef,
          searchFn: input.searchFn,
        }
      );

      totalWireBytes += fullProbe.totalWireBytes;
      probes.set(winner.keyword, fullProbe);
    }
    stage3FivePinRequests = usedRequestsRef.count - startStage3Requests;

    // 5. Branded Sanity Check (Tested internally, never exposed as a suggestion)
    let brandedProbe: CandidateProbeMetrics | undefined;
    if (input.businessName && usedRequestsRef.count < maxRequestsCap) {
      try {
        brandedProbe = await RelevanceProbe.probeCandidate(
          input.businessName.trim(),
          input.coordinates,
          category,
          {
            targetPlaceId: input.placeId,
            targetName: input.businessName,
            sublocalityLabel: hierarchy.sublocalities[0] || hierarchy.city,
            demandSignal: 'Low',
            onlyCenterPin: true,
            maxRequestsCap,
            usedRequestsRef,
            searchFn: input.searchFn,
          }
        );
      } catch {
        // Soft fail
      }
    }
    const brandedSanity = BrandedSanityCheck.evaluate(brandedProbe, input.businessName);

    // 6. Selection with Topic Slots a-e & Extras
    const selection = KeywordSelector.select(candidates, probes, hierarchy);

    // 7. Build Full Diagnostic Candidate Funnel
    const defaultKeywordSet = new Map<string, string>();
    selection.defaultKeywords.forEach((k) => defaultKeywordSet.set(k.keyword, k.slotAssigned || 'default'));
    const extraKeywordSet = new Set(selection.extraKeywords.map((k) => k.keyword));

    const diagnosticFunnel: CandidateFunnelEntry[] = candidates.map((cand) => {
      const evalRes = demandEvaluations.get(cand.keyword);
      const centerProbe = stage1CenterProbes.get(cand.keyword);
      const finalProbe = probes.get(cand.keyword);

      const isDefault = defaultKeywordSet.has(cand.keyword);
      const isExtra = extraKeywordSet.has(cand.keyword);

      let finalStatus = 'DROPPED';
      let dropReason: string | undefined;

      if (isDefault) {
        finalStatus = `DEFAULT_SLOT (${defaultKeywordSet.get(cand.keyword)})`;
      } else if (isExtra) {
        finalStatus = 'EXTRA';
      } else if (!centerProbe) {
        finalStatus = 'UNPROBED';
        dropReason = 'Not in slot priority top-2 for center-pin probe';
      } else if (centerProbe.relevanceScore < 0.30) {
        dropReason = `Stage-1 relevance ${centerProbe.relevanceScore} < 0.30 cheap drop threshold`;
      } else if (centerProbe.meanItemCount < 5) {
        dropReason = `Stage-1 item count ${centerProbe.meanItemCount} < 5`;
      } else if (finalProbe && finalProbe.pinsProbed > 1 && finalProbe.relevanceScore < 0.45) {
        dropReason = `5-pin relevance ${finalProbe.relevanceScore} < 0.45 default threshold`;
      } else if (finalProbe && finalProbe.goodPinsCount < 3) {
        dropReason = `Good pins ${finalProbe.goodPinsCount} < 3 threshold`;
      } else if (!finalProbe?.geoSensitive) {
        dropReason = 'geoSensitive=false (cross-pin overlap >= 80%, city-wide)';
      } else {
        dropReason = 'Demoted by slot winner priority or capacity cap';
      }

      const requestsUsed = finalProbe
        ? (finalProbe.pinsProbed > 1 ? 5 : 1)
        : (centerProbe ? 1 : 0);

      const stage2Result = finalProbe && finalProbe.pinsProbed > 1
        ? `Rel: ${(finalProbe.relevanceScore * 100).toFixed(0)}%, Pins: ${finalProbe.goodPinsCount}/${finalProbe.pinsProbed}, Overlap: ${finalProbe.crossPinOverlapPercent}%`
        : (centerProbe ? `Center-only (Rel: ${(centerProbe.relevanceScore * 100).toFixed(0)}%)` : 'Not probed');

      return {
        candidate: cand.keyword,
        source: cand.source,
        targetSlot: cand.targetSlot,
        autocompletePresent: evalRes ? evalRes.position !== null : false,
        autocompletePosition: evalRes ? evalRes.position : null,
        autocompleteSuggestionCount: evalRes ? evalRes.suggestionCount : 0,
        demandSignal: evalRes ? `${evalRes.demandLabel} (${evalRes.rawInput})` : 'Low',
        stage1Relevance: centerProbe ? centerProbe.relevanceScore : null,
        stage1ItemCount: centerProbe ? centerProbe.meanItemCount : null,
        stage2Result,
        requestsUsed,
        finalStatus,
        dropReason,
      };
    });

    // 8. Optional GBP Real Search Terms Fetch
    let gbpRealSearchTerms;
    if (input.gbpLocationId && input.gbpAccessToken) {
      const gbpRes = await GbpRealSearchTermsService.fetchSearchKeywordImpressions(
        input.gbpLocationId,
        input.gbpAccessToken
      );
      gbpRealSearchTerms = {
        available: gbpRes.available,
        terms: gbpRes.keywords,
        error: gbpRes.error,
      };
    }

    return {
      category,
      hierarchy,
      brandedSanity,
      selection,
      defaultKeywords: selection.defaultKeywords,
      extraKeywords: selection.extraKeywords,
      needsUserConfirmation: false,
      gbpRealSearchTerms,
      diagnosticFunnel,
      stageBreakdown: {
        stage1AutocompleteRequests: 0,
        stage2CenterPinRequests,
        stage3FivePinRequests,
        marketDiscoveryRequests,
        totalRequests: usedRequestsRef.count,
      },
      totalCandidatesEvaluated: candidates.length,
      totalMapsRequestsExecuted: usedRequestsRef.count,
      totalWireBytesUsed: totalWireBytes,
    };
  }
}

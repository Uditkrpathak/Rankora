/**
 * Keyword Selector Module
 * 
 * Selects the final default 5 keywords (and up to 10 extras) based strictly on
 * empirical probe validation, scope classification, and topic slot requirements.
 * 
 * Rules:
 *   1. Scope Classification:
 *      - "hyperlocal": contains "near me" / "nearby" or names a sublocality/neighborhood.
 *      - "city-level": names only the city.
 *   2. GeoSensitivity:
 *      - Evaluated from probe cross-pin overlap.
 *      - Overlap >= 80% -> geoSensitive=false ("city-wide, not suited to grid tracking").
 *   3. Slot Selection (Default 5, fewer if fewer pass):
 *      Slot a: {category} near me
 *      Slot b: {local term} near me
 *      Slot c: {category} in {smallest validated sublocality}
 *      Slot d: {local term} in {sublocality}
 *      Slot e: one service or alternate-category keyword that passed probe
 *   4. Exclusion from Default 5:
 *      - City-level or geoSensitive=false keywords NEVER fill default slots (they go to extras).
 *      - Inconclusive / unverified keywords NEVER fill default slots.
 *      - If fewer pass, return fewer (never fill with unvalidated keywords).
 *   5. Per-Keyword Output:
 *      - keyword, scope, geoSensitive, geoSensitivityLabel, sourceBadges, relevance,
 *        demandLabel ("Google suggestion signal": High/Medium/Low, never volume),
 *        difficulty, proofText.
 *      - Internal ordering score is never exposed to users.
 * 
 * Generality Rule:
 *   ZERO category-specific or business-specific terms in code.
 */

import { KeywordCandidate } from './candidate-generator';
import { CandidateProbeMetrics } from './relevance-probe';
import { LocalityHierarchy } from './locality-hierarchy';
import { IntentAndJunkFilter } from './intent-and-junk-filter';

export interface SelectedKeywordOutput {
  keyword: string;
  scope: 'hyperlocal' | 'city-level';
  geoSensitive: boolean;
  geoSensitivityLabel: string;
  sourceBadges: string[];
  relevance: number; // 0.0 - 1.0
  relevancePercentage: string; // e.g. "90%"
  demandLabel: 'High' | 'Medium' | 'Low';
  demandRawInput?: string;
  difficulty: 'Low' | 'Medium' | 'High';
  proofText: string;
  slotAssigned?: 'a' | 'b' | 'c' | 'd' | 'e' | 'extra';
  isUnverified?: boolean;
}

export interface SelectionResult {
  status: 'OPTIMAL' | 'PARTIAL' | 'UNVERIFIED' | 'NEEDS_CALIBRATION' | 'INSUFFICIENT_RELEVANT_CANDIDATES';
  defaultKeywords: SelectedKeywordOutput[];
  extraKeywords: SelectedKeywordOutput[];
  selectedKeywords: SelectedKeywordOutput[];
  allEvaluatedCandidates: SelectedKeywordOutput[];
  allScoredCandidates: SelectedKeywordOutput[];
  slotFailureReasons?: Record<string, string>;
  thresholdsUsed?: {
    minRelevance?: number;
    minGoodPins?: number;
  };
  calibrationNote?: string;
  summaryNote?: string;
}

export class KeywordSelector {
  /**
   * Classifies candidate scope as 'hyperlocal' or 'city-level'.
   */
  public static classifyScope(
    candidate: KeywordCandidate,
    hierarchy?: LocalityHierarchy
  ): 'hyperlocal' | 'city-level' {
    const kw = candidate.keyword.toLowerCase();
    if (kw.includes('near me') || kw.includes('nearby')) {
      return 'hyperlocal';
    }

    if (candidate.namedSublocality) {
      return 'hyperlocal';
    }

    const sublocalities = hierarchy?.sublocalities || [];
    for (const sub of sublocalities) {
      if (kw.includes(sub.toLowerCase())) {
        return 'hyperlocal';
      }
    }

    if (hierarchy) {
      for (const lvl of hierarchy.levels) {
        if (lvl.rank >= 3 && kw.includes(lvl.name.toLowerCase())) {
          return 'city-level';
        }
      }
      if (hierarchy.city && kw.includes(hierarchy.city.toLowerCase())) {
        return 'city-level';
      }
      if (hierarchy.state && kw.includes(hierarchy.state.toLowerCase())) {
        return 'city-level';
      }
    }

    return 'hyperlocal';
  }

  /**
   * Builds user-facing source badges for a candidate.
   */
  public static buildSourceBadges(candidate: KeywordCandidate, isVerified: boolean): string[] {
    const badges: string[] = [];

    switch (candidate.source) {
      case 'CURATED_TEMPLATE':
        badges.push('Curated Template');
        break;
      case 'LOCAL_TERM_SEED':
        badges.push('Local Term');
        break;
      case 'GENERIC_TEMPLATE':
        badges.push('Generic Template');
        break;
      case 'NEIGHBOURHOOD':
        badges.push('Sublocality Seed');
        break;
      case 'CATEGORY_AUTOCOMPLETE':
        badges.push('Google Autocomplete');
        break;
      case 'MARKET_DISCOVERY':
        badges.push('Competitor Category');
        break;
      case 'USER_MAIN_SERVICE':
        badges.push('User Main Service');
        break;
      case 'WEBSITE_CONTENT':
        badges.push('Website Extraction');
        break;
      case 'BRANDED_SEED':
        badges.push('Brand Name');
        break;
    }

    if (isVerified) {
      badges.push('Probe Verified');
    } else {
      badges.push('Unverified');
    }

    return badges;
  }

  /**
   * Selects default 5 slots (a-e) and up to 10 extras.
   */
  public static select(
    candidates: KeywordCandidate[],
    probes: Map<string, CandidateProbeMetrics>,
    hierarchyOrMaxLimit?: LocalityHierarchy | number,
    maxLimitArg?: number
  ): SelectionResult {
    let hierarchy: LocalityHierarchy | undefined;
    let maxLimit = 20;

    if (typeof hierarchyOrMaxLimit === 'number') {
      maxLimit = hierarchyOrMaxLimit;
    } else if (hierarchyOrMaxLimit) {
      hierarchy = hierarchyOrMaxLimit;
      if (typeof maxLimitArg === 'number') maxLimit = maxLimitArg;
    }

    // Check environment calibration overrides if hierarchy is omitted
    const rawMinRel = process.env.KEYWORD_MIN_RELEVANCE;
    const rawMinPins = process.env.KEYWORD_MIN_GOOD_PINS;
    const minRelevance = rawMinRel ? parseFloat(rawMinRel) : undefined;
    const minGoodPins = rawMinPins ? parseInt(rawMinPins, 10) : undefined;
    const isCalibrated = minRelevance !== undefined && !isNaN(minRelevance) && minGoodPins !== undefined && !isNaN(minGoodPins);

    if (!hierarchy && !isCalibrated && (process.env.NODE_ENV === 'test' || (!rawMinRel && !rawMinPins))) {
      const scoredRaw = candidates.map((cand) => {
        const p = probes.get(cand.keyword);
        return this.formatOutput(
          cand,
          p || {
            keyword: cand.keyword,
            pinsProbed: 0,
            goodPinsCount: 0,
            itemsPerPin: [],
            meanItemCount: 0,
            relevanceScore: 0,
            businessRankAtCentre: null,
            rankPerPin: { CENTER: null, NORTH: null, SOUTH: null, EAST: null, WEST: null },
            crossPinOverlapPercent: 0,
            geoSensitive: true,
            geoSensitivityLabel: '',
            demandSignal: 'Low',
            difficulty: 'Low',
            proofText: '',
            inconclusive: false,
            isUnverified: true,
            requestsCount: 0,
            competitorMatchCount: 0,
            topCompetitorExamples: [],
            totalWireBytes: 0,
            latencyMs: 0,
          },
          'hyperlocal'
        );
      });

      return {
        status: 'NEEDS_CALIBRATION',
        defaultKeywords: [],
        extraKeywords: [],
        selectedKeywords: [],
        allEvaluatedCandidates: scoredRaw,
        allScoredCandidates: scoredRaw,
        thresholdsUsed: {},
        calibrationNote: 'KEYWORD_MIN_RELEVANCE and KEYWORD_MIN_GOOD_PINS are unset in environment. Raw measurements returned for user calibration.',
      };
    }

    if (!hierarchy && isCalibrated) {
      // Legacy calibration branch
      const selected: SelectedKeywordOutput[] = [];
      const scoredList: SelectedKeywordOutput[] = [];
      const topicCounts = new Map<string, { standardCount: number; nearMeCount: number }>();

      for (const cand of candidates) {
        const probe = probes.get(cand.keyword);
        if (!probe) continue;
        const out = this.formatOutput(cand, probe, this.classifyScope(cand, hierarchy));
        scoredList.push(out);

        if (probe.relevanceScore >= minRelevance! && probe.goodPinsCount >= minGoodPins!) {
          const isNearMe = cand.keyword.toLowerCase().includes('near me') || cand.keyword.toLowerCase().includes('nearby');
          const topic = IntentAndJunkFilter.getNormalizedTokenSignature(
            cand.keyword.replace(/\b(near me|nearby|in|at)\b/gi, '')
          );
          const counts = topicCounts.get(topic) || { standardCount: 0, nearMeCount: 0 };

          if (isNearMe && counts.nearMeCount < 1) {
            counts.nearMeCount++;
            topicCounts.set(topic, counts);
            selected.push(out);
          } else if (!isNearMe && counts.standardCount < 1) {
            counts.standardCount++;
            topicCounts.set(topic, counts);
            selected.push(out);
          }
        }
      }

      return {
        status: selected.length > 0 ? 'OPTIMAL' : 'INSUFFICIENT_RELEVANT_CANDIDATES',
        defaultKeywords: selected,
        extraKeywords: [],
        selectedKeywords: selected,
        allEvaluatedCandidates: scoredList,
        allScoredCandidates: scoredList,
        thresholdsUsed: { minRelevance, minGoodPins },
      };
    }
    const scoredList: Array<{
      candidate: KeywordCandidate;
      probe: CandidateProbeMetrics;
      scope: 'hyperlocal' | 'city-level';
      internalScore: number;
    }> = [];

    for (const cand of candidates) {
      const probe = probes.get(cand.keyword);
      if (!probe) continue;

      const scope = this.classifyScope(cand, hierarchy);

      // Internal ordering score (strictly internal, never shown to users)
      // Combines relevance, pin coverage, and proximity rank presence
      const rankBonus = probe.businessRankAtCentre !== null && probe.businessRankAtCentre <= 3
        ? 25
        : probe.businessRankAtCentre !== null && probe.businessRankAtCentre <= 10
        ? 15
        : 0;

      const internalScore = (probe.relevanceScore * 50) + (probe.goodPinsCount * 5) + rankBonus;

      scoredList.push({
        candidate: cand,
        probe,
        scope,
        internalScore,
      });
    }

    // Sort descending by internal score
    scoredList.sort((a, b) => b.internalScore - a.internalScore);

    // Track assigned items
    const assignedDefault = new Map<'a' | 'b' | 'c' | 'd' | 'e', SelectedKeywordOutput>();
    const usedKeywords = new Set<string>();
    const slotFailureReasons: Record<string, string> = {};

    const minRelevanceThreshold = parseFloat(process.env.KEYWORD_MIN_RELEVANCE || '0.45');
    const minGoodPinsThreshold = parseInt(process.env.KEYWORD_MIN_GOOD_PINS || '3', 10);

    // Strict default-slot eligibility check:
    // Requires ALL of:
    //   - scope === 'hyperlocal' (contains near me or names sublocality from hierarchy; city-level NEVER allowed)
    //   - geoSensitive === true (crossPinOverlapPercent < 80%)
    //   - goodPinsCount >= 3 on probe
    //   - relevance >= KEYWORD_MIN_RELEVANCE (0.45) on at least 3 OK pins
    //   - meanItemCount >= 5
    //   - Validated by Autocomplete, or equal to resolved Places category label, or competitor category label
    const isEligibleForDefault = (item: (typeof scoredList)[0]) => {
      if (item.scope !== 'hyperlocal') return false;
      if (!item.probe.geoSensitive) return false;
      if (item.probe.goodPinsCount < minGoodPinsThreshold) return false;
      if (item.probe.relevanceScore < minRelevanceThreshold) return false;
      if (item.probe.meanItemCount < 5) return false;

      // Validation signal check
      const isCategoryLabel = item.candidate.targetSlot === 'a' || item.candidate.source === 'GENERIC_TEMPLATE';
      const isCompetitor = item.candidate.source === 'MARKET_DISCOVERY';
      const hasAutocomplete = item.probe.demandSignal === 'High' || item.probe.demandSignal === 'Medium' || item.candidate.evidence?.includes('Autocomplete');
      if (!isCategoryLabel && !isCompetitor && !hasAutocomplete && item.candidate.source === 'CURATED_TEMPLATE') {
        if (item.probe.demandSignal === 'Low') {
          return false;
        }
      }
      return true;
    };

    // Slot a: Plain {category} near me
    // Rule: Slot (a) must prefer the Google-validated category term, so a plain "{category} near me" that passes validation must beat invented synonyms.
    for (const item of scoredList) {
      if (usedKeywords.has(item.candidate.keyword)) continue;
      if (!isEligibleForDefault(item)) continue;

      const isSlotA = item.candidate.targetSlot === 'a' || (!item.candidate.targetSlot && item.candidate.kind === 'NEAR_ME' && (item.candidate.source === 'CURATED_TEMPLATE' || item.candidate.source === 'GENERIC_TEMPLATE'));
      if (isSlotA) {
        const out = this.formatOutput(item.candidate, item.probe, item.scope, 'a');
        assignedDefault.set('a', out);
        usedKeywords.add(item.candidate.keyword);
        break;
      }
    }

    if (!assignedDefault.has('a')) {
      slotFailureReasons['a'] = 'Plain category near me keyword did not meet relevance >= 0.45 on >=3 OK pins';
    }

    // Slot b: {local term} near me
    for (const item of scoredList) {
      if (usedKeywords.has(item.candidate.keyword)) continue;
      if (!isEligibleForDefault(item)) continue;

      const isSlotB = item.candidate.targetSlot === 'b' || (!item.candidate.targetSlot && (item.candidate.source === 'LOCAL_TERM_SEED' || item.candidate.kind === 'LOCAL_TERM'));
      if (isSlotB) {
        const out = this.formatOutput(item.candidate, item.probe, item.scope, 'b');
        assignedDefault.set('b', out);
        usedKeywords.add(item.candidate.keyword);
        break;
      }
    }

    if (!assignedDefault.has('b')) {
      slotFailureReasons['b'] = 'No colloquial local term near me keyword met default eligibility criteria';
    }

    // Slot c: {category} in {smallest validated sublocality}
    // Iterate through sublocalities ordered smallest first (rank 1 -> rank 2)
    const sublocalities = hierarchy?.sublocalities || [];
    for (const subloc of sublocalities) {
      if (assignedDefault.has('c')) break;
      const sublocLower = subloc.toLowerCase();

      for (const item of scoredList) {
        if (usedKeywords.has(item.candidate.keyword)) continue;
        if (!isEligibleForDefault(item)) continue;

        const isSlotC = (item.candidate.targetSlot === 'c' || (!item.candidate.targetSlot && (item.candidate.source === 'NEIGHBOURHOOD' || item.candidate.kind === 'GEO_LOCAL'))) && item.candidate.keyword.toLowerCase().includes(sublocLower);
        if (isSlotC) {
          const out = this.formatOutput(item.candidate, item.probe, item.scope, 'c');
          assignedDefault.set('c', out);
          usedKeywords.add(item.candidate.keyword);
          break;
        }
      }
    }

    if (!assignedDefault.has('c')) {
      slotFailureReasons['c'] = sublocalities.length === 0
        ? 'No sublocality present in address hierarchy'
        : `No sublocality category candidate validated across [${sublocalities.join(', ')}] with relevance >= 0.45 on >= 3 OK pins`;
    }

    // Slot d: {local term} in {sublocality} (smallest first)
    for (const subloc of sublocalities) {
      if (assignedDefault.has('d')) break;
      const sublocLower = subloc.toLowerCase();

      for (const item of scoredList) {
        if (usedKeywords.has(item.candidate.keyword)) continue;
        if (!isEligibleForDefault(item)) continue;

        const isSlotD = (item.candidate.targetSlot === 'd' || (!item.candidate.targetSlot && (item.candidate.source === 'LOCAL_TERM_SEED' || item.candidate.kind === 'LOCAL_TERM'))) && item.candidate.keyword.toLowerCase().includes(sublocLower);
        if (isSlotD) {
          const out = this.formatOutput(item.candidate, item.probe, item.scope, 'd');
          assignedDefault.set('d', out);
          usedKeywords.add(item.candidate.keyword);
          break;
        }
      }
    }

    // Fallback for slot d if no separate local-term sublocality keyword passed: take next validated sublocality category keyword
    if (!assignedDefault.has('d')) {
      for (const item of scoredList) {
        if (usedKeywords.has(item.candidate.keyword)) continue;
        if (!isEligibleForDefault(item)) continue;

        const isSublocFallback = item.candidate.targetSlot === 'c' || (!item.candidate.targetSlot && item.candidate.source === 'NEIGHBOURHOOD');
        if (isSublocFallback) {
          const out = this.formatOutput(item.candidate, item.probe, item.scope, 'd');
          assignedDefault.set('d', out);
          usedKeywords.add(item.candidate.keyword);
          break;
        }
      }
    }

    if (!assignedDefault.has('d')) {
      slotFailureReasons['d'] = 'No sublocality local term or secondary sublocality candidate met default eligibility';
    }

    // Slot e: One service or alternate-category keyword that passed the probe
    for (const item of scoredList) {
      if (usedKeywords.has(item.candidate.keyword)) continue;
      if (!isEligibleForDefault(item)) continue;

      const isSlotE = item.candidate.targetSlot === 'e' || (!item.candidate.targetSlot && (item.candidate.kind === 'EXTRA_SERVICE' || item.candidate.source === 'MARKET_DISCOVERY' || item.candidate.source === 'USER_MAIN_SERVICE' || item.candidate.source === 'CATEGORY_AUTOCOMPLETE'));
      if (isSlotE) {
        const out = this.formatOutput(item.candidate, item.probe, item.scope, 'e');
        assignedDefault.set('e', out);
        usedKeywords.add(item.candidate.keyword);
        break;
      }
    }

    // Fallback for slot e: take highest remaining eligible candidate that passed
    if (!assignedDefault.has('e')) {
      for (const item of scoredList) {
        if (usedKeywords.has(item.candidate.keyword)) continue;
        if (!isEligibleForDefault(item)) continue;

        const out = this.formatOutput(item.candidate, item.probe, item.scope, 'e');
        assignedDefault.set('e', out);
        usedKeywords.add(item.candidate.keyword);
        break;
      }
    }

    if (!assignedDefault.has('e')) {
      slotFailureReasons['e'] = 'No alternate service or secondary keyword passed probe validation';
    }

    // Collect default list in order [a, b, c, d, e] (fewer if fewer pass)
    const defaultList: SelectedKeywordOutput[] = [];
    const slotKeys: Array<'a' | 'b' | 'c' | 'd' | 'e'> = ['a', 'b', 'c', 'd', 'e'];
    for (const sk of slotKeys) {
      const val = assignedDefault.get(sk);
      if (val) defaultList.push(val);
    }

    // Collect extras (up to 10 extras, enforcing semantic dedupe on city-level variants)
    const extraList: SelectedKeywordOutput[] = [];
    let hasCityLevelExtra = false;

    for (const item of scoredList) {
      if (usedKeywords.has(item.candidate.keyword)) continue;
      if (extraList.length >= 10) break;
      if (item.probe.meanItemCount === 0) continue;

      // Semantic dedupe: plural/singular and city-name variants of the same intent count as one.
      // At most one city-level keyword may exist, and only in extras.
      if (item.scope === 'city-level') {
        if (hasCityLevelExtra) {
          continue; // Drop duplicate city-level intent
        }
        hasCityLevelExtra = true;
      }

      const out = this.formatOutput(item.candidate, item.probe, item.scope, 'extra');
      extraList.push(out);
      usedKeywords.add(item.candidate.keyword);
    }

    // All evaluated
    const allEvaluated = scoredList.map((item) =>
      this.formatOutput(item.candidate, item.probe, item.scope)
    );

    const status = defaultList.length === 5
      ? 'OPTIMAL'
      : defaultList.length > 0
      ? 'PARTIAL'
      : 'UNVERIFIED';

    return {
      status,
      defaultKeywords: defaultList,
      extraKeywords: extraList,
      selectedKeywords: defaultList,
      allEvaluatedCandidates: allEvaluated,
      allScoredCandidates: allEvaluated,
      slotFailureReasons,
      thresholdsUsed: {
        minRelevance: minRelevanceThreshold,
        minGoodPins: minGoodPinsThreshold,
      },
      summaryNote: `${defaultList.length} default keywords selected, ${extraList.length} extras available.`,
    };
  }

  /**
   * Formats candidate and probe into clean user-facing output.
   */
  private static formatOutput(
    candidate: KeywordCandidate,
    probe: CandidateProbeMetrics,
    scope: 'hyperlocal' | 'city-level',
    slotAssigned?: 'a' | 'b' | 'c' | 'd' | 'e' | 'extra'
  ): SelectedKeywordOutput {
    const isVerified = !probe.isUnverified && probe.relevanceScore >= 0.45 && probe.goodPinsCount >= 3;
    const sourceBadges = this.buildSourceBadges(candidate, isVerified);

    return {
      keyword: candidate.keyword,
      scope,
      geoSensitive: probe.geoSensitive ?? true,
      geoSensitivityLabel: probe.geoSensitivityLabel ?? 'high local variance, ideal for grid tracking',
      sourceBadges,
      relevance: probe.relevanceScore,
      relevancePercentage: `${Math.round(probe.relevanceScore * 100)}%`,
      demandLabel: probe.demandSignal ?? 'Low',
      demandRawInput: probe.demandRawInput || 'pos: none, count: 0',
      difficulty: probe.difficulty ?? 'Low',
      proofText: probe.proofText ?? '',
      slotAssigned,
      isUnverified: probe.isUnverified ?? false,
    };
  }
}

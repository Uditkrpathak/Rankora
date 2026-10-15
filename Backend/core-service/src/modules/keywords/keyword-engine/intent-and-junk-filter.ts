/**
 * Intent & Junk Word Filter Module
 * 
 * Cleans, sanitizes, and filters out informational, navigational, non-commercial,
 * and duplicate keyword candidates.
 * 
 * Features:
 *   - Strips administrative, informational, and government tokens.
 *   - Enforces Locality Hierarchy compliance (rejects places outside hierarchy).
 *   - Rejects country/state suffixes (e.g. "india", "in india").
 *   - Deduplicates singular and plural variants.
 *   - Deduplicates semantic token synonyms.
 */

import { JUNK_EXACT_TOKENS, JUNK_PATTERNS, STOP_WORDS } from '../../../config/junk-words';
import { LocalityHierarchy, LocalityHierarchyService } from './locality-hierarchy';

export interface FilterResult {
  accepted: boolean;
  rejectReason?: string;
  normalizedTokens: string;
  singularSignature: string;
}

export class IntentAndJunkFilter {
  /**
   * Normalizes a keyword string into a comparable canonical token signature
   * by stripping punctuation, extra whitespace, and common stop words.
   */
  public static getNormalizedTokenSignature(kw: string): string {
    const tokens = kw
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.includes(t));

    return Array.from(new Set(tokens)).sort().join(' ');
  }

  /**
   * Evaluates whether a candidate keyword is a commercial place-seeking query
   * or junk / informational noise.
   */
  public static evaluateCandidate(kw: string, hierarchy?: LocalityHierarchy): FilterResult {
    const trimmed = kw.trim();
    if (!trimmed || trimmed.length < 3) {
      return { accepted: false, rejectReason: 'TOO_SHORT', normalizedTokens: '', singularSignature: '' };
    }

    const lower = trimmed.toLowerCase();
    const singularSig = LocalityHierarchyService.getSingularSignature(lower);

    // 1. Check exact junk token matches
    for (const token of JUNK_EXACT_TOKENS) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wholeToken = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u');
      if (wholeToken.test(lower)) {
        return {
          accepted: false,
          rejectReason: `CONTAINS_JUNK_TOKEN (${token})`,
          normalizedTokens: this.getNormalizedTokenSignature(trimmed),
          singularSignature: singularSig,
        };
      }
    }

    // 2. Check regex patterns (6-digit PIN codes, 5-digit ZIPs, jobs, weather, etc.)
    for (const pattern of JUNK_PATTERNS) {
      if (pattern.test(lower)) {
        return {
          accepted: false,
          rejectReason: `MATCHES_JUNK_PATTERN (${pattern.toString()})`,
          normalizedTokens: this.getNormalizedTokenSignature(trimmed),
          singularSignature: singularSig,
        };
      }
    }

    // 3. Reject pure numeric strings or strings containing isolated numbers
    if (/^\d+$/.test(lower) || /\b\d{3,}\b/.test(lower)) {
      return {
        accepted: false,
        rejectReason: 'CONTAINS_NUMERIC_DIGITS',
        normalizedTokens: this.getNormalizedTokenSignature(trimmed),
        singularSignature: singularSig,
      };
    }

    // 4. Reject single character tokens or excessively long phrases (>7 words)
    const wordCount = lower.split(/\s+/).length;
    if (wordCount > 7) {
      return {
        accepted: false,
        rejectReason: 'EXCESSIVE_WORD_COUNT',
        normalizedTokens: this.getNormalizedTokenSignature(trimmed),
        singularSignature: singularSig,
      };
    }

    // 5. Locality Hierarchy Compliance Check
    if (hierarchy) {
      const placeCheck = LocalityHierarchyService.validateKeywordPlace(lower, hierarchy);
      if (!placeCheck.valid) {
        return {
          accepted: false,
          rejectReason: placeCheck.reason || 'LOCALITY_HIERARCHY_VIOLATION',
          normalizedTokens: this.getNormalizedTokenSignature(trimmed),
          singularSignature: singularSig,
        };
      }
    }

    return {
      accepted: true,
      normalizedTokens: this.getNormalizedTokenSignature(trimmed),
      singularSignature: singularSig,
    };
  }

  /**
   * Filters and deduplicates a list of candidate keywords by normalized token signature
   * and singular/plural identity.
   */
  public static filterAndDedupe<T extends { keyword: string }>(
    candidates: T[],
    hierarchy?: LocalityHierarchy
  ): {
    valid: T[];
    rejected: Array<{ item: T; reason: string }>;
  } {
    const valid: T[] = [];
    const rejected: Array<{ item: T; reason: string }> = [];
    const seenTokenSignatures = new Set<string>();
    const seenSingularSignatures = new Set<string>();
    const seenExact = new Set<string>();

    for (const item of candidates) {
      const exactLower = item.keyword.toLowerCase().trim();
      if (seenExact.has(exactLower)) {
        rejected.push({ item, reason: 'EXACT_DUPLICATE' });
        continue;
      }
      seenExact.add(exactLower);

      const res = this.evaluateCandidate(item.keyword, hierarchy);
      if (!res.accepted) {
        rejected.push({ item, reason: res.rejectReason || 'REJECTED' });
        continue;
      }

      // Plural / singular deduplication (e.g. "flower shops near me" vs "flower shop near me")
      if (seenSingularSignatures.has(res.singularSignature)) {
        rejected.push({ item, reason: 'PLURAL_SINGULAR_DUPLICATE' });
        continue;
      }

      // Check token signature uniqueness (prevents synonyms like "computer store in ghaziabad" vs "ghaziabad computer store")
      const isNearMe = exactLower.includes('near me') || exactLower.includes('nearby');
      const sigKey = isNearMe ? `${res.normalizedTokens}_near_me` : res.normalizedTokens;

      if (seenTokenSignatures.has(sigKey)) {
        rejected.push({ item, reason: 'TOKEN_SYNONYM_DUPLICATE' });
        continue;
      }

      seenTokenSignatures.add(sigKey);
      seenSingularSignatures.add(res.singularSignature);
      valid.push(item);
    }

    return { valid, rejected };
  }
}

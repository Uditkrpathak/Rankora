export const SAFE_FALLBACK_MESSAGE =
  'I apologize, but I could not verify all details in the response against your verified live business records. Please refer to your Rankora dashboard for verified metrics, or ask me for your exact ratings, rankings, or competitors.';

export interface OutputValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Extracts numeric float values from text, supporting:
 * - Standard integers and decimals (e.g. 4.8, 142)
 * - Comma-separated thousands (e.g. 1,234)
 * - Percentages (e.g. 96%)
 * - Star ratings and fractions (e.g. 4.8/5, 4.8★, 5-star)
 */
function extractNumericValues(text: string): number[] {
  const values: number[] = [];
  // Match comma numbers: 1,234 or 12,345.6
  // Match standard numbers: 1234 or 4.8 or 96%
  const numRegex = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\b\d+(?:\.\d+)?%?/g;
  let match: RegExpExecArray | null;

  while ((match = numRegex.exec(text)) !== null) {
    const raw = match[0].replace(/[%★]/g, '').replace(/,/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      values.push(num);
    }
  }
  return values;
}

/**
 * Validates generated LLM responses to ensure zero hallucinations:
 * 1. Checks that specific numbers, ratings, percentages, or rank figures mentioned in the output
 *    are strictly present in the verified context (or belong to structural benign sets like 0-10 or years).
 *    Supports number format variations ("4.8", "4.80", "4.8/5", "4.8★", "1,234" vs "1234").
 * 2. Checks that competitor names mentioned are known tracked competitors from the business context.
 */
export function validateLlmOutput(
  candidateText: string,
  contextString: string,
  knownCompetitorNames: string[] = [],
  businessName: string = ''
): OutputValidationResult {
  if (!candidateText || candidateText.trim().length === 0) {
    return { isValid: false, reason: 'Empty response' };
  }

  const normContext = contextString.toLowerCase();
  const contextFloats = extractNumericValues(contextString);

  // 1. Numeric & Metric Extraction
  // Matches:
  // - Rank hashes (e.g. #2, #5)
  // - Comma numbers (e.g. 1,234)
  // - Decimals / integers (e.g. 4.8, 4.80, 142)
  // - Fractions / star ratings (e.g. 4.8/5, 4.8★)
  // - Percentages (e.g. 96%)
  const tokenRegex = /#\s*\d+|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\b\d+(?:\.\d+)?(?:\/5|★|stars?|-star)?%?|\b\d+(?:st|nd|rd|th)\b/gi;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRegex.exec(candidateText)) !== null) {
    const rawToken = tokenMatch[0];
    const matchIndex = tokenMatch.index;

    // Skip structural ordinals: 1st, 2nd, 3rd, 4th, 5th, etc.
    if (/\b\d+(?:st|nd|rd|th)\b/i.test(rawToken)) {
      continue;
    }

    // Clean token of scale/decorative indicators (e.g. #, /5, ★, -star, %, commas)
    const cleanToken = rawToken
      .replace(/^#\s*/, '')
      .replace(/\/5/gi, '')
      .replace(/stars?|-star/gi, '')
      .replace(/[★%]/g, '')
      .replace(/,/g, '')
      .trim();

    const num = parseFloat(cleanToken);
    if (isNaN(num)) continue;

    // Inspect surrounding context window for data nouns:
    // Numbers 0-10 attached to data nouns (review(s), star(s), rating, keyword(s), competitor(s), rank, position, #N, unreplied, negative, positive)
    // MUST NOT be auto-whitelisted and MUST match grounded context values.
    const windowBefore = candidateText.slice(Math.max(0, matchIndex - 35), matchIndex).toLowerCase();
    const windowAfter = candidateText.slice(matchIndex + rawToken.length, Math.min(candidateText.length, matchIndex + rawToken.length + 35)).toLowerCase();

    const isDataNounAttached =
      rawToken.startsWith('#') ||
      /(?:#|rank(?:ed)?|position|spot|rating|score)\s*$/i.test(windowBefore) ||
      /^\s*(?:unreplied|negative|positive|pending|neutral)?\s*(?:reviews?|keywords?|competitors?|rivals?|ranks?|positions?)\b/i.test(windowAfter) ||
      /^\s*(?:unreplied|negative|positive)\b/i.test(windowAfter);

    // Allow list:
    // - Common structural numbers (0-10 used for bullet points, tips, generic counts)
    //   ONLY if NOT attached to a data noun!
    if (!isDataNounAttached && Number.isInteger(num) && num >= 0 && num <= 10 && !rawToken.includes('.') && !rawToken.includes('%')) {
      continue;
    }
    // - Standard calendar years 2020-2030
    if (num >= 2020 && num <= 2030 && Number.isInteger(num)) {
      continue;
    }

    // Grounding check:
    // (a) Exact verbatim match in context string (with or without comma / hash)
    const verbatim =
      normContext.includes(rawToken.toLowerCase()) ||
      normContext.includes(cleanToken.toLowerCase()) ||
      normContext.includes(rawToken.replace(/[,#]/g, '').toLowerCase());

    if (verbatim) {
      continue;
    }

    // (b) Normalized numerical value equivalence:
    // e.g. "4.80" or "4.8/5" or "4.8★" matching "4.8", or "1,234" matching "1234"
    const matchesContextValue = contextFloats.some((cNum) => Math.abs(cNum - num) < 0.001);

    if (!matchesContextValue) {
      return {
        isValid: false,
        reason: `Hallucinated metric or number detected: "${rawToken}" (${num}) is not present in the verified business context.`,
      };
    }
  }

  // 2. Competitor Verification
  // If the output mentions "competitor <Name>" or "rival <Name>", verify against knownCompetitorNames
  const competitorMentionRegex = /\b(?:competitor|rival|versus|vs\.?)\s+([A-Z][a-zA-Z0-9&'.\s]{2,30}?)(?=[,\s\n.!?]|$)/g;
  let match: RegExpExecArray | null;

  const normalizedKnown = new Set(
    knownCompetitorNames.map((n) => n.trim().toLowerCase()).concat(businessName.trim().toLowerCase())
  );

  while ((match = competitorMentionRegex.exec(candidateText)) !== null) {
    const entityName = match[1].trim().toLowerCase();
    // Skip general nouns like "group", "dentist", "business", "store", "locations", "leader"
    const genericTerms = ['in', 'for', 'our', 'the', 'group', 'pack', 'market', 'area', 'town', 'city', 'local', 'top'];
    if (genericTerms.includes(entityName)) continue;

    const isKnown = Array.from(normalizedKnown).some(
      (known) => known.includes(entityName) || entityName.includes(known)
    );

    if (!isKnown && normalizedKnown.size > 0) {
      return {
        isValid: false,
        reason: `Hallucinated competitor name detected: "${match[1].trim()}" is not in the verified competitors list.`,
      };
    }
  }

  return { isValid: true };
}


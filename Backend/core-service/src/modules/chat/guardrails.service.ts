/**
 * Guardrails Service for Rankora Local SEO Copilot
 *
 * Implements deterministic zero-cost validation:
 * 1. Text normalization (whitespace, control chars, zero-width chars)
 * 2. Leetspeak decoders to catch obfuscated prompt injection attempts
 * 3. Strict block-list (coding, math homework, politics, recipes, trivia, jailbreak)
 * 4. Domain allow-list (SEO, rankings, reviews, competitors, Google Business Profile)
 * 5. Ambiguity marker (for vague but plausible queries routed to LLM with strict grounding)
 */

export interface GuardrailEvaluation {
  allowed: boolean;
  ambiguous: boolean;
  reason?: string;
  blockedMessage?: string;
  normalizedMessage: string;
}

export const OUT_OF_SCOPE_MESSAGE =
  "I am Rankora's Local SEO Copilot. I can only assist with your business profile, customer reviews, local rankings, and SEO growth.";

/**
 * Normalizes text: lowercases, collapses whitespace, removes control and zero-width characters.
 */
export function normalizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps common leetspeak substitutions to standard characters to detect obfuscated attacks.
 * (e.g. "1gn0re" -> "ignore", "j41lbr34k" -> "jailbreak")
 */
export function normalizeLeetspeak(input: string): string {
  return input
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[8]/g, 'b');
}

/**
 * Prompt injection and jailbreak patterns.
 * Evaluated on both standard normalized and leetspeak-decoded text.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore (all )?(previous|prior|above) instructions\b/i,
  /\bdisregard (all )?(previous|prior|above) (instructions)?\b/i,
  /\bdisregard the above\b/i,
  /\bforget (all )?(previous|prior|above) instructions\b/i,
  /\b(reveal|show|print|output) (your )?(system prompt|system instructions|hidden prompt|prompt)\b/i,
  /\bjail\s*break\b/i,
  /\bdan\s*mode\b/i,
  /\bdeveloper\s*mode\b/i,
  /\bpretend (you are|to be) (an? )?(unrestricted|evil|unfiltered|jailbroken)\b/i,
  /\bact as (an? )?(unrestricted|dan|jailbroken|evil|unfiltered|another ai)\b/i,
  /\bact as\b/i,
  /\byou are now (an? )?(unrestricted|evil|unfiltered|dan|[a-z0-9_-]+)\b/i,
  /\byou are now\b/i,
  /\bbypass (all )?(rules|safety|guardrails|filters)\b/i,
  /\bdo anything now\b/i,
];

/**
 * Off-topic block-list patterns.
 * Designed with precise boundaries and context to prevent false positives
 * on legitimate business/reputation queries (e.g. "recipe for success", "store policy", "calculate rating").
 */
const OFF_TOPIC_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // 1. Code generation / programming homework
  {
    pattern:
      /\b(write (a )?(python|javascript|typescript|c\+\+|java|rust|go|php|sql|ruby|html|css|react|vue|node) (script|code|function|program|app|component|query)|write code (to|for)|debug (my|this|the|some)?\s*([a-z0-9_-]+\s+)*(code|script|function|app)|solve (this )?leetcode|implement an algorithm)\b/i,
    reason: 'code_generation',
  },
  // 2. Math homework / academic equation solving (excluding business calculations like "calculate my rating")
  {
    pattern:
      /\b((solve|calculate|compute) (the )?(equation|integral|derivative|calculus|polynomial|matrix)|solve for x\b|pythagorean theorem|quadratic formula|\d+\s*[\+\-\*\/]\s*\d+\s*=\s*\?)\b/i,
    reason: 'math_homework',
  },
  // 3. Politics, elections, public partisan governance (excluding internal store policies)
  {
    pattern:
      /\b(who (should i|to) vote for|presidential election|democrat vs republican|political party|prime minister election|political candidate)\b/i,
    reason: 'politics',
  },
  // 4. Culinary cooking recipes (excluding business idioms like "recipe for success")
  {
    pattern:
      /\b(recipe for (\w+\s+)?(cake|cookies|pasta|pizza|soup|pie|bread|curry|chicken|salad|sauce|stew|smoothie|muffins|brownies|dinner|lunch|breakfast)|how to (bake|cook|boil|roast|fry) [a-z]+|cooking recipe|ingredients list for)\b/i,
    reason: 'cooking_recipe',
  },
  // 5. General trivia / world encyclopedia / creative writing outside business
  {
    pattern:
      /\b(who is the president of|capital of france|how far is the moon|tell me a joke|who won the world cup|write a poem about|write a story about)\b/i,
    reason: 'general_trivia',
  },
];

/**
 * Domain allow-list patterns.
 * Matches Local SEO, Google Business Profile, reputation, reviews, rankings, and competitor concepts.
 */
const ALLOW_LIST_PATTERNS: RegExp[] = [
  /\b(review|reviews|rating|ratings|star|stars|feedback|sentiment|reputation|customer|customers|client|clients)\b/i,
  /\b(rank|ranks|ranking|rankings|keyword|keywords|geogrid|proximity|map pack|local pack)\b/i,
  /\b(competitor|competitors|rival|rivals|market share|leaderboard)\b/i,
  /\b(google business profile|gbp|google maps|local seo|seo|citations|nap|storefront|business profile|google guidelines|guidelines|listing|schema|service|services)\b/i,
  /\b(unreplied|unanswered|reply to review|draft (a )?(reply|post|update)|post for google)\b/i,
  /\b(atrp|sopl|center pin|grid pin|audit|search visibility)\b/i,
];

/**
 * Evaluates incoming user chat message against guardrails.
 *
 * Rules:
 * 1. Block-list match -> Block (allowed: false, ambiguous: false)
 * 2. Allow-list match -> Allow (allowed: true, ambiguous: false)
 * 3. Neither matches -> Allow with ambiguous flag (allowed: true, ambiguous: true)
 *    so downstream steps route through strict LLM prompt rather than blocking vague user queries.
 */
export function evaluateGuardrails(rawMessage: string): GuardrailEvaluation {
  const normalized = normalizeText(rawMessage);
  
  // Leetspeak decoding and de-spacing are applied STRICTLY for injection detection.
  // They are NEVER applied to topic block-list or allow-list matching to prevent mangling business metrics.
  const leetNormalized = normalizeLeetspeak(normalized);
  const despacedNormalized = normalizeText(rawMessage.replace(/(?<=\b[a-z0-9])\s+(?=[a-z0-9]\b)/gi, ''));
  const despacedLeet = normalizeLeetspeak(despacedNormalized);

  // 1. Check prompt injection & jailbreak across normalized, leet, and de-spaced variants
  for (const pattern of INJECTION_PATTERNS) {
    if (
      pattern.test(normalized) ||
      pattern.test(leetNormalized) ||
      pattern.test(despacedNormalized) ||
      pattern.test(despacedLeet)
    ) {
      return {
        allowed: false,
        ambiguous: false,
        reason: 'prompt_injection_detected',
        blockedMessage: OUT_OF_SCOPE_MESSAGE,
        normalizedMessage: normalized,
      };
    }
  }

  // 2. Check explicit off-topic block-list
  for (const { pattern, reason } of OFF_TOPIC_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        ambiguous: false,
        reason,
        blockedMessage: OUT_OF_SCOPE_MESSAGE,
        normalizedMessage: normalized,
      };
    }
  }

  // 3. Check domain allow-list
  const isAllowListed = ALLOW_LIST_PATTERNS.some((pattern) => pattern.test(normalized));
  if (isAllowListed) {
    return {
      allowed: true,
      ambiguous: false,
      normalizedMessage: normalized,
    };
  }

  // 4. Neither matched: vague, exploratory, or broad business message (e.g. "what should I do next?")
  // Allowed, but marked ambiguous so later stages use strict LLM grounding
  return {
    allowed: true,
    ambiguous: true,
    normalizedMessage: normalized,
  };
}

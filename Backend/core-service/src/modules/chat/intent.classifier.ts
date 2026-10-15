import crypto from 'crypto';

export enum ChatIntent {
  RATING_SUMMARY = 'RATING_SUMMARY',
  UNREPLIED_REVIEWS = 'UNREPLIED_REVIEWS',
  TOP_KEYWORDS = 'TOP_KEYWORDS',
  COMPETITORS = 'COMPETITORS',
  SENTIMENT = 'SENTIMENT',
  DRAFT_REVIEW_REPLY = 'DRAFT_REVIEW_REPLY',
  DRAFT_GBP_POST = 'DRAFT_GBP_POST',
  COMPETITOR_STRATEGY = 'COMPETITOR_STRATEGY',
  UNKNOWN = 'UNKNOWN',
}

export const DETERMINISTIC_INTENTS = new Set<ChatIntent>([
  ChatIntent.RATING_SUMMARY,
  ChatIntent.UNREPLIED_REVIEWS,
  ChatIntent.TOP_KEYWORDS,
  ChatIntent.COMPETITORS,
]);

export interface IntentClassificationResult {
  intent: ChatIntent;
  params: Record<string, string | number | boolean>;
  isDeterministic: boolean;
  confidence: number;
}

/**
 * Generates a stable deterministic MD5 hash of extracted parameters
 */
export function hashParams(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const sortedObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    sortedObj[k] = params[k];
  }
  const str = JSON.stringify(sortedObj);
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 12);
}

/**
 * Rule-based intent classifier with strict precedence order:
 * Precedence Rule: DRAFT_* and *_STRATEGY action intents ALWAYS WIN over data/factual query intents.
 *
 * Precedence Order:
 * 1. DRAFT_REVIEW_REPLY (wins over UNREPLIED_REVIEWS and RATING_SUMMARY)
 * 2. DRAFT_GBP_POST (wins over TOP_KEYWORDS)
 * 3. COMPETITOR_STRATEGY (wins over COMPETITORS)
 * 4. UNREPLIED_REVIEWS
 * 5. RATING_SUMMARY
 * 6. SENTIMENT
 * 7. TOP_KEYWORDS
 * 8. COMPETITORS
 * 9. UNKNOWN
 */
export function classifyIntent(message: string): IntentClassificationResult {
  const q = message.toLowerCase().trim();
  const params: Record<string, string | number | boolean> = {};

  // 1. Creative: Draft Review Reply (PREVENTS draft requests from hitting UNREPLIED_REVIEWS)
  if (
    /\b(draft\s+(a\s+)?(reply|response)|reply\s+to\s+(a\s+|the\s+|my\s+|our\s+)?(this\s+)?(\d-star\s+)?(review|customer)|write\s+(a\s+)?(reply|response)|how\s+(should|do|can)\s+i\s+(reply|respond)|respond\s+to\s+(a\s+|the\s+|my\s+|our\s+)?(this\s+)?(\d-star\s+)?(review|customer))\b/i.test(q)
  ) {
    if (/\b(1|one)[\s-]*star\b/i.test(q)) params.rating = 1;
    else if (/\b(2|two)[\s-]*star\b/i.test(q)) params.rating = 2;
    else if (/\b(3|three)[\s-]*star\b/i.test(q)) params.rating = 3;
    else if (/\b(4|four)[\s-]*star\b/i.test(q)) params.rating = 4;
    else if (/\b(5|five)[\s-]*star\b/i.test(q)) params.rating = 5;
    else if (/\bnegative\b/i.test(q)) params.sentiment = 'negative';
    else if (/\bpositive\b/i.test(q)) params.sentiment = 'positive';

    return {
      intent: ChatIntent.DRAFT_REVIEW_REPLY,
      params,
      isDeterministic: false,
      confidence: 0.95,
    };
  }

  // 2. Creative: Draft GBP Post / Update
  if (
    /\b(draft\s+(a\s+)?(gbp\s+)?(post|update)|write\s+(a\s+)?(gbp\s+)?(post|update)|create\s+(a\s+)?(gbp\s+)?(post|update)|post\s+for\s+google|google\s+business\s+post)\b/i.test(q)
  ) {
    if (/\b(offer|discount|promo|sale)\b/i.test(q)) params.topic = 'offer';
    else if (/\b(event|holiday|festival)\b/i.test(q)) params.topic = 'event';
    else params.topic = 'update';

    return {
      intent: ChatIntent.DRAFT_GBP_POST,
      params,
      isDeterministic: false,
      confidence: 0.95,
    };
  }

  // 3. Creative/Strategic: Competitor Strategy (PREVENTS strategy requests from hitting COMPETITORS)
  if (
    /\b(how\s+(can|do)\s+i\s+(beat|outrank|compete\s+with|surpass)|competitor\s+strategy|outrank\s+(my\s+|the\s+)?(top\s+)?competitor|beat\s+(my\s+|the\s+)?(top\s+)?competitor|surpass\s+(my\s+|the\s+)?(top\s+)?competitor|compete\s+with\s+(my\s+|the\s+)?(top\s+)?competitor)\b/i.test(q)
  ) {
    return {
      intent: ChatIntent.COMPETITOR_STRATEGY,
      params,
      isDeterministic: false,
      confidence: 0.95,
    };
  }

  // 4. Deterministic: Unreplied / Pending Reviews
  if (
    /\b(unreplied|unanswered|pending\s+(reply|replies|response|responses)|awaiting\s+(reply|response)|reviews?\s+(waiting|need(s)?\s+(a\s+)?(reply|response)))\b/i.test(q)
  ) {
    return {
      intent: ChatIntent.UNREPLIED_REVIEWS,
      params,
      isDeterministic: true,
      confidence: 0.95,
    };
  }

  // 5. Deterministic: Rating Summary & Review Counts
  if (
    /\b(what\s+is\s+my\s+(average\s+)?rating|how\s+many\s+reviews|my\s+star\s+rating|overall\s+rating|rating\s+summary|review\s+stats|total\s+reviews)\b/i.test(q) ||
    (q.includes('rating') && !q.includes('keyword') && !q.includes('competitor') && !q.includes('draft') && !q.includes('beat'))
  ) {
    return {
      intent: ChatIntent.RATING_SUMMARY,
      params,
      isDeterministic: true,
      confidence: 0.9,
    };
  }

  // 6. Generative narrative: Sentiment Summary / Customer Feedback Themes
  if (
    /\b(sentiment|customer\s+feedback|what\s+are\s+customers\s+saying|customer\s+opinion|feedback\s+summary|what\s+do\s+customers\s+love|what\s+do\s+customers\s+hate)\b/i.test(q)
  ) {
    return {
      intent: ChatIntent.SENTIMENT,
      params,
      isDeterministic: false,
      confidence: 0.9,
    };
  }

  // 7. Deterministic: Top Keywords & Rankings
  if (
    /\b(keywords?|rankings?|ranks?|where\s+do\s+i\s+rank|how\s+do\s+i\s+rank|do\s+i\s+rank|what\s+am\s+i\s+ranking\s+for|rank\s+for|map\s+pack\s+position|geogrid\s+ranks?)\b/i.test(q)
  ) {
    // Extract keyword if enclosed in quotes: e.g. "coffee shop near me"
    const quoteMatch = message.match(/["']([^"']+)["']/);
    if (quoteMatch) {
      params.keyword = quoteMatch[1].trim();
    }
    return {
      intent: ChatIntent.TOP_KEYWORDS,
      params,
      isDeterministic: true,
      confidence: 0.9,
    };
  }

  // 8. Deterministic: Competitor Benchmarking & Rivals List
  if (
    /\b(competitors?|rivals?|who\s+are\s+my\s+competitors|show\s+(my\s+)?competitors|list\s+(my\s+)?competitors|compare\s+(me\s+)?with\s+competitors)\b/i.test(q)
  ) {
    return {
      intent: ChatIntent.COMPETITORS,
      params,
      isDeterministic: true,
      confidence: 0.9,
    };
  }

  // 9. Unknown / General Business Question
  return {
    intent: ChatIntent.UNKNOWN,
    params,
    isDeterministic: false,
    confidence: 0.4,
  };
}

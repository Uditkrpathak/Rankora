import { Location } from '../../models/Location';
import { Competitor } from '../../models/Competitor';
import {
  ReviewAnalyticsSnapshot,
  ReviewAnalyticsSnapshotDocument,
  ISentimentBucket,
  ITopicEntry,
  ICompetitorRatingSnapshot,
} from '../../models/ReviewAnalyticsSnapshot';
import { reviewCacheService } from './review-cache.service';
import { IStoredReview } from '../../models/ReviewCache';
import { ENV } from '../../config/env';
import { invalidateLocationChatCache } from '../chat/chat.cache';

/** TTL for the analytics snapshot cache — 12 hours */
const ANALYTICS_TTL_MS = 12 * 60 * 60 * 1000;

// ─── Sentiment heuristics (works without OpenAI) ──────────────────────────────

const POSITIVE_SIGNALS = [
  /great|excellent|amazing|wonderful|fantastic|outstanding|superb|brilliant|perfect|loved|love/i,
  /highly recommend|very happy|very satisfied|extremely pleased|absolutely wonderful|top notch|top-notch/i,
  /best|awesome|impressive|pleasant|delightful|incredible|phenomenal|exceptional|terrific/i,
  /good experience|great service|great food|great staff|great quality|good value|good work/i,
  /5 star|five star|10\/10|A\+|top class|world class|gold standard/i,
  /badhiya|shandar|zabardast|ekdum sahi|mast|maza aaya|acha|accha|achha/i,
];

const NEGATIVE_SIGNALS = [
  /terrible|horrible|awful|disgusting|dreadful|appalling|pathetic|deplorable|atrocious/i,
  /worst|very bad|very poor|extremely disappointed|waste of|overpriced|rude|unprofessional/i,
  /never again|avoid|stay away|do not go|don't go|not worth|waste of money|waste of time/i,
  /bad experience|bad service|bad food|bad staff|bad quality|poor service|poor quality/i,
  /1 star|one star|zero star|0\/10|F-/i,
  /bahut bura|bakwaas|bekar|faltu|kharab|ganda|bura laga/i,
];

function classifySentiment(text: string, rating: number): 'positive' | 'negative' | 'neutral' {
  if (!text && rating >= 4) return 'positive';
  if (!text && rating <= 2) return 'negative';
  if (!text) return 'neutral';

  let posScore = 0;
  let negScore = 0;

  for (const pat of POSITIVE_SIGNALS) if (pat.test(text)) posScore++;
  for (const pat of NEGATIVE_SIGNALS) if (pat.test(text)) negScore++;

  // Weight the numeric rating
  if (rating >= 4) posScore += 2;
  else if (rating <= 2) negScore += 2;

  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

// ─── Topic extraction (rule-based + optional OpenAI enrichment) ───────────────

const TOPIC_PATTERNS: Array<{ topic: string; patterns: RegExp[]; sentiment: 'positive' | 'negative' | 'mixed' }> = [
  {
    topic: 'Food Quality',
    patterns: [/\b(food|meal|dish|taste|flavor|flavour|cuisine|menu|eat|ate|delicious|yummy|tasty|stale|bland|undercooked|overcooked)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Service Speed',
    patterns: [/\b(fast|slow|quick|speed|wait|waiting|delay|delayed|prompt|instantly|immediately|took forever|long queue)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Staff Behaviour',
    patterns: [/\b(staff|team|employee|person|people|manager|owner|waiter|bartender|receptionist|polite|rude|friendly|unhelpful|helpful|courteous|kind)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Cleanliness',
    patterns: [/\b(clean|dirty|hygiene|hygienic|neat|tidy|messy|filthy|spotless|sanit)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Pricing & Value',
    patterns: [/\b(price|cost|expensive|cheap|affordable|value|worth|overpriced|reasonable|budget|rate|charge|billing|paisa|vasool)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Location & Parking',
    patterns: [/\b(location|parking|park|accessible|access|nearby|directions|navigate|address|area|locality)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Ambience',
    patterns: [/\b(ambience|ambiance|atmosphere|decor|decor|vibe|setting|interior|cozy|cosy|noisy|noise|quiet|comfortable|seating)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Product Quality',
    patterns: [/\b(product|quality|material|fabric|durable|durability|genuine|authentic|fake|damaged|broken|defect|good quality|poor quality)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Communication',
    patterns: [/\b(communication|respond|response|reply|call back|callback|update|inform|notif|message|email|whatsapp|contact)\b/i],
    sentiment: 'mixed',
  },
  {
    topic: 'Overall Experience',
    patterns: [/\b(overall|experience|visit|came|coming back|recommend|impressed|satisfied|happy|pleased|love the place|great place)\b/i],
    sentiment: 'positive',
  },
];

function extractTopics(reviews: IStoredReview[]): ITopicEntry[] {
  const topicMap = new Map<string, { count: number; examples: string[]; positiveCount: number; negativeCount: number }>();

  for (const review of reviews) {
    const text = review.comment || '';
    const rating = review.numericRating || 5;
    const sentiment = classifySentiment(text, rating);

    for (const def of TOPIC_PATTERNS) {
      const matched = def.patterns.some((p) => p.test(text));
      if (!matched) continue;

      if (!topicMap.has(def.topic)) {
        topicMap.set(def.topic, { count: 0, examples: [], positiveCount: 0, negativeCount: 0 });
      }
      const entry = topicMap.get(def.topic)!;
      entry.count++;
      if (text.length > 10 && entry.examples.length < 3) {
        entry.examples.push(text.slice(0, 120).trim());
      }
      if (sentiment === 'positive') entry.positiveCount++;
      else if (sentiment === 'negative') entry.negativeCount++;
    }
  }

  const result: ITopicEntry[] = [];
  for (const [topic, data] of topicMap.entries()) {
    let topicSentiment: 'positive' | 'negative' | 'mixed';
    if (data.positiveCount > data.negativeCount * 1.5) topicSentiment = 'positive';
    else if (data.negativeCount > data.positiveCount * 1.5) topicSentiment = 'negative';
    else topicSentiment = 'mixed';

    result.push({ topic, count: data.count, examples: data.examples, sentiment: topicSentiment });
  }

  return result.sort((a, b) => b.count - a.count).slice(0, 10);
}

// ─── Sentiment timeline builder ──────────────────────────────────────────────

function buildSentimentTimeline(reviews: IStoredReview[]): ISentimentBucket[] {
  // Group by month (YYYY-MM)
  const buckets = new Map<string, { pos: number; neg: number; neu: number; ratingSum: number }>();

  for (const r of reviews) {
    const dateStr = r.createTime ? r.createTime.slice(0, 7) : new Date().toISOString().slice(0, 7);
    if (!buckets.has(dateStr)) buckets.set(dateStr, { pos: 0, neg: 0, neu: 0, ratingSum: 0 });
    const b = buckets.get(dateStr)!;
    const sentiment = classifySentiment(r.comment || '', r.numericRating);
    if (sentiment === 'positive') b.pos++;
    else if (sentiment === 'negative') b.neg++;
    else b.neu++;
    b.ratingSum += r.numericRating;
  }

  const result: ISentimentBucket[] = [];
  for (const [date, b] of buckets.entries()) {
    const total = b.pos + b.neg + b.neu;
    result.push({
      date,
      positive: b.pos,
      negative: b.neg,
      neutral: b.neu,
      total,
      averageRating: total > 0 ? Math.round((b.ratingSum / total) * 10) / 10 : 0,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date)).slice(-12); // Last 12 months
}

// ─── Competitor benchmark fetcher (Google Places API, no GBP required) ────────

async function fetchCompetitorRatings(
  competitors: Array<{ name: string; placeId?: string | null; rating?: number; reviewsCount?: number }>
): Promise<ICompetitorRatingSnapshot[]> {
  const placesApiKey = ENV.GOOGLE_PLACES_API_KEY;
  const results: ICompetitorRatingSnapshot[] = [];
  const now = new Date().toISOString();

  for (const comp of competitors.slice(0, 5)) {
    // If already have rating from competitor scan DB, use it directly
    if (comp.rating && comp.reviewsCount !== undefined) {
      results.push({
        name: comp.name,
        placeId: comp.placeId || undefined,
        rating: comp.rating,
        reviewCount: comp.reviewsCount,
        fetchedAt: now,
      });
      continue;
    }

    // Try Places API enrichment if placeId is available
    if (comp.placeId && placesApiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(comp.placeId)}&fields=name,rating,user_ratings_total&key=${placesApiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data: any = await res.json();
          if (data.status === 'OK' && data.result) {
            results.push({
              name: data.result.name || comp.name,
              placeId: comp.placeId,
              rating: data.result.rating || comp.rating || 0,
              reviewCount: data.result.user_ratings_total || comp.reviewsCount || 0,
              fetchedAt: now,
            });
            continue;
          }
        }
      } catch (_) {
        // fallthrough to stored data
      }
    }

    // Fallback to stored scan data
    results.push({
      name: comp.name,
      placeId: comp.placeId || undefined,
      rating: comp.rating || 0,
      reviewCount: comp.reviewsCount || 0,
      fetchedAt: now,
    });
  }

  return results;
}

// ─── Optional: OpenAI topic enrichment ───────────────────────────────────────

async function enrichTopicsWithAI(reviews: IStoredReview[], locationName: string): Promise<ITopicEntry[] | null> {
  if (!ENV.OPENAI_API_KEY) return null;
  if (reviews.length < 3) return null;

  const reviewTexts = reviews
    .filter((r) => r.comment && r.comment.trim().length > 10)
    .slice(0, 30)
    .map((r) => `[${r.numericRating}★] ${r.comment!.slice(0, 150)}`);

  if (reviewTexts.length === 0) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: ENV.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a review analytics expert. Extract the top recurring themes from customer reviews. Return JSON only.',
          },
          {
            role: 'user',
            content: `Analyze these reviews for "${locationName}" and extract the top 8 recurring topics customers mention.
For each topic return: topic (short label), count (how many reviews mention it), sentiment ("positive"/"negative"/"mixed"), and up to 2 example snippets.
Return JSON: { "topics": [{ "topic": string, "count": number, "sentiment": string, "examples": string[] }] }

Reviews:
${reviewTexts.join('\n')}`,
          },
        ],
      }),
    });

    if (res.ok) {
      const payload: any = await res.json();
      const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || '{}');
      if (Array.isArray(parsed?.topics) && parsed.topics.length > 0) {
        return parsed.topics.slice(0, 10).map((t: any) => ({
          topic: String(t.topic || ''),
          count: Number(t.count || 0),
          sentiment: (['positive', 'negative', 'mixed'].includes(t.sentiment) ? t.sentiment : 'mixed') as any,
          examples: Array.isArray(t.examples) ? t.examples.slice(0, 3).map(String) : [],
        }));
      }
    }
  } catch (err: any) {
    console.warn('[ReviewAnalytics] OpenAI topic enrichment failed:', err?.message);
  }
  return null;
}

// ─── Main Analytics Service ───────────────────────────────────────────────────

export class ReviewAnalyticsService {
  /**
   * Returns cached analytics snapshot or computes a fresh one.
   * Does NOT mock or seed data — sources from real cached reviews + Competitor collection.
   */
  public async getAnalytics(
    workspaceId: string,
    locationId: string,
    forceRefresh = false
  ): Promise<ReviewAnalyticsSnapshotDocument> {
    // 1. Try cached snapshot first
    if (!forceRefresh) {
      const cached = await ReviewAnalyticsSnapshot.findOne({ workspaceId, locationId, expiresAt: { $gt: new Date() } });
      if (cached) return cached;
    }

    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
    if (!location) throw Object.assign(new Error('Location not found.'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });

    // 2. Load real reviews from cache (no external call, uses what's already stored)
    const cached = await reviewCacheService.getCachedReviews(workspaceId, locationId);
    const lkg = cached ?? (await reviewCacheService.getLastKnownGood(workspaceId, locationId));
    const reviews: IStoredReview[] = lkg?.reviews || [];

    // 3. Build sentiment timeline
    const sentimentTimeline = buildSentimentTimeline(reviews);

    // 4. Extract topics — try AI first, fall back to rules
    let topics: ITopicEntry[] = [];
    if (reviews.length > 0) {
      const aiTopics = await enrichTopicsWithAI(reviews, location.name);
      topics = aiTopics ?? extractTopics(reviews);
    }

    // 5. Build competitor benchmarks from Competitor collection (populated by rank scans)
    const competitorDocs = await Competitor.find({ locationId, workspaceId })
      .sort({ rating: -1, reviewsCount: -1 })
      .limit(5)
      .select('name placeId rating reviewsCount');

    const competitorBenchmarks = await fetchCompetitorRatings(
      competitorDocs.map((c) => ({
        name: c.name,
        placeId: c.placeId,
        rating: c.rating,
        reviewsCount: c.reviewsCount,
      }))
    );

    // 6. Upsert snapshot
    const expiresAt = new Date(Date.now() + ANALYTICS_TTL_MS);
    const snap = await ReviewAnalyticsSnapshot.findOneAndUpdate(
      { workspaceId, locationId },
      {
        $set: {
          sentimentTimeline,
          topics,
          competitorBenchmarks,
          calculatedAt: new Date(),
          expiresAt,
        },
      },
      { upsert: true, new: true }
    );

    invalidateLocationChatCache(locationId).catch(() => {});

    return snap!;
  }

  /**
   * Runs sentiment analysis on a set of reviews and returns a per-review breakdown.
   * Used by the bulk reply panel to surface which reviews need attention.
   */
  public analyzeSentiment(reviews: IStoredReview[]): Array<{ reviewId: string; sentiment: 'positive' | 'negative' | 'neutral' }> {
    return reviews.map((r) => ({
      reviewId: r.reviewId,
      sentiment: classifySentiment(r.comment || '', r.numericRating),
    }));
  }
}

export const reviewAnalyticsService = new ReviewAnalyticsService();

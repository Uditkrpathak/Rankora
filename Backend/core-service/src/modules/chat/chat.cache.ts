import { redisClient as defaultRedisClient } from '../../config/redis';
import { ChatIntent, DETERMINISTIC_INTENTS, hashParams } from './intent.classifier';

const INTENT_TTL_SECONDS: Record<ChatIntent, number> = {
  [ChatIntent.RATING_SUMMARY]: 1800, // 30 minutes
  [ChatIntent.UNREPLIED_REVIEWS]: 900, // 15 minutes (replies update frequently)
  [ChatIntent.TOP_KEYWORDS]: 3600, // 60 minutes
  [ChatIntent.COMPETITORS]: 3600, // 60 minutes
  [ChatIntent.SENTIMENT]: 1800,
  [ChatIntent.DRAFT_REVIEW_REPLY]: 0, // NEVER cached
  [ChatIntent.DRAFT_GBP_POST]: 0, // NEVER cached
  [ChatIntent.COMPETITOR_STRATEGY]: 0, // NEVER cached
  [ChatIntent.UNKNOWN]: 0, // NEVER cached
};

export const DEFAULT_DATA_VERSION = '1';

// Active Redis reference (allows mock injection during integration tests)
let activeRedisClient: any = defaultRedisClient;

export function setRedisClientForTest(client: any): void {
  activeRedisClient = client;
}

export function resetRedisClientForTest(): void {
  activeRedisClient = defaultRedisClient;
}

export function getRedisClient(): any {
  return activeRedisClient;
}

function getRedis() {
  return activeRedisClient;
}

/**
 * Returns the current data version token for a given location.
 * Initialized to '1' if not present in Redis.
 * Sets a 7-day TTL on new version tokens to prevent lingering keys for deleted or inactive locations.
 */
export async function getLocationDataVersion(locationId: string): Promise<string> {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') {
    return DEFAULT_DATA_VERSION;
  }
  try {
    const versionKey = `chat:version:${locationId}`;
    let version = await redis.get(versionKey);
    if (!version) {
      // Concurrency safe: set with NX (only if Not eXists), then re-read
      // Prevents overwriting a concurrent INCR from background workers!
      await redis.set(versionKey, DEFAULT_DATA_VERSION, 'EX', 7 * 86400, 'NX');
      version = (await redis.get(versionKey)) || DEFAULT_DATA_VERSION;
    } else {
      // Refresh the version key's TTL on read (keep active locations alive for 7 days)
      if (typeof redis.expire === 'function') {
        await redis.expire(versionKey, 7 * 86400).catch(() => {});
      }
    }
    return version;
  } catch (err: any) {
    console.warn('[ChatCache] Redis version read failure, defaulting to consistent default "1":', err?.message || err);
    return DEFAULT_DATA_VERSION;
  }
}

/**
 * Builds the canonical Redis cache key for a chat query:
 * format: chat:cache:{locationId}:{dataVersion}:{intent}:{hash(params)}
 *
 * NOTE: Contains ZERO user-specific data (shared per location across all workspace users).
 */
export function buildChatCacheKey(
  locationId: string,
  dataVersion: string,
  intent: ChatIntent,
  params: Record<string, any> = {}
): string {
  const paramHash = hashParams(params);
  return `chat:cache:${locationId}:${dataVersion}:${intent}:${paramHash}`;
}

/**
 * Retrieves a cached deterministic chat response if present and fresh.
 * Race-safety: Caller passes the dataVersion read BEFORE the query started.
 */
export async function getCachedChatResponse(
  locationId: string,
  dataVersionOrIntent: string | ChatIntent,
  intentOrParams?: ChatIntent | Record<string, any>,
  maybeParams?: Record<string, any>
): Promise<string | null> {
  let dataVersion: string;
  let intent: ChatIntent;
  let params: Record<string, any>;

  if (typeof dataVersionOrIntent === 'string' && Object.values(ChatIntent).includes(dataVersionOrIntent as any)) {
    // Backward-compat overload: (locationId, intent, params)
    intent = dataVersionOrIntent as ChatIntent;
    params = (intentOrParams as Record<string, any>) || {};
    dataVersion = await getLocationDataVersion(locationId);
  } else {
    // Explicit race-safe overload: (locationId, dataVersion, intent, params)
    dataVersion = dataVersionOrIntent as string;
    intent = intentOrParams as ChatIntent;
    params = maybeParams || {};
  }

  // Only deterministic factual queries are cached
  if (!DETERMINISTIC_INTENTS.has(intent)) {
    return null;
  }

  const redis = getRedis();
  if (!redis || redis.status !== 'ready') {
    return null;
  }

  try {
    const key = buildChatCacheKey(locationId, dataVersion, intent, params);
    return await redis.get(key);
  } catch (err: any) {
    console.warn('[ChatCache] Redis get error, falling back to deterministic engine:', err?.message || err);
    return null;
  }
}

/**
 * Caches a deterministic chat response in Redis.
 * Strict Constraint: Creative drafts (reviews replies, GBP posts) and unknown intents are NEVER cached.
 * Race-safety: Must be passed the EXACT same dataVersion read before the answer was computed.
 */
export async function setCachedChatResponse(
  locationId: string,
  dataVersionOrIntent: string | ChatIntent,
  intentOrParams: ChatIntent | Record<string, any>,
  paramsOrAnswer?: Record<string, any> | string,
  maybeAnswer?: string,
  customTtlSeconds?: number
): Promise<void> {
  let dataVersion: string;
  let intent: ChatIntent;
  let params: Record<string, any>;
  let answer: string;
  let ttlSeconds: number | undefined;

  if (typeof dataVersionOrIntent === 'string' && Object.values(ChatIntent).includes(dataVersionOrIntent as any)) {
    // Backward-compat overload: (locationId, intent, params, answer, ttl)
    intent = dataVersionOrIntent as ChatIntent;
    params = (intentOrParams as Record<string, any>) || {};
    answer = paramsOrAnswer as string;
    ttlSeconds = maybeAnswer ? Number(maybeAnswer) : undefined;
    dataVersion = await getLocationDataVersion(locationId);
  } else {
    // Explicit race-safe overload: (locationId, dataVersion, intent, params, answer, ttl)
    dataVersion = dataVersionOrIntent as string;
    intent = intentOrParams as ChatIntent;
    params = (paramsOrAnswer as Record<string, any>) || {};
    answer = maybeAnswer as string;
    ttlSeconds = customTtlSeconds;
  }

  // Strict gate: never cache non-deterministic or creative outputs
  if (!DETERMINISTIC_INTENTS.has(intent) || !answer) {
    return;
  }

  const redis = getRedis();
  if (!redis || redis.status !== 'ready') {
    return;
  }

  try {
    const key = buildChatCacheKey(locationId, dataVersion, intent, params);
    const ttl = ttlSeconds ?? INTENT_TTL_SECONDS[intent] ?? 1800;

    // Every cached key ALWAYS has an explicit TTL so old keys expire safely
    if (ttl > 0) {
      await redis.set(key, answer, 'EX', ttl);
    }
  } catch (err: any) {
    console.warn('[ChatCache] Redis set error:', err?.message || err);
  }
}

/**
 * Atomically invalidates the chat cache for a given location.
 * Called whenever review, ranking, or keyword data changes.
 *
 * Incrementing the version instantly invalidates all existing cache keys with zero scan overhead.
 * On failure, logs an explicit error. Staleness remains bounded by short intent TTLs.
 */
export async function invalidateLocationChatCache(locationId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') {
    return;
  }

  try {
    const versionKey = `chat:version:${locationId}`;
    await redis.incr(versionKey);
    if (typeof redis.expire === 'function') {
      await redis.expire(versionKey, 7 * 86400).catch(() => {});
    }

    // Asynchronously scan and delete old location cache keys to free memory
    const pattern = `chat:cache:${locationId}:*`;
    if (typeof redis.scanStream === 'function') {
      const stream = redis.scanStream({ match: pattern, count: 50 });
      stream.on('data', (keys: string[]) => {
        if (keys && keys.length > 0) {
          redis.del(...keys).catch((delErr: any) => {
            console.error('[ChatCache] Asynchronous cache key deletion error:', delErr?.message || delErr);
          });
        }
      });
      stream.on('error', (scanErr: any) => {
        console.error('[ChatCache] Redis scan error during invalidation cleanup:', scanErr?.message || scanErr);
      });
    }
  } catch (err: any) {
    console.error('[ChatCache] Redis invalidation failure (staleness bounded by TTL):', err?.message || err);
  }
}

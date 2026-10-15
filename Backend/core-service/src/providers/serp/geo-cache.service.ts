import { redisClient, memoryFallback } from '../../config/redis';
import { SERPOptions, SERPResult, SERPItem } from './serp.types';
import { geoCacheOperationsTotal, geoCacheSavingsBytesTotal } from '../../monitoring/metrics';
import { matchBusiness } from '../../modules/rankings/business-matcher';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encodes standard latitude/longitude coordinates into a canonical Geohash string.
 */
export function encodeGeohash(latitude: number, longitude: number, precision: number = 7): string {
  let isEven = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let bit = 0;
  let ch = 0;
  let geohash = '';

  while (geohash.length < precision) {
    if (isEven) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude >= lonMid) {
        ch |= 1 << (4 - bit);
        lonMin = lonMid;
      } else {
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude >= latMid) {
        ch |= 1 << (4 - bit);
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
}

/**
 * Normalizes keyword with NFKC Unicode normalization, lowercasing, trimming, and collapsing whitespace.
 */
export function normalizeKeyword(keyword: string): string {
  if (!keyword) return '';
  return keyword.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generates a geohash-7 cellId from coordinates rounded to 3 decimal places (~110m resolution).
 */
export function generateGeoCellId(lat: number, lng: number, precision: number = 7): string {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  return encodeGeohash(roundedLat, roundedLng, precision);
}

/**
 * Builds canonical geo-hash cache key:
 * geo:{provider}:{keywordNorm}:{cellId}:{hl}:{gl}:{searchSpanMeters}
 */
export function buildGeoCacheKey(params: {
  provider: string;
  keyword: string;
  lat: number;
  lng: number;
  hl?: string;
  gl?: string;
  searchSpanMeters?: number;
  cellId?: string;
}): string {
  const provider = (params.provider || 'default').toLowerCase().trim();
  const keywordNorm = normalizeKeyword(params.keyword);
  const cellId = params.cellId || generateGeoCellId(params.lat, params.lng, 7);
  const hl = (params.hl || 'en').toLowerCase().trim();
  const gl = (params.gl || 'us').toLowerCase().trim();
  const span = params.searchSpanMeters || 1000;
  return `geo:${provider}:${keywordNorm}:${cellId}:${hl}:${gl}:${span}`;
}

export interface CachedGeoListing {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  primaryCategory?: string;
  phone?: string;
  website?: string;
  photoUrl?: string;
  rank: number;
}

export interface CachedGeoPayload {
  provider: string;
  parserVersion: string;
  status: 'OK' | 'EMPTY_VALID';
  items: CachedGeoListing[];
  fetchedAt: string;
  wireBytes?: number;
}

export interface TargetMatchCriteria {
  targetPlaceId?: string;
  targetName?: string;
}

export class GeoCacheService {
  private static instance: GeoCacheService;
  private readonly defaultTtlSeconds: number;

  constructor(ttlSeconds?: number) {
    this.defaultTtlSeconds = ttlSeconds ?? parseInt(process.env.GEO_CACHE_TTL_SECONDS || '172800', 10); // 48h default (48-72h)
  }

  public static getInstance(): GeoCacheService {
    if (!GeoCacheService.instance) {
      GeoCacheService.instance = new GeoCacheService();
    }
    return GeoCacheService.instance;
  }

  /**
   * Strictly evaluates if a result is safe to cache.
   * POISON PROTECTION: Only OK and EMPTY_VALID are allowed.
   * BLOCKED, CAPTCHA, PARSE_ERROR, and TIMEOUT are NEVER cached.
   */
  public isCacheable(result: SERPResult | null | undefined): boolean {
    if (!result) return false;
    const status = result.status || (result.items && result.items.length > 0 ? 'OK' : 'EMPTY_VALID');
    if (status === 'BLOCKED' || status === 'CAPTCHA' || status === 'PARSE_ERROR') {
      return false;
    }
    return status === 'OK' || status === 'EMPTY_VALID';
  }

  /**
   * Evaluates dynamic isTarget and rank at read-time against tenant-agnostic listings.
   */
  public matchTenantTarget(
    items: CachedGeoListing[],
    criteria: TargetMatchCriteria
  ): { items: SERPItem[]; targetRank: number | null } {
    let targetRank: number | null = null;

    const mappedItems: SERPItem[] = items.map((item) => {
      const match = matchBusiness(
        { placeId: criteria.targetPlaceId, name: criteria.targetName || '' },
        item
      );
      const isTarget = match.match;
      const matchedBy = match.by;

      if (isTarget && targetRank === null) {
        targetRank = item.rank;
      }

      return {
        ...item,
        isTarget,
        matchedBy,
      };
    });

    return { items: mappedItems, targetRank };
  }

  /**
   * Retrieves tenant-agnostic cached payload from Redis, applying tenant target matching at read time.
   */
  public async get(
    options: SERPOptions,
    provider: string,
    criteria: TargetMatchCriteria = {}
  ): Promise<SERPResult | null> {
    if (options.forceFresh) {
      geoCacheOperationsTotal.inc({ provider, result: 'bypass' });
      return null;
    }

    const cacheKey = buildGeoCacheKey({
      provider,
      keyword: options.keyword,
      lat: options.lat,
      lng: options.lng,
      hl: options.localization?.hl,
      gl: options.localization?.gl,
      searchSpanMeters: options.searchSpanMeters,
      cellId: options.cellId,
    });

    let rawJson: string | null = null;

    if (redisClient && redisClient.status === 'ready') {
      try {
        rawJson = await redisClient.get(cacheKey);
      } catch (err) {
        console.warn('[GeoCache] Redis GET error:', err);
      }
    } else {
      const mem = memoryFallback.get(cacheKey);
      if (mem && mem.exp > Date.now()) {
        rawJson = mem.val;
      }
    }

    if (!rawJson) {
      geoCacheOperationsTotal.inc({ provider, result: 'miss' });
      return null;
    }

    geoCacheOperationsTotal.inc({ provider, result: 'hit' });
    geoCacheSavingsBytesTotal.inc(25000); // Record bandwidth savings (~25KB per hit)

    try {
      const parsed: CachedGeoPayload = JSON.parse(rawJson);
      const { items, targetRank } = this.matchTenantTarget(parsed.items || [], {
        targetPlaceId: criteria.targetPlaceId || options.targetPlaceId,
        targetName: criteria.targetName || options.targetName,
      });

      return {
        provider: parsed.provider,
        parserVersion: parsed.parserVersion,
        status: parsed.status,
        items,
        empty: parsed.status === 'EMPTY_VALID' || items.length === 0,
        rawPayload: null, // Raw payload is not duplicated into shared cache
        fetchedAt: new Date(parsed.fetchedAt),
        dataAsOf: new Date(parsed.fetchedAt),
        cached: true,
        costUsd: 0.0,
        wireBytes: 0,
        targetRank,
      } as any;
    } catch (parseErr) {
      console.error('[GeoCache] Failed to parse cached payload:', parseErr);
      return null;
    }
  }

  /**
   * Stores tenant-agnostic top-20 SERP results in Redis with TTL-only expiry.
   */
  public async set(
    options: SERPOptions,
    result: SERPResult,
    ttlSeconds?: number
  ): Promise<boolean> {
    if (!this.isCacheable(result)) {
      return false;
    }

    const cacheKey = buildGeoCacheKey({
      provider: result.provider,
      keyword: options.keyword,
      lat: options.lat,
      lng: options.lng,
      hl: options.localization?.hl,
      gl: options.localization?.gl,
      searchSpanMeters: options.searchSpanMeters,
      cellId: options.cellId,
    });

    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const status: 'OK' | 'EMPTY_VALID' = result.status === 'EMPTY_VALID' || (result.items && result.items.length === 0)
      ? 'EMPTY_VALID'
      : 'OK';

    const payload: CachedGeoPayload = {
      provider: result.provider,
      parserVersion: result.parserVersion || 'v1',
      status,
      items: (result.items || []).slice(0, 20).map((it, idx) => ({
        placeId: it.placeId,
        name: it.name,
        address: it.address,
        rating: it.rating,
        reviewsCount: it.reviewsCount,
        primaryCategory: it.primaryCategory,
        phone: it.phone,
        website: it.website,
        photoUrl: it.photoUrl,
        rank: it.rank || idx + 1,
      })),
      fetchedAt: (result.fetchedAt || new Date()).toISOString(),
      wireBytes: result.wireBytes,
    };

    const payloadStr = JSON.stringify(payload);

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.set(cacheKey, payloadStr, 'EX', ttl);
        return true;
      } catch (err) {
        console.warn('[GeoCache] Redis SET error:', err);
      }
    }

    memoryFallback.set(cacheKey, {
      val: payloadStr,
      exp: Date.now() + ttl * 1000,
    });
    return true;
  }
}

export const geoCacheService = GeoCacheService.getInstance();

import { SERPItem } from './serp.types';
import { matchBusiness } from '../../modules/rankings/business-matcher';
import { serpParseFailuresTotal, serpCardsSkippedTotal } from '../../monitoring/metrics';

/**
 * Specification for Google Maps Internal Search Protobuf-to-JSON Field Positions
 * Derived directly from 10 live captured Google Maps responses across Indian metros
 * (Delhi, Mumbai, Bangalore, Chennai, Hyderabad, Kolkata, Noida, Gurgaon).
 *
 * Structure Overview:
 * - Root Response starts with security prefix `)]}'\n`
 * - Root JSON is an array where `data[0][1]` is the raw results feed.
 * - feed[0] is the query metadata card; actual places start at feed[1..20].
 * - Each place element is an array containing the place container at index [14].
 */
export const GOOGLE_MAPS_FIELD_INDICES = {
  // Feed container in root array
  FEED_ROOT_INDEX: 0,
  FEED_CONTAINER_INDEX: 1,

  // Within each Place Entry array (entry = feed[i][14])
  PLACE_CONTAINER_INDEX: 14,
  
  // Place identification inside placeContainer
  TITLE_INDEX_PRIMARY: 11,
  TITLE_INDEX_FALLBACK: 0,
  
  // Google Place ID (ChIJ...) is at [78], Hex CID (0x...) is at [10]
  PLACE_ID_CHID_PRIMARY: 78,
  PLACE_ID_HEX_FALLBACK: 10,

  // Ratings and reviews container: entry[4]
  RATING_CONTAINER_INDEX: 4,
  RATING_VALUE_INDEX: 7,
  REVIEW_COUNT_INTEGER_INDEX: 8,
  REVIEW_COUNT_STRING_CONTAINER_INDEX: 3,
  REVIEW_COUNT_STRING_INDEX: 1,

  // Categories: entry[13] = string[]
  CATEGORIES_INDEX: 13,
  PRIMARY_CATEGORY_INDEX: 0,

  // Address: entry[39] = full formatted string, entry[2] = string[] parts
  ADDRESS_STRING_PRIMARY: 39,
  ADDRESS_ARRAY_FALLBACK: 2,

  // Contact info
  WEBSITE_CONTAINER_INDEX: 7,
  WEBSITE_URL_INDEX: 0,

  // Coordinates of the business pin: entry[9] = [null, null, lat, lng]
  COORDINATES_CONTAINER_INDEX: 9,
  LAT_INDEX: 2,
  LNG_INDEX: 3,
} as const;

export const PARSER_VERSION = '1.0.0-gm-rpc-verified';

export type ParseStatus = 'OK' | 'BLOCKED' | 'CAPTCHA' | 'PARSE_ERROR' | 'EMPTY_VALID';

/**
 * Sanitizes raw payload captures to redact API keys, tokens, passwords, and PII.
 */
export function sanitizePayloadCapture(rawText?: string, maxLength = 2048): string {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/(["']?(?:password|token|secret|apiKey|authorization)["']?\s*[:=]\s*["']?)([^"',\s}]+)(["']?)/gi, '$1***$3')
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '***@***.***')
    .slice(0, maxLength);
}

export type ParseAlertHook = (error: GoogleMapsParseError, sanitizedPayload: string) => Promise<void> | void;
let globalParseAlertHook: ParseAlertHook | null = null;

export function setParseAlertHook(hook: ParseAlertHook | null): void {
  globalParseAlertHook = hook;
}

export function triggerParseAlert(error: GoogleMapsParseError, rawText: string): void {
  const sanitized = sanitizePayloadCapture(rawText);
  if (globalParseAlertHook) {
    Promise.resolve(globalParseAlertHook(error, sanitized)).catch((err) => {
      console.error('[ParseAlertHook] Error dispatching alert hook:', err.message);
    });
  }
}

export class GoogleMapsParseError extends Error {
  public rawPayloadDebug?: string;

  constructor(
    message: string,
    public readonly code: 'SCRAPER_PARSE_ERROR' | 'SCRAPER_BLOCKED' | 'SCRAPER_CAPTCHA' | 'SCRAPER_UPSTREAM_ERROR' | 'SCRAPER_TIMEOUT' | 'SCRAPER_EMPTY_BODY',
    rawPayloadDebug?: string
  ) {
    super(message);
    this.name = 'GoogleMapsParseError';
    if (rawPayloadDebug) {
      this.rawPayloadDebug = sanitizePayloadCapture(rawPayloadDebug, 2048);
    }
  }
}

export interface GoogleMapsParsedResult {
  status: ParseStatus;
  items: SERPItem[];
  rawCount: number;
  parserVersion: string;
  error?: string;
  rawPayloadDebug?: string;
}


/**
 * Strips Google security prefix from raw response text
 */
export function stripSecurityPrefix(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    throw new GoogleMapsParseError('Response body is empty or not a string', 'SCRAPER_EMPTY_BODY');
  }
  return rawText
    .replace(/^\)\]\}'\s*\n?/, '')
    .replace(/^\/\*-JSON-\*\/\s*\n?/, '')
    .trim();
}

/**
 * Validates if response indicates a Google bot block / challenge
 */
export function assertNotBlocked(rawText: string, httpStatus?: number, finalUrl?: string): void {
  if (httpStatus === 429 || httpStatus === 403) {
    throw new GoogleMapsParseError(`Google returned HTTP ${httpStatus}`, 'SCRAPER_BLOCKED', rawText);
  }

  if (finalUrl && (finalUrl.includes('/sorry/') || finalUrl.includes('consent.google.com'))) {
    throw new GoogleMapsParseError(`Google redirected to challenge page: ${finalUrl}`, 'SCRAPER_BLOCKED', rawText);
  }

  const lower = rawText.toLowerCase();
  if (lower.includes('recaptcha') || lower.includes('/sorry/index?continue=')) {
    throw new GoogleMapsParseError('Google CAPTCHA challenge detected in response body', 'SCRAPER_CAPTCHA', rawText);
  }

  if (
    lower.includes('detected unusual traffic') ||
    lower.includes('our systems have detected unusual traffic from your computer network')
  ) {
    throw new GoogleMapsParseError('Google bot detection challenge detected in response body', 'SCRAPER_BLOCKED', rawText);
  }
}

/**
 * Parses and strictly extracts top-ranked listings from raw Google Maps RPC JSON text.
 */
export function extractGoogleMapsListings(
  rawText: string,
  options?: { targetPlaceId?: string; targetName?: string }
): GoogleMapsParsedResult {
  const cleanJson = stripSecurityPrefix(rawText);

  let data: any;
  try {
    data = JSON.parse(cleanJson);
  } catch (err: any) {
    throw new GoogleMapsParseError(
      `SCRAPER_PARSE_ERROR: Failed to parse response JSON: ${err.message}`,
      'SCRAPER_PARSE_ERROR',
      rawText
    );
  }

  if (!Array.isArray(data)) {
    throw new GoogleMapsParseError(
      'SCRAPER_PARSE_ERROR: Unexpected JSON root structure: expected top-level array',
      'SCRAPER_PARSE_ERROR',
      rawText
    );
  }

  // Find feed array: data[0][1]
  const rawFeed = data[GOOGLE_MAPS_FIELD_INDICES.FEED_ROOT_INDEX]?.[GOOGLE_MAPS_FIELD_INDICES.FEED_CONTAINER_INDEX];

  if (!Array.isArray(rawFeed)) {
    // S16 Safety: Substantial response body with missing feed container is a schema failure, NOT an empty search
    if (rawText.length > 500) {
      serpParseFailuresTotal.inc({ reason: 'missing_feed_container_large_body' });
      const parseError = new GoogleMapsParseError(
        `SCRAPER_PARSE_ERROR: Response body is substantial (${rawText.length} bytes) but feed container data[0][1] is missing or not an array`,
        'SCRAPER_PARSE_ERROR',
        rawText
      );
      triggerParseAlert(parseError, rawText);
      throw parseError;
    }
    return { status: 'EMPTY_VALID', items: [], rawCount: 0, parserVersion: PARSER_VERSION };
  }

  // Filter out query metadata headers, keeping only entries with a valid place payload array at [14]
  const placeEntries = rawFeed.filter((entry) => entry && Array.isArray(entry[GOOGLE_MAPS_FIELD_INDICES.PLACE_CONTAINER_INDEX]));

  if (placeEntries.length === 0) {
    return { status: 'EMPTY_VALID', items: [], rawCount: 0, parserVersion: PARSER_VERSION };
  }

  const items: SERPItem[] = [];
  let skippedCards = 0;

  for (let i = 0; i < placeEntries.length; i++) {
    const rawEntry = placeEntries[i];
    const placeContainer = rawEntry[GOOGLE_MAPS_FIELD_INDICES.PLACE_CONTAINER_INDEX];

    // Extract Title (Primary at [11], fallback at [0])
    const rawTitle = placeContainer[GOOGLE_MAPS_FIELD_INDICES.TITLE_INDEX_PRIMARY] ||
      placeContainer[GOOGLE_MAPS_FIELD_INDICES.TITLE_INDEX_FALLBACK];
    const name = typeof rawTitle === 'string' ? rawTitle.trim() : '';

    if (!name) {
      skippedCards++;
      serpCardsSkippedTotal.inc();
      continue; // Skip malformed cards missing titles
    }


    // Extract Place ID: Primary standard ChIJ at [78], Fallback hex CID at [10]
    const chidPlaceId = placeContainer[GOOGLE_MAPS_FIELD_INDICES.PLACE_ID_CHID_PRIMARY];
    const hexCid = placeContainer[GOOGLE_MAPS_FIELD_INDICES.PLACE_ID_HEX_FALLBACK];
    const placeId = String(chidPlaceId || hexCid || `gm_${i + 1}`).trim();
    const cid = typeof hexCid === 'string' && hexCid.trim() ? hexCid.trim() : undefined;

    // Extract Rating & Reviews: container at [4]
    const ratingContainer = placeContainer[GOOGLE_MAPS_FIELD_INDICES.RATING_CONTAINER_INDEX];
    let rating: number | undefined;
    let reviewsCount: number | null = null;

    if (Array.isArray(ratingContainer)) {
      const rawRating = ratingContainer[GOOGLE_MAPS_FIELD_INDICES.RATING_VALUE_INDEX];
      if (typeof rawRating === 'number' && !isNaN(rawRating) && rawRating >= 1 && rawRating <= 5) {
        rating = parseFloat(rawRating.toFixed(1));
      }

      // 1. Check primary integer review count at [4][8]
      const rawReviews = ratingContainer[GOOGLE_MAPS_FIELD_INDICES.REVIEW_COUNT_INTEGER_INDEX];
      if (typeof rawReviews === 'number' && !isNaN(rawReviews) && rawReviews >= 0) {
        reviewsCount = rawReviews;
      } else {
        // 2. Check fallback review string at [4][3][1] (e.g. "222 reviews")
        const reviewStrContainer = ratingContainer[GOOGLE_MAPS_FIELD_INDICES.REVIEW_COUNT_STRING_CONTAINER_INDEX];
        if (Array.isArray(reviewStrContainer) && typeof reviewStrContainer[GOOGLE_MAPS_FIELD_INDICES.REVIEW_COUNT_STRING_INDEX] === 'string') {
          const match = reviewStrContainer[GOOGLE_MAPS_FIELD_INDICES.REVIEW_COUNT_STRING_INDEX].match(/([\d,]+)/);
          if (match) {
            reviewsCount = parseInt(match[1].replace(/,/g, ''), 10);
          }
        }
      }
    }

    // Extract Category: array at [13]
    const categoriesContainer = placeContainer[GOOGLE_MAPS_FIELD_INDICES.CATEGORIES_INDEX];
    const primaryCategory = Array.isArray(categoriesContainer) && typeof categoriesContainer[0] === 'string'
      ? categoriesContainer[0].trim()
      : undefined;

    // Extract Address: primary string at [39] or joined array at [2]
    let address: string | undefined;
    if (typeof placeContainer[GOOGLE_MAPS_FIELD_INDICES.ADDRESS_STRING_PRIMARY] === 'string' && placeContainer[GOOGLE_MAPS_FIELD_INDICES.ADDRESS_STRING_PRIMARY].trim()) {
      address = placeContainer[GOOGLE_MAPS_FIELD_INDICES.ADDRESS_STRING_PRIMARY].trim();
    } else {
      const addressArray = placeContainer[GOOGLE_MAPS_FIELD_INDICES.ADDRESS_ARRAY_FALLBACK];
      if (Array.isArray(addressArray) && typeof addressArray[0] === 'string') {
        address = addressArray.join(', ').trim();
      }
    }

    // Extract Website: array at [7] -> url at [7][0]
    const websiteContainer = placeContainer[GOOGLE_MAPS_FIELD_INDICES.WEBSITE_CONTAINER_INDEX];
    const website = Array.isArray(websiteContainer) && typeof websiteContainer[GOOGLE_MAPS_FIELD_INDICES.WEBSITE_URL_INDEX] === 'string'
      ? websiteContainer[GOOGLE_MAPS_FIELD_INDICES.WEBSITE_URL_INDEX].trim()
      : undefined;

    // Extract Coordinates: container at [9]
    const coordsContainer = placeContainer[GOOGLE_MAPS_FIELD_INDICES.COORDINATES_CONTAINER_INDEX];
    let lat: number | undefined;
    let lng: number | undefined;
    if (Array.isArray(coordsContainer)) {
      const rawLat = coordsContainer[GOOGLE_MAPS_FIELD_INDICES.LAT_INDEX];
      const rawLng = coordsContainer[GOOGLE_MAPS_FIELD_INDICES.LNG_INDEX];
      if (typeof rawLat === 'number' && !isNaN(rawLat)) lat = rawLat;
      if (typeof rawLng === 'number' && !isNaN(rawLng)) lng = rawLng;
    }

    let isTarget = false;
    let matchedBy: string | undefined;
    if (options?.targetPlaceId || options?.targetName) {
      const matchRes = matchBusiness(
        { placeId, cid, name, address, website, lat, lng },
        { placeId: options.targetPlaceId, name: options.targetName || '' }
      );
      isTarget = matchRes.match;
      matchedBy = matchRes.by;
    }

    items.push({
      rank: items.length + 1,
      placeId,
      cid,
      name,
      rating: rating ?? undefined,
      reviewsCount: reviewsCount ?? undefined,
      primaryCategory,
      address,
      website,
      lat,
      lng,
      isTarget,
      matchedBy,
    });

    if (items.length >= 20) {
      break; // Localo tracks top 20 rank positions
    }
  }

  // S16 Safety: If >50% of cards were skipped, upstream Google schema drift is suspected
  if (placeEntries.length >= 2 && skippedCards / placeEntries.length > 0.5) {
    serpParseFailuresTotal.inc({ reason: 'majority_cards_skipped' });
    const parseError = new GoogleMapsParseError(
      `SCRAPER_PARSE_ERROR: Majority of place cards (${skippedCards}/${placeEntries.length}) could not be parsed. Upstream schema drift suspected.`,
      'SCRAPER_PARSE_ERROR',
      rawText
    );
    triggerParseAlert(parseError, rawText);
    throw parseError;
  }

  return {
    status: items.length > 0 ? 'OK' : 'EMPTY_VALID',
    items,
    rawCount: placeEntries.length,
    parserVersion: PARSER_VERSION,
  };
}


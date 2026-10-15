import { redisClient } from '../config/redis';
import { CoordinatesSource } from '@localo/types';

export interface PlacesSearchResult {
  placeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  category?: string;
  thumbnailUrl?: string;
  photoUrl?: string;
  coverPhotoUrl?: string;
  logoUrl?: string;
  website?: string;
  googleMapsUri?: string;
  coordinates?: { lat: number; lng: number };
  coordinatesSource?: CoordinatesSource;
  coordinatesVerifiedAt?: Date;
  rating?: number;
  userRatingCount?: number;
}

export interface PlaceDetailsResult extends PlacesSearchResult {
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  mapsCid?: string;
  primaryCategory?: { id: string; displayName: string };
  secondaryCategories?: Array<{ id: string; displayName: string }>;
  regularHours?: Record<string, any>;
  attributes?: string[];
}

export function isKnownFallbackCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return true;
  if (lat === 0 && lng === 0) return true;
  // Known Delhi fallback baseline: 28.6139, 77.2090 and 28.6139 + idx * 0.002
  const dLat = Math.abs(lat - 28.6139);
  const dLng = Math.abs(lng - 77.2090);
  if (dLat < 0.05 && dLng < 0.05) {
    const stepLat = (lat - 28.6139) / 0.002;
    const stepLng = (lng - 77.2090) / 0.002;
    const isStepLatInt = Math.abs(stepLat - Math.round(stepLat)) < 0.0001;
    const isStepLngInt = Math.abs(stepLng - Math.round(stepLng)) < 0.0001;
    if (isStepLatInt && isStepLngInt && Math.round(stepLat) === Math.round(stepLng)) {
      return true;
    }
  }
  return false;
}

export class PlacesAutocompleteProvider {
  /**
   * Enforces 200ms short-TTL rate-limiting per workspace to prevent search abuse
   */
  private async enforceWorkspaceDebounce(workspaceId: string): Promise<void> {
    const throttleKey = `ratelimit:places_search_debounce:${workspaceId}`;
    try {
      if (redisClient && redisClient.status === 'ready') {
        const isThrottled = await redisClient.get(throttleKey);
        if (isThrottled) {
          const err: any = new Error('SEARCH_DEBOUNCE_ACTIVE');
          err.statusCode = 429;
          err.message = 'Too many search requests. Please wait a moment before trying again.';
          throw err;
        }
        await redisClient.set(throttleKey, '1', 'PX', 200);
      }
    } catch (err: any) {
      if (err.statusCode === 429) throw err;
    }
  }

  /**
   * Acquires a token against the shared Google limiter (60 QPM per workspace)
   */
  private async acquireRateLimitToken(workspaceId: string): Promise<void> {
    const key = `ratelimit:google:${workspaceId}`;
    try {
      if (redisClient && redisClient.status === 'ready') {
        const count = await redisClient.incr(key);
        if (count === 1) {
          await redisClient.expire(key, 60);
        }
        if (count > 60) {
          console.warn(`[Places Rate Limiter] Workspace ${workspaceId} exceeded 60 QPM limit.`);
          const err: any = new Error('RATE_LIMIT_EXCEEDED');
          err.statusCode = 429;
          err.message = 'Google API rate limit reached for this workspace. Please retry in a minute.';
          throw err;
        }
      }
    } catch (err: any) {
      if (err.statusCode === 429) throw err;
    }
  }

  /**
   * Searches public places via Google Places API Text Search (New)
   */
  public async searchPlaces(query: string, workspaceId: string): Promise<PlacesSearchResult[]> {
    if (!query || !query.trim()) {
      return [];
    }

    await this.enforceWorkspaceDebounce(workspaceId);
    await this.acquireRateLimitToken(workspaceId);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('GOOGLE_PLACES_API_KEY is not configured in production environment.');
      }
      if (process.env.ALLOW_MOCK_PLACES !== 'true') {
        throw new Error('GOOGLE_PLACES_API_KEY is missing. In development, set ALLOW_MOCK_PLACES=true to enable mock place generation.');
      }
      return this.generateMockSearchResult(query);
    }

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.photos,places.websiteUri',
        },
        body: JSON.stringify({
          textQuery: query.trim(),
          pageSize: 10,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const places = data.places || [];
        return places.map((p: any) => this.mapGooglePlaceToSearchResult(p));
      } else {
        const errText = await res.text();
        console.warn(`[Places API Search Error] Google returned HTTP ${res.status}: ${errText}`);
      }
    } catch (err: any) {
      console.warn('[Places API Search Warning] Google Places API request failed:', err.message);
    }

    return [];
  }

  /**
   * Retrieves full details for a chosen Place ID using Places API (New)
   */
  public async getPlaceDetails(placeId: string, workspaceId?: string): Promise<PlaceDetailsResult> {
    if (workspaceId) {
      await this.acquireRateLimitToken(workspaceId);
    }

    // 1. Check Redis cache first from recent search results
    try {
      if (redisClient && redisClient.status === 'ready') {
        const cached = await redisClient.get(`cache:places_details:${placeId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            ...parsed,
            primaryCategory: parsed.category ? { id: 'primary', displayName: parsed.category } : undefined,
            secondaryCategories: [],
            regularHours: {},
            attributes: ['In-store shopping', 'On-site services'],
          };
        }
      }
    } catch (e) {}

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('GOOGLE_PLACES_API_KEY is not configured in production environment.');
      }
      if (process.env.ALLOW_MOCK_PLACES !== 'true') {
        throw new Error('GOOGLE_PLACES_API_KEY is missing. In development, set ALLOW_MOCK_PLACES=true to enable mock place generation.');
      }
      return this.generateMockDetailsResult(placeId);
    }

    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'id,displayName,formattedAddress,addressComponents,location,primaryTypeDisplayName,types,rating,userRatingCount,nationalPhoneNumber,websiteUri,photos,regularOpeningHours,accessibilityOptions,paymentOptions,delivery,dineIn,curbsidePickup,reservable,parkingOptions,googleMapsUri',
        },
      });

      if (res.ok) {
        const data = await res.json();
        return this.mapGooglePlaceToDetailsResult(data);
      } else {
        const errText = await res.text();
        console.warn(`[Places API Details Error] Google returned HTTP ${res.status}: ${errText}`);
      }
    } catch (err: any) {
      console.warn('[Places API Details Warning] Failed to fetch place details from Google Places API:', err.message);
    }

    return this.generateMockDetailsResult(placeId);
  }

  private mapGooglePlaceToSearchResult(p: any): PlacesSearchResult {
    let locality = '';
    let adminArea2 = '';
    let adminArea1 = '';
    let country = 'IN';
    let postalCode = '';

    for (const comp of p.addressComponents || []) {
      const types = comp?.types || [];
      if (types.includes('locality')) locality = comp.longText || comp.text || '';
      else if (types.includes('administrative_area_level_2')) adminArea2 = comp.longText || comp.text || '';
      else if (types.includes('administrative_area_level_1')) adminArea1 = comp.shortText || comp.longText || comp.text || '';
      else if (types.includes('country')) country = comp.shortText || comp.longText || 'IN';
      else if (types.includes('postal_code')) postalCode = comp.longText || comp.text || '';
    }

    const city = locality || adminArea2 || '';
    const state = adminArea1 || '';

    const photoName = p.photos?.[0]?.name;
    const photoUrl = photoName ? `/v1/places/photo?ref=${encodeURIComponent(photoName)}` : undefined;

    return {
      placeId: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      city,
      state,
      country,
      postalCode: postalCode || undefined,
      category: p.primaryTypeDisplayName?.text || '',
      coordinates: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined,
      coordinatesSource: 'PLACES_API',
      coordinatesVerifiedAt: new Date(),
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      photoUrl,
      coverPhotoUrl: photoUrl,
      logoUrl: photoUrl,
      thumbnailUrl: photoUrl,
      website: p.websiteUri || undefined,
      googleMapsUri: p.googleMapsUri || undefined,
    };
  }

  private mapGooglePlaceToDetailsResult(p: any): PlaceDetailsResult {
    const base = this.mapGooglePlaceToSearchResult(p);
    let mapsCid: string | undefined;
    if (typeof p.googleMapsUri === 'string') {
      const match = p.googleMapsUri.match(/[?&]cid=([0-9]+)/);
      if (match) {
        mapsCid = match[1];
      }
    }
    const attributes: string[] = [];
    if (p.delivery) attributes.push('Delivery');
    if (p.curbsidePickup) attributes.push('In-store pick-up');
    if (p.dineIn) attributes.push('Dine-in');
    attributes.push('In-store shopping');
    attributes.push('On-site services');
    attributes.push('Quick visit');

    if (p.paymentOptions?.acceptsCreditCards !== false) attributes.push('Credit cards');
    if (p.paymentOptions?.acceptsDebitCards !== false) attributes.push('Debit cards');
    if (p.paymentOptions?.acceptsNfc !== false) {
      attributes.push('Google Pay');
      attributes.push('NFC mobile payments');
    }
    if (p.accessibilityOptions?.wheelchairAccessibleEntrance) attributes.push('Wheelchair accessible entrance');
    if (p.accessibilityOptions?.wheelchairAccessibleParking) attributes.push('Wheelchair accessible parking');

    const photoName = p.photos?.[0]?.name;
    const photoUrl = photoName ? `/v1/places/photo?ref=${encodeURIComponent(photoName)}` : base.photoUrl;

    return {
      ...base,
      phone: p.nationalPhoneNumber || '',
      website: p.websiteUri || base.website || '',
      googleMapsUri: p.googleMapsUri || undefined,
      mapsCid,
      photoUrl,
      coverPhotoUrl: photoUrl,
      logoUrl: photoUrl,
      thumbnailUrl: photoUrl,
      primaryCategory: base.category
        ? { id: 'primary_cat', displayName: base.category }
        : undefined,
      secondaryCategories: [],
      regularHours: p.regularOpeningHours || {},
      attributes,
    };
  }

  private generateMockSearchResult(query: string): PlacesSearchResult[] {
    return [
      {
        placeId: `ChIJ_mock_${encodeURIComponent(query.replace(/[^a-zA-Z0-9]/g, '_'))}_0`,
        name: query.trim(),
        address: `${query.trim()}, Mock Area, Dev City`,
        city: 'Dev City',
        state: 'Dev State',
        country: 'IN',
        postalCode: '110001',
        category: 'Local Business',
        coordinates: { lat: 28.6139, lng: 77.2090 },
        coordinatesSource: 'MOCK_FALLBACK',
        coordinatesVerifiedAt: new Date(),
        rating: 4.5,
        userRatingCount: 10,
      },
    ];
  }

  private generateMockDetailsResult(placeId: string): PlaceDetailsResult {
    let fallbackName = 'My Business';
    if (placeId.startsWith('ChIJ_mock_')) {
      const parts = placeId.split('_');
      if (parts.length >= 3) {
        fallbackName = decodeURIComponent(parts[2]).replace(/_/g, ' ');
      }
    }

    return {
      placeId,
      name: fallbackName,
      address: `${fallbackName}, Mock Area, Dev City`,
      city: 'Dev City',
      state: 'Dev State',
      country: 'IN',
      postalCode: '110001',
      coordinates: { lat: 28.6139, lng: 77.2090 },
      coordinatesSource: 'MOCK_FALLBACK',
      coordinatesVerifiedAt: new Date(),
      primaryCategory: { id: 'local_business', displayName: 'Local Business' },
      secondaryCategories: [],
      regularHours: {},
      attributes: ['In-store shopping', 'On-site services'],
    };
  }
}

export const placesAutocompleteProvider = new PlacesAutocompleteProvider();


import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { placesAutocompleteProvider } from '../../providers/places-autocomplete.provider';
import { locationService } from '../locations/location.service';
import { redisClient } from '../../config/redis';
import { CategoryResolver } from '../keywords/keyword-engine/category-resolver';
import { businessKeywordSuggestionsService } from '../keywords/business-keyword-suggestions.service';

export class PlacesController {
  /**
   * Proxies Google Places photos securely with high-performance Redis caching & size bounding
   * GET /v1/places/photo?ref=...&w=400
   */
  public async getPhoto(req: Request, res: Response): Promise<void> {
    const rawRef = (req.query.ref as string) || '';
    const rawW = parseInt((req.query.w as string) || '400', 10);
    const rawH = parseInt((req.query.h as string) || '0', 10);

    if (!rawRef || !rawRef.trim()) {
      res.status(400).send('Photo reference (ref) is required');
      return;
    }

    const ref = decodeURIComponent(rawRef.trim());

    // Strict validation to prevent open-proxy / SSRF abuse:
    // Format 1: places/{placeId}/photos/{photoId} (New Google Places API)
    // Format 2: Alphanumeric + Base64 legacy photo reference (Google Maps API)
    const isNewPlacesRef = /^places\/[A-Za-z0-9_.-]+\/photos\/[A-Za-z0-9_.-]+$/.test(ref);
    const isLegacyPlacesRef = /^[A-Za-z0-9_.-]{20,1000}$/.test(ref);

    if (!isNewPlacesRef && !isLegacyPlacesRef) {
      res.status(400).send('Invalid photo reference format');
      return;
    }

    // Bound dimensions between 50px and 1600px
    const w = Math.min(Math.max(isNaN(rawW) ? 400 : rawW, 50), 1600);
    const h = rawH > 0 ? Math.min(Math.max(rawH, 50), 1600) : null;

    // Workspace or IP rate limiting (120 photo requests/min)
    const clientIdentifier = (req as any).workspace?._id?.toString() || req.ip || 'anonymous_client';
    try {
      if (redisClient && redisClient.status === 'ready') {
        const rateLimitKey = `ratelimit:places_photo:${clientIdentifier}`;
        const currentReqCount = await redisClient.incr(rateLimitKey);
        if (currentReqCount === 1) {
          await redisClient.expire(rateLimitKey, 60);
        }
        if (currentReqCount > 120) {
          res.status(429).send('Rate limit exceeded for photo requests. Please slow down.');
          return;
        }
      }
    } catch {
      // Non-fatal if Redis connection is unavailable
    }

    // 1. Check Redis server-side cache (7-day TTL)
    const cacheKey = `places:photo_cache:${Buffer.from(ref).toString('base64url')}:${w}:${h || 'auto'}`;
    try {
      if (redisClient && redisClient.status === 'ready') {
        const cachedBase64 = await redisClient.get(cacheKey);
        if (cachedBase64) {
          const [contentType, base64Data] = cachedBase64.split(';base64,');
          if (contentType && base64Data) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
            res.setHeader('X-Cache', 'HIT');
            res.send(Buffer.from(base64Data, 'base64'));
            return;
          }
        }
      }
    } catch (cacheErr) {
      console.warn('[Places Photo Cache Warning]:', cacheErr);
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(500).send('Google Places API key is not configured');
      return;
    }

    try {
      let targetUrl: string;
      if (isNewPlacesRef) {
        targetUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}${h ? `&maxHeightPx=${h}` : ''}&key=${apiKey}`;
      } else {
        targetUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${w}${h ? `&maxheight=${h}` : ''}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;
      }

      const upstream = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 Localo/1.0' },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        res.status(upstream.status === 404 ? 404 : 502).send(`Photo unavailable from Google Places (${upstream.status})`);
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Store in Redis cache (7 days TTL)
      try {
        if (redisClient && redisClient.status === 'ready') {
          const serialized = `${contentType};base64,${buffer.toString('base64')}`;
          await redisClient.set(cacheKey, serialized, 'EX', 7 * 24 * 60 * 60);
        }
      } catch (cacheSetErr) {
        console.warn('[Places Photo Cache Store Warning]:', cacheSetErr);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
      res.setHeader('X-Cache', 'MISS');
      res.send(buffer);
    } catch (err: any) {
      console.error('[Places Photo Proxy Error]:', err?.message || err);
      res.status(502).send('Error proxying photo from Google');
    }
  }

  /**
   * Search Google Places Autocomplete/Text Search with real-time Category Resolution
   */
  public async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const query = (req.query.q as string) || '';

    if (!query.trim() || query.trim().length < 2) {
      res.status(200).json({
        success: true,
        data: { results: [] },
      });
      return;
    }

    try {
      const results = await placesAutocompleteProvider.searchPlaces(query, workspaceId);

      // Real-time category resolution without database writes
      const enriched = results.map((r: any) => {
        const resolved = CategoryResolver.resolve({
          businessName: r.name,
          placesPrimaryTypeDisplayName: r.category,
          placesPrimaryType: r.category,
        });

        return {
          ...r,
          resolvedCategory: resolved.primary,
          resolvedCategoryKey: resolved.primaryKey,
          categorySource: resolved.source,
          categoryConfidence: resolved.confidence,
        };
      });

      res.status(200).json({
        success: true,
        data: { results: enriched },
      });
    } catch (err: any) {
      if (err.statusCode === 429) {
        res.status(429).json({
          success: false,
          error: { code: 'SEARCH_THROTTLED', message: err.message },
        });
        return;
      }
      throw err;
    }
  }

  /**
   * Real-Time Keyword Preview Endpoint (Zero DB Write)
   * Discovers Google autocomplete suggestions for the selected business category and city.
   * GET /v1/workspaces/:id/places/preview-keywords?placeId=...&name=...&lat=...&lng=...&city=...
   */
  public async previewKeywords(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace?._id?.toString() || req.params.id;
    const { placeId, name, city } = req.query as any;

    if (!name && !placeId) {
      res.status(400).json({
        success: false,
        error: { code: 'PARAMS_REQUIRED', message: 'name or placeId is required' },
      });
      return;
    }

    const businessName = (name as string)?.trim() || 'Local Business';

    // 1. Fetch place details if placeId provided
    let placeDetails: any = null;
    if (placeId) {
      try {
        placeDetails = await placesAutocompleteProvider.getPlaceDetails(placeId, workspaceId);
      } catch (e) {}
    }

    // 2. Resolve category real-time using CategoryResolver
    const resolved = CategoryResolver.resolve({
      businessName: placeDetails?.name || businessName,
      placesPrimaryTypeDisplayName: placeDetails?.primaryCategory?.displayName || placeDetails?.category,
      placesPrimaryType: placeDetails?.category,
      placesTypes: placeDetails?.secondaryCategories?.map((category: { displayName: string }) => category.displayName),
    });

    // 3. Preview and onboarding share discovery and its versioned, per-query cache.
    const targetCity = placeDetails?.city || city || '';
    const targetCountry = placeDetails?.country || 'in';

    const suggestions = await businessKeywordSuggestionsService.suggest({
      category: resolved,
      city: targetCity,
      countryCode: targetCountry,
      limit: 3,
    });

    const payload = {
      businessName: placeDetails?.name || businessName,
      category: resolved.primary,
      categoryKey: resolved.primaryKey,
      categorySource: resolved.source,
      confidence: resolved.confidence,
      needsUserConfirmation: resolved.needsUserConfirmation,
      ...suggestions,
    };

    res.status(200).json({
      success: true,
      data: payload,
    });
  }

  /**
   * Add a business location directly from Places search
   */
  public async addFromSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const actorUserId = req.user!._id.toString();
    const ip = req.ip || req.socket.remoteAddress;
    const { placeId, confirmedCoordinates } = req.body;

    if (!placeId) {
      res.status(400).json({
        success: false,
        error: { code: 'PLACE_ID_REQUIRED', message: 'placeId is required' },
      });
      return;
    }

    const location = await locationService.addFromPlacesSearch(workspaceId, placeId, actorUserId, ip, confirmedCoordinates);

    res.status(201).json({
      success: true,
      data: { location },
    });
  }
}

export const placesController = new PlacesController();

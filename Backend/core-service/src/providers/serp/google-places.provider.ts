import { ISERPProvider, SERPOptions, SERPResult, SERPItem } from './serp.types';
import { ENV } from '../../config/env';

export class GooglePlacesSERPProvider implements ISERPProvider {
  public name = 'GOOGLE_PLACES';

  public async search(options: SERPOptions): Promise<SERPResult> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Places / Maps API key is not configured');
    }

    const { keyword, lat, lng, radiusKm = 3.5, targetPlaceId, targetName } = options;
    const targetNameNorm = targetName ? targetName.trim().toLowerCase() : '';
    const radiusMeters = Math.min(50000, Math.round(radiusKm * 1000));

    let items: SERPItem[] = [];
    let rawPayload: any = null;

    // 1. Try Google Places API (New) searchText endpoint
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.photos',
        },
        body: JSON.stringify({
          textQuery: keyword,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusMeters,
            },
          },
          pageSize: 20,
        }),
      });

      if (res.ok) {
        rawPayload = await res.json();
        const places = rawPayload.places || [];

        items = places.map((p: any, idx: number) => {
          const name = p.displayName?.text || '';
          const placeId = p.id || `google_place_${idx + 1}`;
          const isTarget =
            Boolean(targetPlaceId && placeId === targetPlaceId) ||
            Boolean(targetNameNorm && name.toLowerCase().trim() === targetNameNorm) ||
            Boolean(targetNameNorm && targetNameNorm.length > 3 && name.toLowerCase().includes(targetNameNorm));

          const photoName = p.photos?.[0]?.name;
          const photoUrl = photoName ? `/v1/places/photo?ref=${encodeURIComponent(photoName)}` : undefined;

          return {
            placeId,
            name,
            address: p.formattedAddress || '',
            rating: p.rating,
            reviewsCount: p.userRatingCount,
            primaryCategory: p.primaryTypeDisplayName?.text || keyword,
            phone: p.nationalPhoneNumber || '',
            website: p.websiteUri || '',
            photoUrl,
            rank: idx + 1,
            isTarget,
          };
        });
      }
    } catch (err) {
      console.warn('[Google Places SERP Provider] searchText failed, trying legacy textsearch', err);
    }

    // 2. Fallback to classic Google Maps Places Text Search API
    if (items.length === 0) {
      try {
        const queryUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          keyword
        )}&location=${lat},${lng}&radius=${radiusMeters}&key=${apiKey}`;

        const res = await fetch(queryUrl);
        if (res.ok) {
          rawPayload = await res.json();
          const results = rawPayload.results || [];

          items = results.map((p: any, idx: number) => {
            const name = p.name || '';
            const placeId = p.place_id || `google_place_${idx + 1}`;
            const isTarget =
              Boolean(targetPlaceId && placeId === targetPlaceId) ||
              Boolean(targetNameNorm && name.toLowerCase().trim() === targetNameNorm) ||
              Boolean(targetNameNorm && targetNameNorm.length > 3 && name.toLowerCase().includes(targetNameNorm));

            return {
              placeId,
              name,
              address: p.formatted_address || '',
              rating: p.rating,
              reviewsCount: p.user_ratings_total,
              primaryCategory: p.types?.[0] || keyword,
              rank: idx + 1,
              isTarget,
            };
          });
        }
      } catch (err) {
        console.warn('[Google Places SERP Provider] legacy textsearch failed', err);
      }
    }

    if (items.length === 0) {
      throw new Error('No search results returned from Google Places API');
    }

    return {
      provider: 'GOOGLE_PLACES',
      providerRequestId: `google_${Date.now()}`,
      parserVersion: '1.0',
      items,
      rawPayload: rawPayload || { count: items.length },
      fetchedAt: new Date(),
    };
  }
}

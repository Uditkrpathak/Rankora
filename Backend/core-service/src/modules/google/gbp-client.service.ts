import { IGbpDiscoveredLocation } from '@localo/types';
import { redisClient } from '../../config/redis';
import { ENV } from '../../config/env';

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

export class GbpClientService {
  private circuitBreakers = new Map<string, CircuitState>();

  /**
   * Acquires a rate-limit token from the Redis token bucket (300 QPM global, 60 QPM per-workspace) (§Rate Limiter)
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
          console.warn(`[Google Rate Limiter] Workspace ${workspaceId} exceeded 60 QPM limit. Waiting 1s...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch {
      // Non-blocking in dev if Redis unavailable
    }
  }

  private getCircuit(workspaceId: string): CircuitState {
    let circuit = this.circuitBreakers.get(workspaceId);
    if (!circuit) {
      circuit = { failures: 0, lastFailureTime: 0, isOpen: false };
      this.circuitBreakers.set(workspaceId, circuit);
    }

    if (circuit.isOpen && Date.now() - circuit.lastFailureTime > 60_000) {
      circuit.isOpen = false;
      circuit.failures = 0;
    }

    return circuit;
  }

  private recordSuccess(workspaceId: string) {
    const circuit = this.getCircuit(workspaceId);
    circuit.failures = 0;
    circuit.isOpen = false;
  }

  private recordFailure(workspaceId: string) {
    const circuit = this.getCircuit(workspaceId);
    circuit.failures += 1;
    circuit.lastFailureTime = Date.now();
    if (circuit.failures >= 5) {
      circuit.isOpen = true;
      console.warn(`[GBP CircuitBreaker] Tripped for workspace ${workspaceId} after 5 consecutive failures`);
    }
  }

  /**
   * Executes a fetch request with exponential backoff (base 500ms, max 3 retries, jitter) and 10s timeout (§6)
   */
  public async requestWithRetry(
    url: string,
    options: RequestInit,
    workspaceId: string,
    maxRetries = 3
  ): Promise<any> {
    await this.acquireRateLimitToken(workspaceId);

    const circuit = this.getCircuit(workspaceId);
    if (circuit.isOpen) {
      const err: any = new Error('GOOGLE_CIRCUIT_BREAKER_OPEN');
      err.statusCode = 503;
      err.message = 'Google API temporary circuit open due to repeated failures. Retry in 60s.';
      throw err;
    }

    let attempt = 0;
    let delay = 500;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          this.recordSuccess(workspaceId);
          return await response.json();
        }

        const status = response.status;
        const errorBody = await response.text().catch(() => '');

        console.error(`[GBP API Error] Workspace: ${workspaceId}, Status: ${status}, URL: ${url}`);
        let parsed: any = null;
        try {
          parsed = JSON.parse(errorBody);
          console.error("GBP API status:", status);
          console.error("GBP API response:", parsed);
        } catch {
          console.error("GBP API status:", status);
          console.error("GBP API response:", errorBody);
        }

        const isZeroQuota = status === 429 && (
          errorBody.includes('Quota exceeded') ||
          errorBody.includes('Requests per minute') ||
          parsed?.error?.status === 'RESOURCE_EXHAUSTED'
        );

        if (!isZeroQuota && [429, 500, 502, 503, 504].includes(status) && attempt < maxRetries) {
          attempt++;
          const jitter = Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          delay *= 2;
          continue;
        }

        this.recordFailure(workspaceId);

        if (isZeroQuota) {
          const quotaErr: any = new Error(
            `Google Business Profile API quota is 0 for this Cloud project. Please submit the Google Business Profile API Access Request Form to activate default quota.`
          );
          quotaErr.statusCode = 429;
          quotaErr.code = 'GBP_QUOTA_ZERO';
          throw quotaErr;
        }

        let googleMessage = parsed?.error?.message || '';

        const err: any = new Error(
          status === 403
            ? `Google denied Business Profile access${googleMessage ? `: ${googleMessage}` : '. Check that Business Profile API access is approved for this Cloud project and that this Google account manages the profile.'}`
            : status === 401
              ? `Google authorization expired or was rejected${googleMessage ? `: ${googleMessage}` : '. Reconnect the Google account.'}`
              : `Google Business Profile API request failed with status ${status}${googleMessage ? `: ${googleMessage}` : ''}`
        );
        err.statusCode = status;
        err.code = 'GBP_API_REQUEST_FAILED';
        throw err;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
          console.error(`[GBP API Timeout] Request timed out after 10s for workspace: ${workspaceId}`);
          this.recordFailure(workspaceId);
          const timeoutErr: any = new Error('GOOGLE_API_TIMEOUT');
          timeoutErr.statusCode = 504;
          throw timeoutErr;
        }

        if (attempt < maxRetries && err.statusCode && [429, 500, 502, 503, 504].includes(err.statusCode) && err.code !== 'GBP_QUOTA_ZERO') {
          attempt++;
          const jitter = Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          delay *= 2;
          continue;
        }

        this.recordFailure(workspaceId);
        throw err;
      }
    }
  }

  /**
   * Discovers GBP accounts for connected user (prod-locked for mock mode)
   */
  public async listAccounts(accessToken: string, workspaceId: string): Promise<Array<{ name: string; accountName: string; type: string }>> {
    if (!accessToken) {
      throw new Error("GBP OAuth access token is missing");
    }
    console.log("GBP access token present:", Boolean(accessToken));

    if (accessToken.startsWith('mock_')) {
      if (ENV.NODE_ENV === 'production') {
        throw new Error('MOCK_GBP_DISCOVERY_FORBIDDEN_IN_PRODUCTION');
      }
      return [
        { name: 'accounts/mock_acc_1001', accountName: 'Mock Dental Organization', type: 'LOCATION_GROUP' },
      ];
    }

    const accounts: Array<{ name: string; accountName: string; type: string }> = [];
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();

    do {
      const params = new URLSearchParams({ pageSize: '20' });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await this.requestWithRetry(
        `https://mybusinessaccountmanagement.googleapis.com/v1/accounts?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        },
        workspaceId
      );

      accounts.push(...(data.accounts || []).map((acc: any) => ({
        name: acc.name,
        accountName: acc.accountName || acc.name,
        type: acc.type || 'LOCATION_GROUP',
      })));
      pageToken = data.nextPageToken || undefined;
      if (pageToken && seenTokens.has(pageToken)) break;
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);

    return accounts;
  }

  /**
   * Discovers GBP locations under a given account (prod-locked for mock mode)
   */
  public async listLocations(
    accessToken: string,
    accountName: string,
    workspaceId: string
  ): Promise<IGbpDiscoveredLocation[]> {
    if (accessToken.startsWith('mock_')) {
      if (ENV.NODE_ENV === 'production') {
        throw new Error('MOCK_GBP_DISCOVERY_FORBIDDEN_IN_PRODUCTION');
      }
      return [
        {
          gbpLocationId: 'locations/mock_loc_001',
          gbpAccountId: accountName,
          name: 'Austin Premier Orthodontics',
          address: '500 W 5th St, Suite 100',
          city: 'Austin',
          state: 'TX',
          country: 'US',
          postalCode: '78701',
          coordinates: { lat: 30.268, lng: -97.746 },
          placeId: 'ChIJ_mock_place_001',
          primaryCategory: { id: 'gcid:orthodontist', displayName: 'Orthodontist' },
          secondaryCategories: [{ id: 'gcid:dentist', displayName: 'Dentist' }],
          phone: '+15125550188',
          website: 'https://austinortho.example.com',
          regularHours: {},
        },
      ];
    }

    const readMask = 'name,title,storefrontAddress,latlng,categories,regularHours,phoneNumbers,websiteUri,profile,metadata';
    const locations: IGbpDiscoveredLocation[] = [];
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();

    do {
      const params = new URLSearchParams({ readMask, pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await this.requestWithRetry(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        workspaceId
      );

      locations.push(...(data.locations || []).map((loc: any) => this.mapRawGbpLocation(loc, accountName)));
      pageToken = data.nextPageToken || undefined;
      if (pageToken && seenTokens.has(pageToken)) break;
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);

    return locations;
  }

  /** Fetch the latest editable profile fields plus its Google-hosted photos. */
  public async getLocationSnapshot(
    accessToken: string,
    accountName: string,
    locationName: string,
    workspaceId: string
  ): Promise<IGbpDiscoveredLocation & { mediaSyncError?: string }> {
    if (accessToken.startsWith('mock_')) {
      if (ENV.NODE_ENV === 'production') {
        throw new Error('MOCK_GBP_DISCOVERY_FORBIDDEN_IN_PRODUCTION');
      }
      const safeSuffix = locationName ? locationName.replace(/[^a-zA-Z0-9_]/g, '_') : '001';
      return {
        gbpLocationId: locationName,
        gbpAccountId: accountName,
        name: 'Austin Premier Orthodontics',
        address: '500 W 5th St, Suite 100',
        city: 'Austin',
        state: 'TX',
        country: 'US',
        postalCode: '78701',
        coordinates: { lat: 30.268, lng: -97.746 },
        placeId: `ChIJ_mock_place_${safeSuffix}`,
        primaryCategory: { id: 'gcid:orthodontist', displayName: 'Orthodontist' },
        secondaryCategories: [{ id: 'gcid:dentist', displayName: 'Dentist' }],
        phone: '+15125550188',
        website: 'https://austinortho.example.com',
        regularHours: {
          monday: { open: '09:00', close: '17:00', isClosed: false },
          tuesday: { open: '09:00', close: '17:00', isClosed: false },
          wednesday: { open: '09:00', close: '17:00', isClosed: false },
          thursday: { open: '09:00', close: '17:00', isClosed: false },
          friday: { open: '09:00', close: '17:00', isClosed: false },
          saturday: { open: '', close: '', isClosed: true },
          sunday: { open: '', close: '', isClosed: true },
        },
        photosCount: 12,
        coverPhotoUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800',
        logoUrl: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=200',
        mediaSyncedAt: new Date().toISOString(),
      };
    }

    const readMask = 'name,title,storefrontAddress,latlng,categories,regularHours,phoneNumbers,websiteUri,profile,metadata';
    const params = new URLSearchParams({ readMask });
    const data = await this.requestWithRetry(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      workspaceId
    );
    const snapshot = this.mapRawGbpLocation(data, accountName);

    try {
      const media = await this.listLocationMedia(accessToken, accountName, locationName, workspaceId);
      return { ...snapshot, ...media, mediaSyncedAt: new Date().toISOString() };
    } catch (error: any) {
      return { ...snapshot, mediaSyncError: error?.message || 'Google profile photos could not be loaded.' };
    }
  }

  private async listLocationMedia(
    accessToken: string,
    accountName: string,
    locationName: string,
    workspaceId: string
  ): Promise<Pick<IGbpDiscoveredLocation, 'photosCount' | 'coverPhotoUrl' | 'logoUrl'>> {
    const accountId = accountName.replace(/^accounts\//, '');
    const locationId = locationName.replace(/^locations\//, '');
    const mediaItems: any[] = [];
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();

    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await this.requestWithRetry(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        workspaceId
      );
      mediaItems.push(...(data.mediaItems || []));
      pageToken = data.nextPageToken || undefined;
      if (pageToken && seenTokens.has(pageToken)) break;
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);

    const photos = mediaItems.filter((item) => !item.mediaFormat || item.mediaFormat === 'PHOTO');
    const urlFor = (category: string) => photos.find(
      (item) => item.locationAssociation?.category === category && item.googleUrl
    )?.googleUrl;

    return {
      photosCount: photos.length,
      coverPhotoUrl: urlFor('COVER') || urlFor('PROFILE'),
      logoUrl: urlFor('LOGO'),
    };
  }

  /**
   * Updates/patches an existing GBP location with Google Business Profile APIs (§Write-Through)
   */
  public async patchLocation(
    accessToken: string,
    locationName: string,
    updateMask: string[],
    patchData: {
      description?: string;
      regularHours?: any;
      websiteUri?: string;
      primaryCategory?: { name: string; displayName?: string };
      additionalCategories?: Array<{ name: string; displayName?: string }>;
    },
    workspaceId: string
  ): Promise<any> {
    if (accessToken.startsWith('mock_')) {
      if (ENV.NODE_ENV === 'production') {
        throw new Error('MOCK_GBP_DISCOVERY_FORBIDDEN_IN_PRODUCTION');
      }
      return {
        name: locationName,
        profile: { description: patchData.description },
        regularHours: patchData.regularHours,
        websiteUri: patchData.websiteUri,
        categories: {
          primaryCategory: patchData.primaryCategory,
          additionalCategories: patchData.additionalCategories,
        },
        updateTime: new Date().toISOString(),
      };
    }

    const maskParam = updateMask.join(',');
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?updateMask=${encodeURIComponent(maskParam)}`;

    const bodyPayload: any = {};
    if (patchData.description !== undefined) {
      bodyPayload.profile = { description: patchData.description };
    }
    if (patchData.regularHours !== undefined) {
      bodyPayload.regularHours = patchData.regularHours;
    }
    if (patchData.websiteUri !== undefined) {
      bodyPayload.websiteUri = patchData.websiteUri;
    }
    if (patchData.primaryCategory || patchData.additionalCategories) {
      bodyPayload.categories = {
        primaryCategory: patchData.primaryCategory,
        additionalCategories: patchData.additionalCategories,
      };
    }

    return this.requestWithRetry(
      url,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      },
      workspaceId
    );
  }

  /**
   * Revokes token at Google endpoint (§0 #9)
   */
  public async revokeToken(token: string): Promise<boolean> {
    if (token.startsWith('mock_')) {
      return true;
    }
    try {
      const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      return response.ok || response.status === 400;
    } catch (err) {
      console.warn('[GBP Revoke Warning] Could not reach Google revoke endpoint', err);
      return false;
    }
  }

  private mapRawGbpLocation(loc: any, accountName: string): IGbpDiscoveredLocation {
    const addressLines = loc.storefrontAddress?.addressLines || [];
    return {
      gbpLocationId: loc.name,
      gbpAccountId: accountName,
      name: loc.title || 'Untitled Business',
      address: addressLines.join(', ') || loc.storefrontAddress?.locality || 'Address Not Provided',
      city: loc.storefrontAddress?.locality || '',
      state: loc.storefrontAddress?.administrativeArea || '',
      country: loc.storefrontAddress?.regionCode || 'US',
      postalCode: loc.storefrontAddress?.postalCode || '',
      coordinates: loc.latlng ? { lat: loc.latlng.latitude, lng: loc.latlng.longitude } : null,
      placeId: loc.metadata?.placeId || null,
      primaryCategory: loc.categories?.primaryCategory
        ? { id: loc.categories.primaryCategory.name, displayName: loc.categories.primaryCategory.displayName }
        : null,
      secondaryCategories: (loc.categories?.additionalCategories || []).map((cat: any) => ({
        id: cat.name,
        displayName: cat.displayName,
      })),
      phone: loc.phoneNumbers?.primaryPhone || '',
      website: loc.websiteUri || '',
      description: loc.profile?.description || '',
      regularHours: this.mapRegularHours(loc.regularHours),
    };
  }

  private mapRegularHours(value: any): IGbpDiscoveredLocation['regularHours'] {
    const periods = value?.periods;
    if (!Array.isArray(periods) || periods.length === 0) return {};

    const formatTime = (time: any) => {
      if (typeof time === 'string') return time;
      if (!time || typeof time !== 'object') return '';
      return `${String(time.hours ?? 0).padStart(2, '0')}:${String(time.minutes ?? 0).padStart(2, '0')}`;
    };
    const mapped: NonNullable<IGbpDiscoveredLocation['regularHours']> = {};
    for (const period of periods) {
      const day = String(period.openDay || '').toUpperCase();
      if (!day) continue;
      const previous = mapped[day];
      const open = formatTime(period.openTime);
      const close = formatTime(period.closeTime);
      mapped[day] = {
        open: previous?.open ? `${previous.open}, ${open}` : open,
        close: previous?.close ? `${previous.close}, ${close}` : close,
        isClosed: false,
      };
    }
    return mapped;
  }
}

export const gbpClientService = new GbpClientService();

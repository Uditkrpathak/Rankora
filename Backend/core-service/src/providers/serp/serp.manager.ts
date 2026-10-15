import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { ISERPProvider, SERPOptions, SERPResult, GridPinStatus } from './serp.types';
import { MockSERPProvider } from './mock-serp.provider';
import { GoogleMapsHttpProvider, isLocalClientError } from './google-maps-http.provider';
import { CascadeRoutingEngine } from './cascade-routing.engine';
import { serpCircuitBreaker } from './serp-circuit-breaker';
import { serpBudgetGuard } from './serp-budget-guard';
import { ENV } from '../../config/env';

import mongoose from 'mongoose';
import { SerpSnapshot, generateSnapshotCacheKey, getSerpCacheTtlSeconds } from '../../models/SerpSnapshot';
import { H3SpatialService } from '../../modules/rankings/h3-spatial.service';
import { redisClient, memoryFallback } from '../../config/redis';
import { GRID_POINT_TIMEOUT_MS } from '../../config/scan-queue.config';
import { logger } from '../../config/logger';

// Lock TTL strictly exceeds provider request timeout (30-45s) to eliminate premature expiry stampedes
const SINGLE_FLIGHT_LOCK_TTL_SECONDS = 60;
const COMPARE_AND_DELETE_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

export class SerpManager {
  private providers: Map<string, ISERPProvider> = new Map();
  private cascadeEngine: CascadeRoutingEngine = new CascadeRoutingEngine();

  constructor() {
    this.initProviders();
  }

  public initProviders(): void {
    try {
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    } catch {}

    if (!this.providers.has('GOOGLE_MAPS_HTTP')) {
      this.providers.set('GOOGLE_MAPS_HTTP', new GoogleMapsHttpProvider());
    }

    if (!this.providers.has('MOCK')) {
      this.providers.set('MOCK', new MockSERPProvider());
    }
  }

  public registerProvider(provider: ISERPProvider): void {
    this.providers.set(provider.name.toUpperCase(), provider);
  }

  private async tryAcquireLock(lockKey: string, ownerToken: string, ttlSeconds: number): Promise<boolean> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const res = await redisClient.set(lockKey, ownerToken, 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch (err) {
        console.warn('[SERP Manager] Redis lock acquisition failed, falling back to memory:', err);
      }
    }
    const existing = memoryFallback.get(lockKey);
    const now = Date.now();
    if (!existing || existing.exp < now) {
      memoryFallback.set(lockKey, { val: ownerToken, exp: now + ttlSeconds * 1000 });
      return true;
    }
    return false;
  }

  private async releaseLock(lockKey: string, ownerToken: string): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.eval(COMPARE_AND_DELETE_SCRIPT, 1, lockKey, ownerToken);
        return;
      } catch (err) {
        console.warn('[SERP Manager] Redis lock release failed, falling back to memory:', err);
      }
    }
    const existing = memoryFallback.get(lockKey);
    if (existing && existing.val === ownerToken) {
      memoryFallback.delete(lockKey);
    }
  }

  /**
   * Fetches SERP results with H3 cell snapping, cross-tenant snapshot caching,
   * hardened single-flight locking, freshness policies, circuit breaking, and failover.
   */
  public async executeSearch(options: SERPOptions): Promise<{
    result: SERPResult | null;
    budgetExceeded: boolean;
    error?: string;
  }> {
    this.initProviders();

    const configured = (process.env.SERP_PROVIDER || ENV.SERP_PROVIDER || 'GOOGLE_MAPS_HTTP').toUpperCase();
    if (configured === 'MOCK' && (process.env.NODE_ENV === 'production' || ENV.isProd)) {
      throw new Error('[FATAL] SERP_PROVIDER=MOCK is strictly disallowed in production environment.');
    }
    const primaryChoice = configured === 'MOCK' ? 'MOCK' : 'GOOGLE_MAPS_HTTP';

    const effectiveDevice: 'mobile' | 'desktop' =
      options.device || ((process.env.MAPS_ENDPOINT_MODE as any) === 'desktop' ? 'desktop' : 'mobile');

    // 1. Spatial H3 Snapping (§4.3)
    const radiusKm = options.radiusKm || 3.5;
    const spatial = H3SpatialService.snapCoordinateToCell(
      options.lat,
      options.lng,
      radiusKm,
      undefined,
      undefined,
      options.h3Resolution
    );
    const cellId = options.cellId || spatial.cellId;

    // S3 Spatial Redis Cache Key: v2:{keyword-normalized}:{h3CellId}:{hl}:{gl}:{device}
    // Shared across all tenants without tenantId or dateBucket.
    const cacheKey = generateSnapshotCacheKey(
      options.keyword,
      cellId,
      options.localization?.hl || 'en',
      options.localization?.gl || 'in',
      effectiveDevice
    );

    // 2. Freshness Policy Evaluation (§4.4 & Spec S3)
    // On-demand re-scans use a freshness window (default 60 min, via maxAgeMinutes / bypassCache / forceFresh).
    // Scheduled scans use the full 48-72h Redis TTL.
    const isBypass = Boolean(options.forceFresh || options.bypassCache);
    const isScheduled = Boolean(options.scheduled);
    const maxAgeMinutes = options.maxAgeMinutes ?? (options.maxAgeHours ? options.maxAgeHours * 60 : 60);

    const lookupRedisSnapshot = async (): Promise<SERPResult | null> => {
      if (isBypass) return null;

      try {
        let rawJson: string | null = null;
        if (redisClient && redisClient.status === 'ready') {
          rawJson = await redisClient.get(cacheKey);
        } else {
          const mem = memoryFallback.get(cacheKey);
          if (mem && mem.exp > Date.now()) {
            rawJson = typeof mem.val === 'string' ? mem.val : JSON.stringify(mem.val);
          }
        }

        if (rawJson) {
          const cached = JSON.parse(rawJson);
          if (cached && cached.fetchedAt) {
            const fetchedAt = new Date(cached.fetchedAt);
            const ageMinutes = (Date.now() - fetchedAt.getTime()) / (60 * 1000);

            // Freshness window enforcement for on-demand re-scans
            if (!isScheduled && ageMinutes > maxAgeMinutes) {
              logger.info({ cacheKey, ageMinutes, maxAgeMinutes }, '[SERP Manager] Cached entry exceeded on-demand freshness window; re-scraping');
              return null;
            }

            return {
              provider: cached.provider || primaryChoice,
              providerRequestId: cached.providerRequestId || 'redis_cached_snapshot',
              parserVersion: cached.parserVersion || '1.0',
              status: (cached.status || (cached.empty ? 'EMPTY_VALID' : 'OK')) as any,
              pinStatus: (cached.pinStatus || (cached.empty ? 'EMPTY' : 'OK')) as any,
              items: cached.items || [],
              empty: Boolean(cached.empty),
              rawPayload: cached.rawPayload,
              fetchedAt,
              dataAsOf: fetchedAt,
              cached: true,
              costUsd: 0.0,
              cellId: cached.cellId || cellId,
              snappedLat: cached.snappedLat ?? spatial.snappedLat,
              snappedLng: cached.snappedLng ?? spatial.snappedLng,
              h3Resolution: cached.h3Resolution ?? spatial.resolution,
            };
          }
        }
      } catch (err: any) {
        logger.warn({ err }, '[SERP Manager] Redis spatial cache read error');
      }

      return null;
    };

    if (!isBypass) {
      const cachedHit = await lookupRedisSnapshot();
      if (cachedHit) {
        return { result: cachedHit, budgetExceeded: false };
      }
    }

    // 3. Hardened Single-Flight Mutex with Owner-Token CAS and Single Takeover
    const lockKey = `lock:snap:${cacheKey}`;
    const ownerToken = randomUUID();
    let lockAcquired = await this.tryAcquireLock(lockKey, ownerToken, SINGLE_FLIGHT_LOCK_TTL_SECONDS);

    // If another worker holds the lock, spin-wait up to 5s for that worker to write the snapshot
    if (!lockAcquired && !isBypass) {
      for (let attempt = 0; attempt < 50; attempt++) {
        await new Promise((r) => setTimeout(r, 100));
        const resolvedCache = await lookupRedisSnapshot();
        if (resolvedCache) {
          return { result: resolvedCache, budgetExceeded: false };
        }
      }

      // Max wait expired without snapshot: attempt a single serialized takeover
      lockAcquired = await this.tryAcquireLock(lockKey, ownerToken, SINGLE_FLIGHT_LOCK_TTL_SECONDS);
      if (!lockAcquired) {
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise((r) => setTimeout(r, 100));
          const resolvedCache = await lookupRedisSnapshot();
          if (resolvedCache) {
            return { result: resolvedCache, budgetExceeded: false };
          }
        }
      }
    }

    try {
      const candidateNames = [primaryChoice];
      const uniqueCandidates = candidateNames.filter((n) => this.providers.has(n));

      if (uniqueCandidates.length === 0) {
        return {
          result: null,
          budgetExceeded: false,
          error: `No live SERP provider is configured.`,
        };
      }

      let lastProviderError: string | undefined;

      for (const name of uniqueCandidates) {
        const provider = this.providers.get(name);
        if (!provider) continue;

        const canCall = await serpCircuitBreaker.canExecute(name);
        if (!canCall) {
          console.warn(`[SERP Manager] Circuit breaker for ${name} is OPEN. Failing over.`);
          continue;
        }

        const reservation = await serpBudgetGuard.reserveProviderCall(name);
        if (!reservation.reserved) {
          console.warn('⚠️ [SERP Manager] Daily SERP spend budget reached.');
          return { result: null, budgetExceeded: true };
        }

        try {
          let result: SERPResult;
          if (name === 'GOOGLE_MAPS_HTTP') {
            result = await this.cascadeEngine.searchWithCascade({
              ...options,
              lat: spatial.snappedLat,
              lng: spatial.snappedLng,
              cellId,
              device: effectiveDevice,
            }, (options as any).businessId || (options as any).workspaceId);
          } else {
            result = await provider.search({
              ...options,
              lat: spatial.snappedLat,
              lng: spatial.snappedLng,
              cellId,
            });
          }
          await serpCircuitBreaker.recordSuccess(name);


          // 4. Cache Policy & Poison Protection (Spec S3)
          // - NEVER cache parse errors, blocks, timeouts, or suspicious empties
          // - DO cache validated empty results with 1h TTL (3600s) and empty: true
          // - DO cache verified results with 48-72h TTL (default 60h via SERP_CACHE_TTL_HOURS)
          const isParseError = result?.status === 'PARSE_ERROR' || (result as any)?.status === 'BLOCKED' || (result as any)?.status === 'CAPTCHA';
          const isEmpty = Boolean(result && Array.isArray(result.items) && result.items.length === 0);
          const isSuspiciousEmpty = isEmpty && result.status !== 'EMPTY_VALID' && (result as any)?.wireBytes !== undefined && (result as any)?.wireBytes < 500;

          if (result && Array.isArray(result.items) && !isParseError && !isSuspiciousEmpty) {
            const actualCostUsd = result.costUsd || ENV.SERP_COST_PER_POINT_USD || 0.002;
            const ttlSeconds = getSerpCacheTtlSeconds(isEmpty);

            const redisPayload = {
              provider: name,
              providerRequestId: result.providerRequestId,
              parserVersion: result.parserVersion,
              status: isEmpty ? 'EMPTY_VALID' : (result.status || 'OK'),
              pinStatus: isEmpty ? 'EMPTY' : (result.pinStatus || 'OK'),
              items: result.items,
              empty: isEmpty,
              rawPayload: result.rawPayload,
              fetchedAt: (result.fetchedAt || new Date()).toISOString(),
              cellId,
              snappedLat: spatial.snappedLat,
              snappedLng: spatial.snappedLng,
              h3Resolution: spatial.resolution,
              device: effectiveDevice,
              costUsd: 0.0,
            };

            // Write to Redis
            if (redisClient && redisClient.status === 'ready') {
              try {
                await redisClient.set(cacheKey, JSON.stringify(redisPayload), 'EX', ttlSeconds);
              } catch (err: any) {
                console.warn('[SERP Manager] Redis spatial cache write error:', err.message);
              }
            } else {
              memoryFallback.set(cacheKey, { val: JSON.stringify(redisPayload), exp: Date.now() + ttlSeconds * 1000 });
            }

            // Asynchronously archive in Mongo (raw payloads & persistent log)
            if (mongoose.connection.readyState === 1) {
              SerpSnapshot.findOneAndUpdate(
                { cacheKey },
                {
                  $set: {
                    cacheKey,
                    cellId,
                    resolution: spatial.resolution,
                    provider: name,
                    keywordNorm: options.keyword.trim().toLowerCase().replace(/\s+/g, ' '),
                    lat: spatial.snappedLat,
                    lng: spatial.snappedLng,
                    radiusKm: Number(radiusKm.toFixed(1)),
                    hl: options.localization?.hl || 'en',
                    gl: options.localization?.gl || 'in',
                    dateBucket: new Date().toISOString().slice(0, 10),
                    empty: isEmpty,
                    items: result.items.map((it) => ({
                      placeId: it.placeId,
                      name: it.name,
                      address: it.address,
                      rating: it.rating,
                      reviewsCount: it.reviewsCount,
                      primaryCategory: it.primaryCategory,
                      phone: it.phone,
                      website: it.website,
                      rank: it.rank,
                      isTarget: false,
                    })),
                    rawPayload: result.rawPayload,
                    providerRequestId: result.providerRequestId,
                    parserVersion: result.parserVersion,
                    costUsd: actualCostUsd,
                    fetchedAt: result.fetchedAt || new Date(),
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                  },
                },
                { upsert: true, new: true }
              ).catch((err) => console.warn('[SERP Manager] Mongo snapshot archive error:', err.message));
            }
          }

          return {
            result: result ? {
              ...result,
              empty: isEmpty,
              dataAsOf: result.fetchedAt || new Date(),
              cached: false,
            } : null,
            budgetExceeded: false,
          };
        } catch (err: any) {
          const errMsg = String(err?.message || 'provider request failed');
          lastProviderError = `${name}: ${errMsg}`;
          console.error(`[SERP Manager] Provider ${name} call failed:`, errMsg);

          const isBillingError = /402|payment required|insufficient funds|balance/i.test(errMsg);
          const isAuthError = /401|unauthorized|invalid credentials/i.test(errMsg);
          const isBlockOrRateLimit = /403|429|captcha|blocked|rate limit|forbidden/i.test(errMsg);
          const isLocalError = err?.code === 'LOCAL_CLIENT_ERROR' || isLocalClientError(err);

          if (isBillingError) {
            await serpCircuitBreaker.tripImmediately(name, 'PROVIDER_BILLING_ERROR', 600);
          } else if (isAuthError) {
            await serpCircuitBreaker.tripImmediately(name, 'PROVIDER_AUTH_ERROR', 600);
          } else if (isBlockOrRateLimit) {
            // NFR-C2: Block/CAPTCHA/429/403 trips breaker immediately without endless retry loops
            await serpCircuitBreaker.tripImmediately(name, 'PROVIDER_BLOCKED_OR_RATE_LIMITED', 300);
          } else if (isLocalError) {
            // Local client errors (destroyed client / socket abort caused locally) NEVER penalize circuit breaker
            console.warn(`[SERP Manager] Local client error on ${name} (${errMsg}) excluded from circuit breaker.`);
          } else {
            // Upstream outcomes (5xx, TIMEOUT)
            await serpCircuitBreaker.recordFailure(name);
          }
        }
      }

      return {
        result: null,
        budgetExceeded: false,
        error: lastProviderError || 'All configured live SERP providers are unavailable.',
      };
    } finally {
      // Safe owner-token compare-and-delete lock release
      if (lockAcquired) {
        await this.releaseLock(lockKey, ownerToken);
      }
    }
  }

  /**
   * Per-point execution without Promise.race / AbortSignal.
   * Directly executes search, allowing provider-level timeout and connection
   * management to complete, and classifies per-pin status from error.code and result.status.
   */
  public async executeSearchWithTimeout(
    options: SERPOptions,
    _timeoutMs: number = GRID_POINT_TIMEOUT_MS
  ): Promise<{
    result: (SERPResult & { error?: string }) | null;
    budgetExceeded: boolean;
    error?: string;
  }> {
    try {
      const response = await this.executeSearch({ ...options, searchSpanMeters: options.searchSpanMeters });
      if (response.result) {
        response.result.pinStatus = classifyPinStatus(response.result);
      }
      return response;
    } catch (err: any) {
      const status = classifyPinStatus(null, err);
      const isTimeout = status === 'TIMEOUT';
      return {
        result: {
          provider: isTimeout ? 'TIMEOUT' : 'ERROR',
          providerRequestId: `err_${Date.now()}`,
          parserVersion: '1.0',
          status,
          pinStatus: status,
          items: [],
          empty: true,
          rawPayload: null,
          fetchedAt: new Date(),
          dataAsOf: new Date(),
          cached: false,
          costUsd: 0,
          error: err?.message || status,
          snappedLat: options.lat,
          snappedLng: options.lng,
          cellId: options.cellId,
          h3Resolution: options.h3Resolution,
        } as any,
        budgetExceeded: false,
        error: err?.message || status,
      };
    }
  }
}

export function classifyPinStatus(
  result: SERPResult | null,
  error?: any
): GridPinStatus {
  if (error) {
    const errCode = (error.code || error.name || '').toUpperCase();
    const errMsg = (error.message || String(error)).toLowerCase();
    if (
      errCode === 'SCRAPER_TIMEOUT' ||
      errCode === 'TIMEOUT' ||
      errCode === 'ETIMEDOUT' ||
      errCode === 'POINT_TIMEOUT' ||
      errMsg.includes('timeout') ||
      errMsg.includes('timed out')
    ) {
      return 'TIMEOUT';
    }
    if (
      errCode === 'SCRAPER_CAPTCHA' ||
      errMsg.includes('recaptcha') ||
      errMsg.includes('captcha') ||
      errMsg.includes('sorry/index')
    ) {
      return 'CAPTCHA';
    }
    if (
      errCode === 'SCRAPER_BLOCKED' ||
      errMsg.includes('blocked') ||
      errMsg.includes('unusual traffic') ||
      errMsg.includes('429') ||
      errMsg.includes('403')
    ) {
      return 'BLOCKED';
    }
    return 'ERROR';
  }

  if (!result) return 'ERROR';
  if (result.pinStatus) return result.pinStatus;
  if (result.status === 'BLOCKED') return 'BLOCKED';
  if (result.status === 'CAPTCHA') return 'CAPTCHA';
  if (result.status === 'PARSE_ERROR') return 'ERROR';
  if (result.status === 'EMPTY_VALID') return 'EMPTY';
  if (result.empty || (Array.isArray(result.items) && result.items.length === 0)) {
    return 'EMPTY';
  }
  return 'OK';
}

export const serpManager = new SerpManager();


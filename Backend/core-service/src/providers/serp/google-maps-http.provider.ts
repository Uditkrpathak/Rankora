import { ProxyAgent, request as undiciRequest } from 'undici';
import crypto from 'crypto';
import { logger } from '../../config/logger';
import { ENV } from '../../config/env';
import { ISERPProvider, SERPOptions, SERPResult } from './serp.types';
import {
  extractGoogleMapsListings,
  assertNotBlocked,
  GoogleMapsParseError,
  GoogleMapsParsedResult,
  PARSER_VERSION,
} from './google-maps-field-mapping';
import { HttpFetcher } from './http-fetcher.interface';
import { UndiciFetcher } from './undici-fetcher';
import { TlsImpersonatingFetcher } from './tls-fetcher';
import { CurlImpersonateFetcher } from './curl-impersonate-fetcher';

export interface UAEntry {
  ua: string;
  platform?: string;
  mobile?: string;
  brands?: string;
  isChromium: boolean;
}

export const DESKTOP_USER_AGENTS_POOL: UAEntry[] = [
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Windows',
    mobile: '?0',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'macOS',
    mobile: '?0',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    platform: 'Windows',
    mobile: '?0',
    brands: '"Chromium";v="123", "Google Chrome";v="123", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Linux',
    mobile: '?0',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    isChromium: false,
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
    isChromium: false,
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    isChromium: false,
  },
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    platform: 'Windows',
    mobile: '?0',
    brands: '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    platform: 'Windows',
    mobile: '?0',
    brands: '"Chromium";v="122", "Google Chrome";v="122", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    platform: 'macOS',
    mobile: '?0',
    brands: '"Chromium";v="123", "Google Chrome";v="123", "Not-A.Brand";v="99"',
    isChromium: true,
  },
];

export const MOBILE_USER_AGENTS_POOL: UAEntry[] = [
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="122", "Samsung Internet";v="24", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    isChromium: false,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.120 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="123", "Google Chrome";v="123", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1',
    platform: 'iOS',
    mobile: '?1',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; 23127PN0CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; CPH2581) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    isChromium: false,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"',
    isChromium: true,
  },
  {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
    isChromium: false,
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.141 Mobile Safari/537.36',
    platform: 'Android',
    mobile: '?1',
    brands: '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"',
    isChromium: true,
  },
];

export const USER_AGENTS_POOL = DESKTOP_USER_AGENTS_POOL.map((m) => m.ua);

import { ProxyGatewayLimiter } from './proxy-gateway-limiter';
export { ProxyGatewayLimiter };

export interface PooledAgent {
  agent: ProxyAgent;
  sessionId: string;
  requestCount: number;
  activeLeases: number;
  isRetired: boolean;
  createdAt: number;
  lastUsedAt: number;
}

export function isLocalClientError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = (err.code || err.name || '').toUpperCase();
  return (
    msg.includes('client is destroyed') ||
    msg.includes('the client is closed') ||
    msg.includes('client was destroyed') ||
    msg.includes('other side closed') ||
    msg.includes('premature close') ||
    msg.includes('socket hang up') ||
    code === 'UND_ERR_DESTROYED' ||
    code === 'UND_ERR_CLOSED' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_ABORTED' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE'
  );
}

export interface GoogleMapsHttpProviderConfig {
  proxyUrl?: string;
  sessionTemplate?: string;
  maxRequestsPerSession?: number;
  maxPoolSize?: number;
  ipCheckInterval?: number;
  requestTimeoutMs?: number;
  baseUrlOverride?: string;
  customDispatcher?: ProxyAgent;
  fetcher?: HttpFetcher;
  endpointMode?: 'mobile' | 'desktop';
  minRequestSpacingMs?: number;
  maxConcurrentPerGateway?: number;
}

export class GoogleMapsHttpProvider implements ISERPProvider {
  public readonly name = 'GOOGLE_MAPS_HTTP';

  private static agentPool: Map<string, PooledAgent> = new Map();
  private static currentActiveSessionId: string | null = null;
  private static gatewayLimiter = new ProxyGatewayLimiter(15);
  private uaIndex = 0;
  private totalRequestsCount = 0;
  private lastKnownExitIpHash?: string;
  private fetcher: HttpFetcher;

  constructor(private readonly config: GoogleMapsHttpProviderConfig = {}) {
    const isProd = process.env.NODE_ENV === 'production' || ENV.isProd;
    const defaultFetcher = isProd ? 'curl-impersonate' : 'undici';
    const fetcherType = (process.env.HTTP_FETCHER || defaultFetcher).toLowerCase();
    if (config.fetcher) {
      this.fetcher = config.fetcher;
    } else if (fetcherType === 'curl-impersonate' || fetcherType === 'cycletls') {
      this.fetcher = new CurlImpersonateFetcher();
    } else if (fetcherType === 'tls') {
      this.fetcher = new TlsImpersonatingFetcher();
    } else {
      this.fetcher = new UndiciFetcher();
    }
  }

  public static getPoolSize(): number {
    return GoogleMapsHttpProvider.agentPool.size;
  }

  public generateSessionProxyUrl(sessionId: string): string | undefined {
    const template = this.config.sessionTemplate || process.env.PROXY_SESSION_TEMPLATE?.trim();
    if (template) {
      return template.replace(/\$\{SESSION_ID\}|\$SESSION_ID/g, sessionId);
    }
    if (this.config.baseUrlOverride && !this.config.proxyUrl) {
      return undefined;
    }
    return this.config.proxyUrl || process.env.SCRAPER_PROXY_URL?.trim();
  }

  public acquireSessionDispatcher(requestedSessionId?: string): {
    agent: ProxyAgent | undefined;
    sessionId: string;
    release: () => void;
  } {
    if (this.config.customDispatcher) {
      return { agent: this.config.customDispatcher, sessionId: 'custom', release: () => {} };
    }

    const maxReqs = this.config.maxRequestsPerSession || parseInt(process.env.PROXY_MAX_REQS_PER_SESSION || '5', 10);
    const maxPoolSize = this.config.maxPoolSize || parseInt(process.env.PROXY_MAX_POOL_SIZE || '50', 10);

    let targetSessionId = requestedSessionId;

    if (!targetSessionId) {
      const activeId = GoogleMapsHttpProvider.currentActiveSessionId;
      const current = activeId ? GoogleMapsHttpProvider.agentPool.get(activeId) : undefined;

      if (!current || current.isRetired || current.requestCount >= maxReqs) {
        if (current && !current.isRetired) {
          current.isRetired = true;
        }
        targetSessionId = crypto.randomBytes(4).toString('hex');
        GoogleMapsHttpProvider.currentActiveSessionId = targetSessionId;
      } else {
        targetSessionId = current.sessionId;
      }
    }

    let pooled = GoogleMapsHttpProvider.agentPool.get(targetSessionId);

    if (pooled && (pooled.isRetired || pooled.requestCount >= maxReqs)) {
      pooled.isRetired = true;
      if (!requestedSessionId && GoogleMapsHttpProvider.currentActiveSessionId === targetSessionId) {
        targetSessionId = crypto.randomBytes(4).toString('hex');
        GoogleMapsHttpProvider.currentActiveSessionId = targetSessionId;
        pooled = undefined;
      }
    }

    if (!pooled) {
      // 1. Clean up retired agents that have finished all in-flight requests
      for (const [id, agentRecord] of GoogleMapsHttpProvider.agentPool.entries()) {
        if (agentRecord.isRetired && agentRecord.activeLeases <= 0) {
          agentRecord.agent.close().catch(() => {});
          GoogleMapsHttpProvider.agentPool.delete(id);
        }
      }

      // 2. If pool is at or above capacity, evict the oldest unleased session (or oldest retired session)
      while (GoogleMapsHttpProvider.agentPool.size >= maxPoolSize) {
        let evictKey: string | null = null;
        let oldestTime = Infinity;

        // Try unleased first
        for (const [id, agentRecord] of GoogleMapsHttpProvider.agentPool.entries()) {
          if (agentRecord.activeLeases <= 0 && agentRecord.lastUsedAt < oldestTime) {
            oldestTime = agentRecord.lastUsedAt;
            evictKey = id;
          }
        }

        // If none unleased, evict the absolute oldest session
        if (!evictKey) {
          oldestTime = Infinity;
          for (const [id, agentRecord] of GoogleMapsHttpProvider.agentPool.entries()) {
            if (agentRecord.lastUsedAt < oldestTime) {
              oldestTime = agentRecord.lastUsedAt;
              evictKey = id;
            }
          }
        }

        if (evictKey) {
          const toEvict = GoogleMapsHttpProvider.agentPool.get(evictKey);
          if (toEvict) {
            toEvict.isRetired = true;
            if (toEvict.activeLeases <= 0) {
              toEvict.agent.close().catch(() => {});
            }
            GoogleMapsHttpProvider.agentPool.delete(evictKey);
            if (GoogleMapsHttpProvider.currentActiveSessionId === evictKey) {
              GoogleMapsHttpProvider.currentActiveSessionId = null;
            }
          }
        } else {
          break;
        }
      }

      const proxyUrl = this.generateSessionProxyUrl(targetSessionId);

      if (proxyUrl && !proxyUrl.includes('proxy.example.com')) {
        try {
          new URL(proxyUrl);
          const newAgent = new ProxyAgent({
            uri: proxyUrl,
            keepAliveTimeout: 30000,
            keepAliveMaxTimeout: 60000,
            pipelining: 1,
          });

          pooled = {
            agent: newAgent,
            sessionId: targetSessionId,
            requestCount: 0,
            activeLeases: 0,
            isRetired: false,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
          };

          GoogleMapsHttpProvider.agentPool.set(targetSessionId, pooled);
        } catch (err: any) {
          console.warn(`[GoogleMapsHttpProvider] Invalid proxy URL: ${err.message}. Direct connections will be used.`);
          return { agent: undefined, sessionId: 'direct', release: () => {} };
        }
      } else {
        return { agent: undefined, sessionId: 'direct', release: () => {} };
      }
    }

    pooled.requestCount++;
    pooled.activeLeases++;
    pooled.lastUsedAt = Date.now();
    if (pooled.requestCount >= maxReqs) {
      pooled.isRetired = true;
      if (GoogleMapsHttpProvider.currentActiveSessionId === pooled.sessionId) {
        GoogleMapsHttpProvider.currentActiveSessionId = null;
      }
    }

    const leasedRecord = pooled;
    const leasedSessionId = pooled.sessionId;
    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      leasedRecord.activeLeases = Math.max(0, leasedRecord.activeLeases - 1);
      if (leasedRecord.isRetired && leasedRecord.activeLeases <= 0) {
        leasedRecord.agent.close().catch(() => {});
        GoogleMapsHttpProvider.agentPool.delete(leasedSessionId);
      }
    };

    return { agent: pooled.agent, sessionId: pooled.sessionId, release };
  }

  public getOrCreateSessionDispatcher(requestedSessionId?: string): { agent: ProxyAgent | undefined; sessionId: string } {
    const { agent, sessionId, release } = this.acquireSessionDispatcher(requestedSessionId);
    // Legacy getOrCreateSessionDispatcher immediately releases the reference count
    release();
    return { agent, sessionId };
  }

  private getNextUserAgent(): UAEntry {
    const mode = this.config.endpointMode || process.env.MAPS_ENDPOINT_MODE || 'mobile';
    const pool = mode === 'desktop' ? DESKTOP_USER_AGENTS_POOL : MOBILE_USER_AGENTS_POOL;
    const entry = pool[this.uaIndex % pool.length];
    this.uaIndex++;
    return entry;
  }

  public buildHeaders(hl: string, gl: string, uaEntry?: UAEntry): Record<string, string> {
    const entry = uaEntry || this.getNextUserAgent();
    const headers: Record<string, string> = {
      'User-Agent': entry.ua,
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': `${hl}-${gl.toUpperCase()},${hl};q=0.9`,
      'Referer': 'https://www.google.com/maps/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };

    // STRICT INVARIANT: Sec-CH-UA* client hints ONLY for Chromium-based browsers
    if (entry.isChromium) {
      if (entry.brands) {
        headers['Sec-CH-UA'] = entry.brands;
      }
      if (entry.mobile) {
        headers['Sec-CH-UA-Mobile'] = entry.mobile;
      }
      if (entry.platform) {
        headers['Sec-CH-UA-Platform'] = `"${entry.platform}"`;
      }
    }

    return headers;
  }

  public async checkExitIp(options?: string | { sessionId?: string; dispatcher?: any }): Promise<{ ipHash?: string; rawIp?: string } | null> {
    try {
      const sessionId = typeof options === 'string' ? options : options?.sessionId;
      const dispatcher = typeof options === 'object' && options?.dispatcher
        ? options.dispatcher
        : this.getOrCreateSessionDispatcher(sessionId).agent;
      const echoUrl = this.config.baseUrlOverride ? `${this.config.baseUrlOverride}?ip_echo=true` : 'https://api.ipify.org?format=json';
      const res = await undiciRequest(echoUrl, {
        method: 'GET',
        dispatcher,
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);

      if (!res || res.statusCode !== 200) {
        console.warn('[GoogleMapsHttpProvider] Exit IP echo failed or returned non-200');
        return null;
      }

      const body: any = await res.body.json();
      const ip = body?.ip?.trim();
      if (!ip) {
        return null;
      }

      const hash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
      this.lastKnownExitIpHash = hash;
      return { ipHash: hash, rawIp: ip };
    } catch (err: any) {
      console.warn(`[GoogleMapsHttpProvider] Exit IP check failed: ${err.message}`);
      return null;
    }
  }

  public buildSearchUrl(options: SERPOptions): string {
    const { keyword, lat, lng, localization } = options;
    const hl = localization?.hl || 'en';
    const gl = localization?.gl || 'in';
    const spanMeters = options.searchSpanMeters || 1000;
    const mode = this.config.endpointMode || process.env.MAPS_ENDPOINT_MODE || 'mobile';
    const baseUrl = this.config.baseUrlOverride || 'https://www.google.com/search';

    // Viewport: mobile 390x844 vs desktop 1024x768 (Field 1: width !1i, Field 2: height !2i)
    const viewportParam = mode === 'desktop' ? '!1i1024!2i768' : '!1i390!2i844';
    return `${baseUrl}?tbm=map&authuser=0&hl=${hl}&gl=${gl}&q=${encodeURIComponent(keyword)}&pb=!4m8!1m3!1d${spanMeters}!2d${lng.toFixed(6)}!3d${lat.toFixed(6)}!3m2${viewportParam}!4f13.1!7i20!10b1!12m3!1m1!18b1!20e3`;
  }

  public parseGoogleResponse(rawPayload: string, options?: { targetPlaceId?: string; targetName?: string }): GoogleMapsParsedResult {
    if (!rawPayload || !rawPayload.trim()) {
      return { status: 'EMPTY_VALID', items: [], rawCount: 0, parserVersion: PARSER_VERSION };
    }
    assertNotBlocked(rawPayload);
    return extractGoogleMapsListings(rawPayload, options);
  }

  private extractGatewayKey(proxyUrl?: string): string {
    if (!proxyUrl) return 'direct';
    try {
      const u = new URL(proxyUrl);
      return u.hostname || 'direct';
    } catch {
      return 'direct';
    }
  }

  public async search(options: SERPOptions): Promise<SERPResult> {
    const { lat, lng, localization } = options;
    const hl = localization?.hl || 'en';
    const gl = localization?.gl || 'in';
    const uaEntry = this.getNextUserAgent();

    const url = this.buildSearchUrl(options);
    const headers = this.buildHeaders(hl, gl, uaEntry);
    const timeoutMs = this.config.requestTimeoutMs || parseInt(process.env.SCRAPER_TIMEOUT_MS || '12000', 10);

    const executeFetchWithLease = async (isRetry = false): Promise<SERPResult> => {
      const { agent: dispatcher, sessionId, release } = this.acquireSessionDispatcher();
      const gatewayKey = this.extractGatewayKey(this.generateSessionProxyUrl(sessionId));
      const releaseGateway = await GoogleMapsHttpProvider.gatewayLimiter.acquire(gatewayKey);

      let hasCleanedUpLease = false;
      const cleanupCurrentLease = () => {
        if (hasCleanedUpLease) return;
        hasCleanedUpLease = true;
        try { release(); } catch {}
        try { releaseGateway(); } catch {}
      };

      const startTime = Date.now();
      const fetchedAt = new Date();

      try {
        const minSpacing = this.config.minRequestSpacingMs ?? 100;
        if (minSpacing > 0 && !isRetry) {
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * minSpacing)));
        }

        this.totalRequestsCount++;
        const ipCheckInterval = this.config.ipCheckInterval || parseInt(process.env.PROXY_IP_CHECK_INTERVAL || '0', 10);
        if (ipCheckInterval > 0 && this.totalRequestsCount % ipCheckInterval === 0) {
          await this.checkExitIp({ sessionId, dispatcher });
        }

        const response = await this.fetcher.fetch(url, {
          headers,
          dispatcher,
          timeoutMs,
        });

        const latencyMs = Date.now() - startTime;
        logger.info(`[GoogleMapsHttpProvider:WireBytes] status=${response.statusCode} bytes=${response.wireBytes} (${(response.wireBytes / 1024).toFixed(2)} KB) latency=${latencyMs}ms mode=${this.config.endpointMode || process.env.MAPS_ENDPOINT_MODE || 'mobile'}`);

        if (response.statusCode >= 300 && response.statusCode < 400) {
          const redirectLocation = (response.headers['location'] as string) || '';
          throw new GoogleMapsParseError(
            `SCRAPER_BLOCKED: Google redirected (HTTP ${response.statusCode}) to ${redirectLocation || 'another page'}`,
            'SCRAPER_BLOCKED',
            response.rawText
          );
        }

        if (response.statusCode === 429 || response.statusCode === 403) {
          throw new GoogleMapsParseError(
            `SCRAPER_BLOCKED: Google returned HTTP ${response.statusCode}`,
            'SCRAPER_BLOCKED',
            response.rawText
          );
        }

        if (response.statusCode >= 500) {
          throw new GoogleMapsParseError(
            `SCRAPER_UPSTREAM_ERROR: Google Maps returned HTTP ${response.statusCode}`,
            'SCRAPER_UPSTREAM_ERROR',
            response.rawText
          );
        }

        assertNotBlocked(response.rawText, response.statusCode);

        const parsed = extractGoogleMapsListings(response.rawText, {
          targetPlaceId: options.targetPlaceId,
          targetName: options.targetName,
        });

        let costUsd: number | undefined;
        const pricePerGb = process.env.PROXY_COST_PER_GB_USD ? parseFloat(process.env.PROXY_COST_PER_GB_USD) : undefined;
        if (typeof pricePerGb === 'number' && !isNaN(pricePerGb) && pricePerGb > 0) {
          costUsd = parseFloat(((response.wireBytes / (1024 * 1024 * 1024)) * pricePerGb).toFixed(6));
        }

        const pinStatus = parsed.items.length > 0 ? 'OK' : 'EMPTY';

        return {
          provider: this.name,
          providerRequestId: `session_${sessionId}${this.lastKnownExitIpHash ? `_exit_${this.lastKnownExitIpHash}` : ''}`,
          parserVersion: parsed.parserVersion || PARSER_VERSION,
          status: parsed.status,
          pinStatus,
          items: parsed.items,
          empty: parsed.items.length === 0,
          rawPayload: { count: parsed.items.length, rawCount: parsed.rawCount, sessionId, exitIpHash: this.lastKnownExitIpHash },
          rawPayloadDebug: parsed.rawPayloadDebug,
          fetchedAt,
          costUsd,
          wireBytes: response.wireBytes,
          decodedBytes: response.decodedBytes,
          contentEncoding: response.contentEncoding,
          latencyMs,
          snappedLat: options.lat,
          snappedLng: options.lng,
          cellId: options.cellId,
          h3Resolution: options.h3Resolution,
        };
      } catch (err: any) {
        if (!isRetry && isLocalClientError(err)) {
          logger.warn(`[GoogleMapsHttpProvider] Encountered local client error (${err.message}), retrying once on fresh dispatcher...`);
          const rec = GoogleMapsHttpProvider.agentPool.get(sessionId);
          if (rec) rec.isRetired = true;
          if (GoogleMapsHttpProvider.currentActiveSessionId === sessionId) {
            GoogleMapsHttpProvider.currentActiveSessionId = null;
          }
          cleanupCurrentLease();
          return await executeFetchWithLease(true);
        }

        if (err.name === 'TimeoutError' || err.code === 'ABORT_ERR' || err.code === 'SCRAPER_TIMEOUT') {
          const timeoutErr: any = new Error(`SCRAPER_TIMEOUT: Request timed out after ${timeoutMs}ms at (${lat}, ${lng})`);
          timeoutErr.code = 'SCRAPER_TIMEOUT';
          throw timeoutErr;
        }

        if (isLocalClientError(err)) {
          const localErr: any = new Error(`LOCAL_CLIENT_ERROR: ${err.message || 'Local client dispatcher error'}`);
          localErr.code = 'LOCAL_CLIENT_ERROR';
          throw localErr;
        }

        throw err;
      } finally {
        cleanupCurrentLease();
      }
    };

    return executeFetchWithLease(false);
  }

  public static async closeAllDispatchers(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [_, pooled] of GoogleMapsHttpProvider.agentPool) {
      promises.push(pooled.agent.close().catch(() => {}));
    }
    await Promise.all(promises);
    GoogleMapsHttpProvider.agentPool.clear();
    GoogleMapsHttpProvider.currentActiveSessionId = null;
  }

  public static async closeDispatcher(): Promise<void> {
    await GoogleMapsHttpProvider.closeAllDispatchers();
  }
}


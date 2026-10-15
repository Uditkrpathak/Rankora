import crypto from 'crypto';
import { redisClient, memoryFallback } from '../../config/redis';
import {
  serpRequestsTotalMetric,
  serpBytesTotalMetric,
  residentialShareRatioMetric,
  serpBlockTotalMetric,
} from '../../monitoring/metrics';

export type ProxyTier = 'datacenter' | 'residential';

export interface GeoTarget {
  city?: string;
  region?: string;
  country?: string;
}

export interface GatewayCandidate {
  rawUrl: string;
  gatewayKey: string;
  tier: ProxyTier;
}

export interface ProxyManagerConfig {
  scraperProxyUrl?: string;
  scraperProxyUrls?: string[];
  scraperSessionTemplate?: string;
  residentialProxyUrl?: string;
  residentialSessionTemplate?: string;
  quarantineThreshold?: number; // default -3
  quarantineTtlSeconds?: number; // default 1800 (30 min)
  scoreTtlSeconds?: number; // default 86400 (24 hours)
  maxScore?: number; // default +10
  costPerGbUsd?: number; // default 1.50
  residentialCostPerGbUsd?: number; // default 3.50
}

export interface ProxyOutcome {
  gatewayKey: string;
  status: 'OK' | 'EMPTY_VALID' | 'BLOCKED' | 'CAPTCHA' | 'TIMEOUT' | 'ERROR_429' | 'ERROR_403' | 'PARSE_ERROR' | 'UPSTREAM_5XX';
  tier: ProxyTier;
  wireBytes?: number;
}

export interface TierShareMetrics {
  datacenterRequests: number;
  residentialRequests: number;
  totalRequests: number;
  residentialShare: number;
  dateBucket: string;
}

export const INDIAN_METRO_NORMALIZATION_MAP: Record<string, string> = {
  bengaluru: 'bangalore',
  bangalore: 'bangalore',
  gurugram: 'gurgaon',
  gurgaon: 'gurgaon',
  kolkata: 'calcutta',
  calcutta: 'calcutta',
  mumbai: 'bombay',
  bombay: 'bombay',
  chennai: 'madras',
  madras: 'madras',
  'new delhi': 'delhi',
  delhi: 'delhi',
  noida: 'noida',
  hyderabad: 'hyderabad',
  pune: 'pune',
  ahmedabad: 'ahmedabad',
  jaipur: 'jaipur',
};

const LUA_SCORE_AND_QUARANTINE = `
local score_key = KEYS[1]
local q_key = KEYS[2]
local delta = tonumber(ARGV[1])
local q_thresh = tonumber(ARGV[2])
local q_ttl = tonumber(ARGV[3])
local score_ttl = tonumber(ARGV[4])
local max_score = tonumber(ARGV[5])

local is_q = redis.call('exists', q_key)
if is_q == 1 then
  return { -999, 1 }
end

local cur = tonumber(redis.call('get', score_key) or 0)
local next_score = cur + delta
if next_score > max_score then
  next_score = max_score
end

if next_score <= q_thresh then
  redis.call('set', q_key, 1, 'EX', q_ttl)
  redis.call('set', score_key, 0, 'EX', score_ttl)
  return { 0, 1 }
else
  redis.call('set', score_key, next_score, 'EX', score_ttl)
  return { next_score, 0 }
end
`;

export function maskProxyUrl(rawUrl?: string): string {
  if (!rawUrl) return 'none/direct';
  try {
    const u = new URL(rawUrl);
    const host = u.host;
    if (u.username || u.password) {
      return `${u.protocol}//***:***@${host}`;
    }
    return `${u.protocol}//${host}`;
  } catch {
    return 'configured (masked)';
  }
}

export class ProxyManager {
  private static instance: ProxyManager | null = null;
  private static residentialUnsetWarned = false;

  private readonly quarantineThreshold: number;
  private readonly quarantineTtlSeconds: number;
  private readonly scoreTtlSeconds: number;
  private readonly maxScore: number;

  private inMemoryScores: Map<string, { score: number; exp: number }> = new Map();
  private inMemoryQuarantines: Map<string, number> = new Map(); // gatewayKey -> expireTimestampMs
  private inMemoryTierStats: Map<string, { reqs: number; bytes: number }> = new Map();
  public redisDownFallbackCount = 0;
  public geoFallbackCount = 0;

  constructor(private readonly config: ProxyManagerConfig = {}) {
    this.quarantineThreshold = config.quarantineThreshold ?? parseInt(process.env.PROXY_QUARANTINE_THRESHOLD || '-3', 10);
    this.quarantineTtlSeconds = config.quarantineTtlSeconds ?? parseInt(process.env.PROXY_QUARANTINE_TTL_SEC || '1800', 10);
    this.scoreTtlSeconds = config.scoreTtlSeconds ?? parseInt(process.env.PROXY_SCORE_TTL_SEC || '86400', 10);
    this.maxScore = config.maxScore ?? 10;

    const resUrl = config.residentialProxyUrl || process.env.RESIDENTIAL_PROXY_URL;
    if (!resUrl && !ProxyManager.residentialUnsetWarned) {
      ProxyManager.residentialUnsetWarned = true;
      console.warn('[ProxyManager] RESIDENTIAL_PROXY_URL is unset. Operating in 100% datacenter mode. Residential escalation tier disabled.');
    }
  }

  public static getInstance(config?: ProxyManagerConfig): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager(config);
    }
    return ProxyManager.instance;
  }

  public static resetInstance(): void {
    ProxyManager.instance = null;
  }

  /**
   * Normalizes city / metro names for consistent geo-targeting
   */
  public normalizeCityName(cityName?: string): string {
    if (!cityName) return '';
    const clean = cityName.trim().toLowerCase();
    return INDIAN_METRO_NORMALIZATION_MAP[clean] || clean.replace(/[^a-z0-9]/g, '');
  }

  /**
   * Builds candidate gateway list for the requested tier
   */
  public getCandidateGateways(tier: ProxyTier): GatewayCandidate[] {
    const candidates: GatewayCandidate[] = [];

    if (tier === 'datacenter') {
      const urls: string[] = [];
      if (this.config.scraperProxyUrls && this.config.scraperProxyUrls.length > 0) {
        urls.push(...this.config.scraperProxyUrls);
      } else if (this.config.scraperProxyUrl) {
        urls.push(this.config.scraperProxyUrl);
      } else {
        if (process.env.SCRAPER_PROXY_URLS) {
          urls.push(...process.env.SCRAPER_PROXY_URLS.split(',').map((s) => s.trim()).filter(Boolean));
        }
        const singleUrl = process.env.SCRAPER_PROXY_URL?.trim();
        if (singleUrl && !urls.includes(singleUrl)) {
          urls.push(singleUrl);
        }
      }

      const sessionTemplate = this.config.scraperSessionTemplate || (!this.config.scraperProxyUrls && !this.config.scraperProxyUrl ? process.env.PROXY_SESSION_TEMPLATE?.trim() : undefined);
      if (sessionTemplate && !urls.includes(sessionTemplate)) {
        urls.push(sessionTemplate);
      }

      for (const rawUrl of urls) {
        candidates.push({
          rawUrl,
          gatewayKey: this.extractGatewayKey(rawUrl, 'dc'),
          tier: 'datacenter',
        });
      }
    } else if (tier === 'residential') {
      const urls: string[] = [];
      if (this.config.residentialProxyUrl) {
        urls.push(this.config.residentialProxyUrl);
      } else {
        const singleUrl = process.env.RESIDENTIAL_PROXY_URL?.trim();
        if (singleUrl) urls.push(singleUrl);
      }

      const sessionTemplate = this.config.residentialSessionTemplate || (!this.config.residentialProxyUrl ? process.env.RESIDENTIAL_SESSION_TEMPLATE?.trim() : undefined);
      if (sessionTemplate && !urls.includes(sessionTemplate)) {
        urls.push(sessionTemplate);
      }

      for (const rawUrl of urls) {
        candidates.push({
          rawUrl,
          gatewayKey: this.extractGatewayKey(rawUrl, 'res'),
          tier: 'residential',
        });
      }
    }

    return candidates;
  }

  public hasResidential(): boolean {
    return Boolean(
      this.config.residentialProxyUrl ||
      process.env.RESIDENTIAL_PROXY_URL?.trim() ||
      this.config.residentialSessionTemplate ||
      process.env.RESIDENTIAL_SESSION_TEMPLATE?.trim()
    );
  }

  /**
   * Extracts a stable gateway health key (Host + Port + Session/User identifier + Tier prefix)
   * Solves the single-endpoint granularity problem where quarantining one session
   * would inadvertently disable the whole tier.
   *
   * Vendor Capabilities (Webshare):
   * - Webshare Datacenter: Does NOT support session-based stickiness in username on the rotating
   *   backbone (p.webshare.io). To achieve granular quarantine, provide comma-separated individual
   *   IP:port endpoints via SCRAPER_PROXY_URLS.
   * - Webshare Residential: DOES support session-id rotation (e.g. username-session-xxx), allowing
   *   per-session quarantine and targeting.
   */
  public extractGatewayKey(rawUrl: string, prefix: string = 'gw'): string {
    try {
      const u = new URL(rawUrl);
      const host = u.hostname || 'gateway';
      const port = u.port || (u.protocol === 'https:' ? '443' : '80');

      let subIdentifier = '';
      if (u.username) {
        const decodedUser = decodeURIComponent(u.username);
        const match = decodedUser.match(/session[_-]([a-zA-Z0-9]+)/i) || decodedUser.match(/sid[_-]([a-zA-Z0-9]+)/i);
        if (match) {
          subIdentifier = `:${match[1]}`;
        } else if (decodedUser.includes('-') && !decodedUser.startsWith('http')) {
          const parts = decodedUser.split('-');
          subIdentifier = `:${parts[parts.length - 1]}`;
        }
      }
      return `${prefix}:${host}:${port}${subIdentifier}`;
    } catch {
      const safe = rawUrl.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
      return `${prefix}:${safe}`;
    }
  }

  /**
   * Applies Geo template substitution with fallback order: city -> region -> country
   */
  public resolveProxyUrl(rawUrl: string, sessionId: string, geo?: GeoTarget): { url: string; appliedGeoLevel: 'city' | 'region' | 'country' | 'none' } {
    let url = rawUrl.replace(/\$\{SESSION_ID\}|\$SESSION_ID/g, sessionId);

    const country = geo?.country ? geo.country.trim().toLowerCase() : 'in';
    const region = geo?.region ? geo.region.trim().toLowerCase() : '';
    const rawCity = geo?.city ? geo.city.trim().toLowerCase() : '';
    const city = this.normalizeCityName(rawCity);

    let appliedGeoLevel: 'city' | 'region' | 'country' | 'none' = 'none';

    if (url.includes('${CITY}') || url.includes('$CITY')) {
      if (city) {
        url = url.replace(/\$\{CITY\}|\$CITY/g, city);
        appliedGeoLevel = 'city';
      } else if (region) {
        this.geoFallbackCount++;
        console.warn(`[ProxyManager:GeoFallback] City unavailable; falling back to region '${region}' for session ${sessionId}`);
        url = url.replace(/\$\{CITY\}|\$CITY/g, region);
        appliedGeoLevel = 'region';
      } else {
        this.geoFallbackCount++;
        console.warn(`[ProxyManager:GeoFallback] City & region unavailable; falling back to country '${country}' for session ${sessionId}`);
        url = url.replace(/\$\{CITY\}|\$CITY/g, country);
        appliedGeoLevel = 'country';
      }
    }

    if (url.includes('${REGION}') || url.includes('$REGION')) {
      if (region) {
        url = url.replace(/\$\{REGION\}|\$REGION/g, region);
        if (appliedGeoLevel === 'none') appliedGeoLevel = 'region';
      } else {
        this.geoFallbackCount++;
        url = url.replace(/\$\{REGION\}|\$REGION/g, country);
        if (appliedGeoLevel === 'none') appliedGeoLevel = 'country';
      }
    }

    if (url.includes('${COUNTRY}') || url.includes('$COUNTRY')) {
      url = url.replace(/\$\{COUNTRY\}|\$COUNTRY/g, country);
      if (appliedGeoLevel === 'none') appliedGeoLevel = 'country';
    }

    return { url, appliedGeoLevel };
  }

  /**
   * Checks if a gateway is currently quarantined
   */
  public async isQuarantined(gatewayKey: string): Promise<boolean> {
    const qKey = `proxy:quarantine:${gatewayKey}`;
    if (redisClient && redisClient.status === 'ready') {
      try {
        const exists = await redisClient.exists(qKey);
        return exists === 1;
      } catch (err: any) {
        this.logRedisFallback(err);
      }
    }

    const exp = this.inMemoryQuarantines.get(gatewayKey);
    if (exp && exp > Date.now()) {
      return true;
    }
    if (exp && exp <= Date.now()) {
      this.inMemoryQuarantines.delete(gatewayKey);
    }
    return false;
  }

  /**
   * Gets current score for a gateway
   */
  public async getScore(gatewayKey: string): Promise<number> {
    const scoreKey = `proxy:score:${gatewayKey}`;
    if (redisClient && redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(scoreKey);
        return val ? parseInt(val, 10) : 0;
      } catch (err: any) {
        this.logRedisFallback(err);
      }
    }

    const item = this.inMemoryScores.get(gatewayKey);
    if (item && item.exp > Date.now()) {
      return item.score;
    }
    return 0;
  }

  /**
   * Selects the best healthy gateway for the requested tier via weighted score.
   * If ALL gateways of the tier are quarantined, returns null (triggers instant tier escalation).
   */
  public async selectHealthyGateway(tier: ProxyTier, geo?: GeoTarget, customSessionId?: string): Promise<{ proxyUrl: string; gatewayKey: string; tier: ProxyTier } | null> {
    const candidates = this.getCandidateGateways(tier);
    if (candidates.length === 0) {
      return null;
    }

    const healthyCandidates: Array<{ candidate: GatewayCandidate; score: number; weight: number }> = [];

    for (const c of candidates) {
      const quarantined = await this.isQuarantined(c.gatewayKey);
      if (!quarantined) {
        const score = await this.getScore(c.gatewayKey);
        // Weight is non-negative: score from -2 to +10 mapped to weights 1 to 14
        const weight = Math.max(1, score + 4);
        healthyCandidates.push({ candidate: c, score, weight });
      }
    }

    // ALL gateways quarantined in this tier
    if (healthyCandidates.length === 0) {
      console.warn(`[ProxyManager:TierExhausted] All ${candidates.length} gateways in tier '${tier}' are currently QUARANTINED. Escalating tier.`);
      return null;
    }

    // Weighted random selection
    const totalWeight = healthyCandidates.reduce((sum, h) => sum + h.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = healthyCandidates[0].candidate;

    for (const item of healthyCandidates) {
      if (rand < item.weight) {
        selected = item.candidate;
        break;
      }
      rand -= item.weight;
    }

    const sessionId = customSessionId || crypto.randomBytes(6).toString('hex');
    const { url } = this.resolveProxyUrl(selected.rawUrl, sessionId, geo);

    return {
      proxyUrl: url,
      gatewayKey: selected.gatewayKey,
      tier,
    };
  }

  /**
   * Records outcome of request and atomically updates score / quarantine
   */
  public async recordOutcome(outcome: ProxyOutcome): Promise<{ nextScore: number; isQuarantined: boolean }> {
    const { gatewayKey, status, tier, wireBytes } = outcome;
    const scoreKey = `proxy:score:${gatewayKey}`;
    const qKey = `proxy:quarantine:${gatewayKey}`;

    // Record tier bandwidth & request count
    if (wireBytes && wireBytes > 0) {
      await this.recordTierUse(tier, wireBytes);
    }

    // PARSE_ERROR must NOT penalize proxy score
    if (status === 'PARSE_ERROR' || status === 'UPSTREAM_5XX') {
      const currentScore = await this.getScore(gatewayKey);
      const isQ = await this.isQuarantined(gatewayKey);
      return { nextScore: currentScore, isQuarantined: isQ };
    }

    let delta = 0;
    if (status === 'OK' || status === 'EMPTY_VALID') {
      delta = 1;
    } else if (status === 'BLOCKED' || status === 'CAPTCHA' || status === 'TIMEOUT' || status === 'ERROR_429' || status === 'ERROR_403') {
      delta = -1;
      serpBlockTotalMetric.inc({ reason: status });
      const dateBucket = new Date().toISOString().slice(0, 10);
      const blockKey = `spend:tier:block:${status}:${dateBucket}`;
      if (redisClient && redisClient.status === 'ready') {
        redisClient.incr(blockKey).catch(() => {});
        redisClient.expire(blockKey, 172800).catch(() => {});
      }
    }

    if (redisClient && redisClient.status === 'ready') {
      try {
        const result = (await redisClient.eval(
          LUA_SCORE_AND_QUARANTINE,
          2,
          scoreKey,
          qKey,
          delta,
          this.quarantineThreshold,
          this.quarantineTtlSeconds,
          this.scoreTtlSeconds,
          this.maxScore
        )) as [number, number];

        const nextScore = result[0];
        const isQuarantined = result[1] === 1;

        if (isQuarantined && nextScore === 0) {
          console.warn(`[ProxyManager:QuarantineEntered] Gateway '${gatewayKey}' score dropped to ${this.quarantineThreshold}. Quarantined for ${this.quarantineTtlSeconds}s.`);
        }

        return { nextScore, isQuarantined };
      } catch (err: any) {
        this.logRedisFallback(err);
      }
    }

    // In-Memory Fallback
    const currentQExp = this.inMemoryQuarantines.get(gatewayKey);
    if (currentQExp && currentQExp > Date.now()) {
      return { nextScore: -999, isQuarantined: true };
    }

    const currentItem = this.inMemoryScores.get(gatewayKey);
    const currentScore = currentItem && currentItem.exp > Date.now() ? currentItem.score : 0;
    let nextScore = Math.min(this.maxScore, currentScore + delta);

    let isQuarantined = false;
    if (nextScore <= this.quarantineThreshold) {
      isQuarantined = true;
      nextScore = 0;
      this.inMemoryQuarantines.set(gatewayKey, Date.now() + this.quarantineTtlSeconds * 1000);
      this.inMemoryScores.set(gatewayKey, { score: 0, exp: Date.now() + this.scoreTtlSeconds * 1000 });
      console.warn(`[ProxyManager:QuarantineEntered:InMemory] Gateway '${gatewayKey}' quarantined in-memory for ${this.quarantineTtlSeconds}s.`);
    } else {
      this.inMemoryScores.set(gatewayKey, { score: nextScore, exp: Date.now() + this.scoreTtlSeconds * 1000 });
    }

    return { nextScore, isQuarantined };
  }

  /**
   * Records tier usage (requests and wire bytes) for 48h rolling tracking
   */
  public async recordTierUse(tier: ProxyTier, wireBytes: number): Promise<void> {
    const dateBucket = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const reqKey = `spend:tier:${tier}:${dateBucket}:requests`;
    const byteKey = `spend:tier:${tier}:${dateBucket}:bytes`;

    serpRequestsTotalMetric.inc({ tier });
    serpBytesTotalMetric.inc({ tier }, wireBytes);

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.incr(reqKey);
        await redisClient.expire(reqKey, 172800); // 48h
        await redisClient.incrby(byteKey, wireBytes);
        await redisClient.expire(byteKey, 172800);
        return;
      } catch (err: any) {
        this.logRedisFallback(err);
      }
    }

    const current = this.inMemoryTierStats.get(`${tier}:${dateBucket}`) || { reqs: 0, bytes: 0 };
    this.inMemoryTierStats.set(`${tier}:${dateBucket}`, {
      reqs: current.reqs + 1,
      bytes: current.bytes + wireBytes,
    });
  }

  /**
   * Computes the current tier share breakdown (e.g. 70/30 target)
   */
  public async getTierShare(dateBucket?: string): Promise<TierShareMetrics> {
    const bucket = dateBucket || new Date().toISOString().slice(0, 10);
    let dcReqs = 0;
    let resReqs = 0;

    if (redisClient && redisClient.status === 'ready') {
      try {
        const [dc, res] = await Promise.all([
          redisClient.get(`spend:tier:datacenter:${bucket}:requests`),
          redisClient.get(`spend:tier:residential:${bucket}:requests`),
        ]);
        dcReqs = dc ? parseInt(dc, 10) : 0;
        resReqs = res ? parseInt(res, 10) : 0;
      } catch (err: any) {
        this.logRedisFallback(err);
      }
    } else {
      dcReqs = this.inMemoryTierStats.get(`datacenter:${bucket}`)?.reqs || 0;
      resReqs = this.inMemoryTierStats.get(`residential:${bucket}`)?.reqs || 0;
    }

    const totalRequests = dcReqs + resReqs;
    const residentialShare = totalRequests > 0 ? parseFloat((resReqs / totalRequests).toFixed(4)) : 0;
    residentialShareRatioMetric.set(residentialShare);

    return {
      datacenterRequests: dcReqs,
      residentialRequests: resReqs,
      totalRequests,
      residentialShare,
      dateBucket: bucket,
    };
  }

  /**
   * Snapshot of active quarantines for monitoring / Prometheus
   */
  public async getQuarantineSnapshot(): Promise<Array<{ gatewayKey: string; quarantined: boolean; ttlSecondsRemaining: number }>> {
    const candidates = [
      ...this.getCandidateGateways('datacenter'),
      ...this.getCandidateGateways('residential'),
    ];

    const snapshot: Array<{ gatewayKey: string; quarantined: boolean; ttlSecondsRemaining: number }> = [];

    for (const c of candidates) {
      const qKey = `proxy:quarantine:${c.gatewayKey}`;
      let isQ = false;
      let ttl = 0;

      if (redisClient && redisClient.status === 'ready') {
        try {
          const remTtl = await redisClient.ttl(qKey);
          if (remTtl > 0) {
            isQ = true;
            ttl = remTtl;
          }
        } catch {}
      } else {
        const exp = this.inMemoryQuarantines.get(c.gatewayKey);
        if (exp && exp > Date.now()) {
          isQ = true;
          ttl = Math.round((exp - Date.now()) / 1000);
        }
      }

      snapshot.push({
        gatewayKey: c.gatewayKey,
        quarantined: isQ,
        ttlSecondsRemaining: ttl,
      });
    }

    return snapshot;
  }

  private logRedisFallback(err: any): void {
    this.redisDownFallbackCount++;
    console.warn(`[ProxyManager:RedisFallbackActive] Redis unavailable (${err.message}); using in-process proxy state fallback.`);
  }
}

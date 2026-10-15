import { ISERPProvider, SERPOptions, SERPResult } from './serp.types';
import { ProxyManager, ProxyTier, GeoTarget, maskProxyUrl } from './proxy-manager';
import { GoogleMapsHttpProvider } from './google-maps-http.provider';
import { serpCircuitBreaker } from './serp-circuit-breaker';
import { serpBudgetGuard } from './serp-budget-guard';
import { redisClient } from '../../config/redis';

export interface CascadeRoutingConfig {
  proxyManager?: ProxyManager;
  residentialMaxShare?: number; // default 0.30 (30%)
  residentialShareAction?: 'alert' | 'degrade'; // default 'alert'
  residentialDailyByteCap?: number; // default 500 MB (524288000 bytes)
  datacenterCostPerGbUsd?: number; // default 1.50
  residentialCostPerGbUsd?: number; // default 3.50
}

export interface CascadeAttemptRecord {
  tier: ProxyTier;
  gatewayKey?: string;
  statusCode?: number;
  status: string;
  wireBytes?: number;
  latencyMs?: number;
  error?: string;
}

export class CascadeRoutingEngine {
  private readonly proxyManager: ProxyManager;
  private readonly residentialMaxShare: number;
  private readonly residentialShareAction: 'alert' | 'degrade';
  private readonly residentialDailyByteCap: number;
  private readonly datacenterCostPerGbUsd: number;
  private readonly residentialCostPerGbUsd: number;
  private readonly routingMode: string;

  private inMemoryResidentialBytes: Map<string, number> = new Map();

  constructor(
    config: CascadeRoutingConfig = {}
  ) {
    this.proxyManager = config.proxyManager || ProxyManager.getInstance();
    this.residentialMaxShare = config.residentialMaxShare ?? parseFloat(process.env.RESIDENTIAL_MAX_SHARE || '0.30');
    this.residentialShareAction = config.residentialShareAction ?? ((process.env.RESIDENTIAL_SHARE_ACTION as any) || 'degrade');
    this.residentialDailyByteCap = config.residentialDailyByteCap ?? parseInt(process.env.RESIDENTIAL_DAILY_BYTE_CAP || '524288000', 10);
    this.datacenterCostPerGbUsd = config.datacenterCostPerGbUsd ?? parseFloat(process.env.PROXY_COST_PER_GB_USD || '1.50');
    this.residentialCostPerGbUsd = config.residentialCostPerGbUsd ?? parseFloat(process.env.RESIDENTIAL_COST_PER_GB_USD || '3.50');
    this.routingMode = (process.env.PROXY_ROUTING_MODE || 'escalation').toLowerCase();
  }

  /**
   * Checks whether the business has exceeded its daily residential byte limit
   */
  public async checkResidentialByteCap(businessId: string, estimatedBytes: number = 120000): Promise<{ allowed: boolean; consumedBytes: number; capBytes: number }> {
    const dateBucket = new Date().toISOString().slice(0, 10);
    const spendKey = `spend:residential:${businessId}:${dateBucket}`;

    let consumed = 0;
    if (redisClient && redisClient.status === 'ready') {
      try {
        const val = await redisClient.get(spendKey);
        consumed = val ? parseInt(val, 10) : 0;
      } catch {}
    } else {
      consumed = this.inMemoryResidentialBytes.get(`${businessId}:${dateBucket}`) || 0;
    }

    const allowed = consumed + estimatedBytes <= this.residentialDailyByteCap;
    return { allowed, consumedBytes: consumed, capBytes: this.residentialDailyByteCap };
  }

  /**
   * Increments consumed residential bytes for the business
   */
  public async recordResidentialByteConsumption(businessId: string, bytes: number): Promise<void> {
    const dateBucket = new Date().toISOString().slice(0, 10);
    const spendKey = `spend:residential:${businessId}:${dateBucket}`;

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.incrby(spendKey, bytes);
        await redisClient.expire(spendKey, 172800); // 48h
        return;
      } catch {}
    }

    const current = this.inMemoryResidentialBytes.get(`${businessId}:${dateBucket}`) || 0;
    this.inMemoryResidentialBytes.set(`${businessId}:${dateBucket}`, current + bytes);
  }

  /**
   * Main entrypoint: Executes search cascading across Tier 1 (DC) -> Tier 2 (Residential)
   */
  public async searchWithCascade(options: SERPOptions, businessId?: string): Promise<SERPResult> {
    const attempts: CascadeAttemptRecord[] = [];
    const geo: GeoTarget = {
      city: options.city,
      region: options.region,
      country: options.localization?.gl,
    };

    const effectiveBusinessId = businessId || (options as any).workspaceId || 'global';
    const routingMode = (process.env.PROXY_ROUTING_MODE || this.routingMode || 'escalation').toLowerCase();
    const residentialTargetShare = parseFloat(process.env.RESIDENTIAL_TARGET_SHARE || '0.15');

    // In 'weighted' mode (experiments only), randomly route a fraction directly to residential
    const startDirectlyOnResidential = routingMode === 'weighted' && Math.random() < residentialTargetShare;
    let shouldEscalateToResidential = startDirectlyOnResidential;

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. TIER 1: Datacenter HTTP Egress (default escalation mode)
    // ─────────────────────────────────────────────────────────────────────────────
    if (!startDirectlyOnResidential) {
      const dcGateway = await this.proxyManager.selectHealthyGateway('datacenter', geo);

      if (dcGateway) {
        const dcProvider = new GoogleMapsHttpProvider({
          proxyUrl: dcGateway.proxyUrl,
          endpointMode: (process.env.MAPS_ENDPOINT_MODE as any) || 'mobile',
        });

        const start = Date.now();
        try {
          const result = await dcProvider.search(options);
          const latencyMs = Date.now() - start;
          const wireBytes = result.wireBytes || 0;

          await this.proxyManager.recordOutcome({
            gatewayKey: dcGateway.gatewayKey,
            status: result.status === 'EMPTY_VALID' ? 'EMPTY_VALID' : 'OK',
            tier: 'datacenter',
            wireBytes,
          });

          attempts.push({
            tier: 'datacenter',
            gatewayKey: dcGateway.gatewayKey,
            status: result.status || 'OK',
            wireBytes,
            latencyMs,
          });

          const costUsd = parseFloat(((wireBytes / (1024 * 1024 * 1024)) * this.datacenterCostPerGbUsd).toFixed(6));
          return {
            ...result,
            costUsd,
            cascadeTierUsed: 'datacenter',
            cascadeGatewayKey: dcGateway.gatewayKey,
            cascadeAttempts: attempts,
          } as any;
        } catch (err: any) {
          const latencyMs = Date.now() - start;
          const isBlocked = err.code === 'SCRAPER_BLOCKED' || err.code === 'SCRAPER_CAPTCHA';
          const isTimeout = err.code === 'SCRAPER_TIMEOUT';
          const isParseError = err.code === 'SCRAPER_PARSE_ERROR';

          let outcomeStatus: any = 'BLOCKED';
          if (err.code === 'SCRAPER_CAPTCHA') outcomeStatus = 'CAPTCHA';
          else if (isTimeout) outcomeStatus = 'TIMEOUT';
          else if (isParseError) outcomeStatus = 'PARSE_ERROR';

          await this.proxyManager.recordOutcome({
            gatewayKey: dcGateway.gatewayKey,
            status: outcomeStatus,
            tier: 'datacenter',
          });

          attempts.push({
            tier: 'datacenter',
            gatewayKey: dcGateway.gatewayKey,
            status: outcomeStatus,
            latencyMs,
            error: err.message,
          });

          if (isBlocked || isTimeout || err.code === 'SCRAPER_BLOCKED') {
            shouldEscalateToResidential = true;
          } else {
            // If parse error or bad query, do not waste residential proxy
            throw err;
          }
        }
      } else {
        shouldEscalateToResidential = true;
        attempts.push({
          tier: 'datacenter',
          status: 'ALL_GATEWAYS_QUARANTINED',
          error: 'No healthy datacenter gateways available in pool',
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. TIER 2: Residential HTTP Egress (Escalation Guarded)
    // ─────────────────────────────────────────────────────────────────────────────
    if (shouldEscalateToResidential) {
      // Check Residential Share Policy
      const shareMetrics = await this.proxyManager.getTierShare();
      let allowResidential = true;

      // Small sample rule for residential capping:
      // - If totalRequests < 5: allow max 1 residential request.
      // - If totalRequests >= 5: enforce residentialShare > residentialMaxShare.
      const isCapExceeded = shareMetrics.totalRequests < 5
        ? (shareMetrics.residentialRequests >= 1 && (shareMetrics.residentialRequests / Math.max(1, shareMetrics.totalRequests)) > this.residentialMaxShare)
        : (shareMetrics.residentialShare > this.residentialMaxShare);

      if (isCapExceeded) {
        if (this.residentialShareAction === 'degrade') {
          console.warn(`[CascadeRouting:ResidentialDegrade] Residential share (${(shareMetrics.residentialShare * 100).toFixed(1)}%) exceeded max limit (${this.residentialMaxShare * 100}%). Skipping residential tier.`);
          allowResidential = false;
        } else {
          console.warn(`[CascadeRouting:ResidentialAlert] Residential share (${(shareMetrics.residentialShare * 100).toFixed(1)}%) exceeded target (${this.residentialMaxShare * 100}%). Alerting and continuing.`);
        }
      }

      // Check Business Daily Byte Cap
      if (allowResidential) {
        const byteCapCheck = await this.checkResidentialByteCap(effectiveBusinessId);
        if (!byteCapCheck.allowed) {
          console.warn(`[CascadeRouting:ByteCapExceeded] Business '${effectiveBusinessId}' consumed ${(byteCapCheck.consumedBytes / 1024 / 1024).toFixed(1)} MB (Cap: ${(byteCapCheck.capBytes / 1024 / 1024).toFixed(1)} MB). Skipping residential tier.`);
          allowResidential = false;
        }
      }

      if (allowResidential) {
        const resGateway = await this.proxyManager.selectHealthyGateway('residential', geo);

        if (resGateway) {
          const resProvider = new GoogleMapsHttpProvider({
            proxyUrl: resGateway.proxyUrl,
            endpointMode: (process.env.MAPS_ENDPOINT_MODE as any) || 'mobile',
          });

          const start = Date.now();
          try {
            const result = await resProvider.search(options);
            const latencyMs = Date.now() - start;
            const wireBytes = result.wireBytes || 0;

            await this.proxyManager.recordOutcome({
              gatewayKey: resGateway.gatewayKey,
              status: result.status === 'EMPTY_VALID' ? 'EMPTY_VALID' : 'OK',
              tier: 'residential',
              wireBytes,
            });

            await this.recordResidentialByteConsumption(effectiveBusinessId, wireBytes);

            attempts.push({
              tier: 'residential',
              gatewayKey: resGateway.gatewayKey,
              status: result.status || 'OK',
              wireBytes,
              latencyMs,
            });

            const costUsd = parseFloat(((wireBytes / (1024 * 1024 * 1024)) * this.residentialCostPerGbUsd).toFixed(6));
            return {
              ...result,
              costUsd,
              cascadeTierUsed: 'residential',
              cascadeGatewayKey: resGateway.gatewayKey,
              cascadeAttempts: attempts,
            } as any;
          } catch (err: any) {
            const latencyMs = Date.now() - start;
            let outcomeStatus: any = 'BLOCKED';
            if (err.code === 'SCRAPER_CAPTCHA') outcomeStatus = 'CAPTCHA';
            else if (err.code === 'SCRAPER_TIMEOUT') outcomeStatus = 'TIMEOUT';
            else if (err.code === 'SCRAPER_PARSE_ERROR') outcomeStatus = 'PARSE_ERROR';

            await this.proxyManager.recordOutcome({
              gatewayKey: resGateway.gatewayKey,
              status: outcomeStatus,
              tier: 'residential',
            });

            attempts.push({
              tier: 'residential',
              gatewayKey: resGateway.gatewayKey,
              status: outcomeStatus,
              latencyMs,
              error: err.message,
            });
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Both Scraper Tiers Exhausted -> Throw SCRAPER_ALL_TIERS_FAILED
    // (Per spec: scan marked "temporarily unavailable, retry later", credits refunded, worker never crashes)
    // ─────────────────────────────────────────────────────────────────────────────
    const error = new Error(`SCRAPER_ALL_TIERS_FAILED: Both datacenter and residential scraping tiers failed or are unavailable. Attempts: ${JSON.stringify(attempts)}`);
    (error as any).code = 'SCRAPER_ALL_TIERS_FAILED';
    (error as any).attempts = attempts;
    throw error;
  }
}

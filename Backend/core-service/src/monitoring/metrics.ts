import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// Collect Node.js process and runtime default metrics (prefix: localo_)
collectDefaultMetrics({ register, prefix: 'localo_' });

// ----------------------------------------------------------------------------
// 1. SERP Egress & Scraper Telemetry
// ----------------------------------------------------------------------------
export const serpRequestsTotalMetric = new Counter({
  name: 'serp_requests_total',
  help: 'Total number of SERP requests by tier',
  labelNames: ['tier'] as const,
  registers: [register],
});

export const serpBytesTotalMetric = new Counter({
  name: 'serp_bytes_total',
  help: 'Total bytes transferred by tier',
  labelNames: ['tier'] as const,
  registers: [register],
});

export const residentialShareRatioMetric = new Gauge({
  name: 'residential_share_ratio',
  help: 'Realized residential proxy share ratio (0.0 - 1.0)',
  registers: [register],
});

export const serpBlockTotalMetric = new Counter({
  name: 'serp_block_total',
  help: 'Total number of SERP blocks / CAPTCHA / rate limits by reason',
  labelNames: ['reason'] as const,
  registers: [register],
});

export const serpParseFailuresTotal = new Counter({
  name: 'serp_parse_failures_total',
  help: 'Total number of SERP response parsing failures by reason',
  labelNames: ['reason'] as const,
  registers: [register],
});

export const serpCardsSkippedTotal = new Counter({
  name: 'serp_cards_skipped_total',
  help: 'Total number of unparseable or malformed place cards skipped during SERP extraction',
  registers: [register],
});


export const serpRequestsTotal = new Counter({
  name: 'localo_serp_requests_total',
  help: 'Total number of SERP requests executed across all providers and tiers',
  labelNames: ['provider', 'tier', 'status', 'error_code'] as const,
  registers: [register],
});

export const serpRequestDuration = new Histogram({
  name: 'localo_serp_request_duration_seconds',
  help: 'Latency distribution of outbound SERP requests in seconds',
  labelNames: ['provider', 'tier'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 45],
  registers: [register],
});

export const serpEgressBytesTotal = new Counter({
  name: 'localo_serp_egress_bytes_total',
  help: 'Total bytes transferred outbound to SERP gateways',
  labelNames: ['provider', 'tier'] as const,
  registers: [register],
});

// ----------------------------------------------------------------------------
// 2. Proxy Fleet Health & Quarantine Telemetry
// ----------------------------------------------------------------------------
export const proxyHealthScore = new Gauge({
  name: 'localo_proxy_health_score',
  help: 'Current health score of individual proxy gateways (-3 to +10)',
  labelNames: ['gateway', 'tier'] as const,
  registers: [register],
});

export const proxyQuarantineEventsTotal = new Counter({
  name: 'localo_proxy_quarantine_events_total',
  help: 'Count of proxy quarantine triggers by tier and reason',
  labelNames: ['tier', 'reason'] as const,
  registers: [register],
});

export const proxyActiveCount = new Gauge({
  name: 'localo_proxy_active_count',
  help: 'Number of active vs quarantined proxy gateways per tier',
  labelNames: ['tier', 'state'] as const, // state: active | quarantined
  registers: [register],
});

// ----------------------------------------------------------------------------
// 3. Shared Spatial Geo-Cache Telemetry
// ----------------------------------------------------------------------------
export const geoCacheOperationsTotal = new Counter({
  name: 'localo_geocache_operations_total',
  help: 'Total lookups against the spatial geohash cache',
  labelNames: ['provider', 'result'] as const, // result: hit | miss | bypass
  registers: [register],
});

export const geoCacheSavingsBytesTotal = new Counter({
  name: 'localo_geocache_savings_bytes_total',
  help: 'Estimated bandwidth saved via spatial deduplication in bytes',
  registers: [register],
});

// ----------------------------------------------------------------------------
// 4. Split Queues & Job Processing Telemetry
// ----------------------------------------------------------------------------
export const queueDepth = new Gauge({
  name: 'localo_queue_depth',
  help: 'Current number of waiting/active jobs in BullMQ queues',
  labelNames: ['queue_name', 'state'] as const, // state: waiting | active | delayed
  registers: [register],
});

export const scanDurationSeconds = new Histogram({
  name: 'localo_scan_duration_seconds',
  help: 'Total end-to-end execution time for scan batches in seconds',
  labelNames: ['queue_name', 'status'] as const,
  buckets: [1, 2, 5, 10, 20, 30, 60, 120],
  registers: [register],
});

export const creditsChargedTotal = new Counter({
  name: 'localo_credits_charged_total',
  help: 'Total credits charged for completed and partial scans',
  labelNames: ['status'] as const,
  registers: [register],
});

export const creditsRefundedTotal = new Counter({
  name: 'localo_credits_refunded_total',
  help: 'Total credits refunded back to workspaces due to failures or degradation',
  labelNames: ['reason'] as const,
  registers: [register],
});

export const scanDeadLetterTotal = new Counter({
  name: 'scan_dead_letter_total',
  help: 'Total number of scan jobs moved to dead letter queue after retry exhaustion',
  labelNames: ['queue_name', 'reason'] as const,
  registers: [register],
});

export const scanDeadLetterDepth = new Gauge({
  name: 'scan_dead_letter_depth',
  help: 'Current depth of dead letter queue',
  registers: [register],
});

export const queueFailedJobs = new Gauge({
  name: 'queue_failed_jobs_total',
  help: 'Failed jobs count by queue (ondemand, weekly, email, dead-letter)',
  labelNames: ['queue'] as const,
  registers: [register],
});

// ----------------------------------------------------------------------------
// 5. Cost Tracking & Budget Guardrails
// ----------------------------------------------------------------------------
export const dailySpendUsd = new Gauge({
  name: 'localo_daily_spend_usd',
  help: 'Current day cumulative SERP spend in USD by tier',
  labelNames: ['tier'] as const,
  registers: [register],
});

export const dailyBudgetUtilizationRatio = new Gauge({
  name: 'localo_daily_budget_utilization_ratio',
  help: 'Ratio of consumed spend over daily budget limit (0.0 to 1.0+)',
  registers: [register],
});

// ----------------------------------------------------------------------------
// 6. Database & Partitioning Telemetry
// ----------------------------------------------------------------------------
export const postgresPoolConnections = new Gauge({
  name: 'localo_postgres_pool_connections',
  help: 'PostgreSQL connection pool status',
  labelNames: ['pool_type', 'state'] as const, // state: total | idle | waiting
  registers: [register],
});

export const postgresDualReadMismatchesTotal = new Counter({
  name: 'localo_postgres_dual_read_mismatches_total',
  help: 'Count of parity discrepancies detected during dual-read shadow verification',
  labelNames: ['discrepancy_type'] as const,
  registers: [register],
});

export const postgresDefaultPartitionRows = new Gauge({
  name: 'postgres_default_partition_rows',
  help: 'Number of rows currently stored in ranking_history_default partition',
  registers: [register],
});


/**
 * Generates the raw Prometheus text payload.
 */
export async function getPrometheusMetrics(): Promise<string> {
  return register.metrics();
}

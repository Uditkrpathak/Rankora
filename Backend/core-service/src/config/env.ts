import dotenv from 'dotenv';
import path from 'path';

// Load .env if present (check cwd, then core-service directory)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'Backend/core-service/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Config reloaded for Google Client ID sync

const isProd = process.env.NODE_ENV === 'production';

/**
 * Reads an env var. In production, throws immediately if the value is
 * absent or empty so the service never boots on an insecure default.
 * In development, returns the supplied fallback instead.
 */
function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (!value) {
    if (isProd) {
      throw new Error(
        `[env] Missing required environment variable: ${name}. ` +
          'Set it before starting the service in production.'
      );
    }
    return devFallback;
  }
  return value;
}

export interface IEnvConfig {
  readonly isProd: boolean;
  readonly NODE_ENV: string;
  readonly PORT: number;
  readonly MONGO_URI: string;
  readonly REDIS_URL: string;
  readonly JWT_ACCESS_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
  readonly TOKEN_ENCRYPTION_KEY: string;
  readonly KMS_ENCRYPTION_KEY: string;
  readonly RESEND_API_KEY: string;
  readonly RESEND_WEBHOOK_SECRET: string;
  readonly EMAIL_FROM: string;
  readonly FRONTEND_URL: string;
  readonly APP_URL: string;
  readonly AI_PROVIDER: string;
  readonly AI_MODEL: string;
  readonly OPENAI_API_KEY: string;
  readonly AI_TIMEOUT_MS: number;
  readonly AI_INPUT_TOKEN_PRICE_PER_M: number;
  readonly AI_OUTPUT_TOKEN_PRICE_PER_M: number;
  readonly CHAT_LLM_ENABLED: boolean;
  readonly CHAT_QUOTA_FREE: number;
  readonly CHAT_QUOTA_STARTER: number;
  readonly CHAT_QUOTA_PRO: number;
  readonly CHAT_QUOTA_AGENCY: number;
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: string;
  readonly GOOGLE_PLACES_API_KEY: string;
  readonly FEATURE_GBP_ENABLED: boolean;
  readonly GSC_MIN_IMPRESSIONS: number;
  readonly GSC_SYNC_CRON: string;
  readonly ALLOW_DEV_VERIFY_BYPASS: boolean;
  readonly REQUIRE_REDIS: boolean;
  readonly SERP_PROVIDER: string;
  readonly SERP_DAILY_BUDGET_USD: number;
  readonly SERP_COST_PER_POINT_USD: number;
  readonly SERP_REQUEST_TIMEOUT_MS: number;
  readonly POSTGRES_DIRECT_URL: string;
  readonly POSTGRES_POOL_URL: string;
  readonly POSTGRES_POOL_MAX: number;
  readonly RANKING_READ_SOURCE: 'mongo' | 'postgres' | 'dual';
}

export const ENV: IEnvConfig = {
  isProd,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || process.env.CORE_SERVICE_PORT || '5001', 10),


  MONGO_URI:
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    (isProd
      ? (() => {
          throw new Error('[env] Missing required MONGO_URI (or MONGODB_URI)');
        })()
      : 'mongodb://localhost:27017/localseo_core'),
  REDIS_URL: required('REDIS_URL', 'redis://localhost:6379'),

  // Must be strong random values in production — generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  JWT_ACCESS_SECRET: required(
    'JWT_ACCESS_SECRET',
    'localseo-dev-access-secret-32-chars-long!!'
  ),
  JWT_REFRESH_SECRET: required(
    'JWT_REFRESH_SECRET',
    'localseo-dev-refresh-secret-32-chars-long!!'
  ),

  // AES-256-GCM local token encryption key (renamed from KMS_ENCRYPTION_KEY)
  TOKEN_ENCRYPTION_KEY:
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.KMS_ENCRYPTION_KEY ||
    (isProd
      ? (() => {
          throw new Error('[env] Missing required TOKEN_ENCRYPTION_KEY (or KMS_ENCRYPTION_KEY)');
        })()
      : '6c9a2ffa9b3584fdbeb0915ec8eb5d8e702e5311189cf2fe65c665cd034f622a'),
  KMS_ENCRYPTION_KEY:
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.KMS_ENCRYPTION_KEY ||
    '6c9a2ffa9b3584fdbeb0915ec8eb5d8e702e5311189cf2fe65c665cd034f622a',

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || '',
  EMAIL_FROM:
    process.env.EMAIL_FROM || 'Rankora Alerts <onboarding@resend.dev>',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  APP_URL: process.env.APP_URL || 'http://localhost:5000',

  AI_PROVIDER: process.env.AI_PROVIDER || process.env.LLM_PROVIDER || (isProd ? 'openai' : 'stub'),
  AI_MODEL: process.env.AI_MODEL || process.env.LLM_MODEL_FAST || 'gpt-4o-mini',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '',
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '10000', 10),
  AI_INPUT_TOKEN_PRICE_PER_M: parseFloat(process.env.AI_INPUT_TOKEN_PRICE_PER_M || '0.15'),
  AI_OUTPUT_TOKEN_PRICE_PER_M: parseFloat(process.env.AI_OUTPUT_TOKEN_PRICE_PER_M || '0.60'),

  // Chat Copilot Quota and Kill Switch (Phase 5)
  CHAT_LLM_ENABLED: process.env.CHAT_LLM_ENABLED !== 'false',
  CHAT_QUOTA_FREE: parseInt(process.env.CHAT_QUOTA_FREE || '50', 10),
  CHAT_QUOTA_STARTER: parseInt(process.env.CHAT_QUOTA_STARTER || '150', 10),
  CHAT_QUOTA_PRO: parseInt(process.env.CHAT_QUOTA_PRO || '500', 10),
  CHAT_QUOTA_AGENCY: parseInt(process.env.CHAT_QUOTA_AGENCY || '2000', 10),

  // Google OAuth Client ID & Secret & Places API Key
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',

  // Feature Flag for GBP Integration (Rollback safety §11)
  FEATURE_GBP_ENABLED: process.env.FEATURE_GBP_ENABLED !== 'false',

  // Google Search Console (GSC) Configuration
  GSC_MIN_IMPRESSIONS: parseInt(process.env.GSC_MIN_IMPRESSIONS || '50', 10),
  GSC_SYNC_CRON: process.env.GSC_SYNC_CRON || '0 3 * * *',

  // Dev-only instant verification bypass (Strictly prohibited in production)
  ALLOW_DEV_VERIFY_BYPASS: process.env.ALLOW_DEV_VERIFY_BYPASS === 'true',

  // Set REQUIRE_REDIS=true in staging/prod so a missing Redis connection
  // fails loud instead of silently dropping BullMQ jobs.
  REQUIRE_REDIS: process.env.REQUIRE_REDIS === 'true',

  // SERP Scraper Configuration (§Phase 2/3 in-house HTTP scraper)
  SERP_PROVIDER: process.env.SERP_PROVIDER || 'GOOGLE_MAPS_HTTP',
  SERP_DAILY_BUDGET_USD: parseFloat(process.env.SERP_DAILY_BUDGET_USD || '50.00'),
  SERP_COST_PER_POINT_USD: parseFloat(process.env.SERP_COST_PER_POINT_USD || '0.002'),
  SERP_REQUEST_TIMEOUT_MS: parseInt(process.env.SERP_REQUEST_TIMEOUT_MS || '45000', 10),

  // PostgreSQL & PgBouncer Configuration (§Phase 4)
  POSTGRES_DIRECT_URL:
    process.env.POSTGRES_DIRECT_URL ||
    process.env.DATABASE_DIRECT_URL ||
    'postgresql://localo:localo_dev_password@localhost:5432/localo_rankings',
  POSTGRES_POOL_URL:
    process.env.POSTGRES_POOL_URL ||
    process.env.DATABASE_URL ||
    'postgresql://localo:localo_dev_password@localhost:6432/localo_rankings',
  POSTGRES_POOL_MAX: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10),
  RANKING_READ_SOURCE: (process.env.RANKING_READ_SOURCE || 'mongo').toLowerCase() as 'mongo' | 'postgres' | 'dual',
};

// ─── Boot-time production safety assertions ───────────────────────────────────

if (isProd) {
  if (ENV.AI_PROVIDER.toLowerCase() === 'stub') {
    throw new Error('[env] CRITICAL CONFIG ERROR: AI_PROVIDER=stub is forbidden in production.');
  }
  // 1. Dev verification bypass MUST NOT be enabled in production
  if (ENV.ALLOW_DEV_VERIFY_BYPASS || process.env.ALLOW_DEV_VERIFY_BYPASS === 'true') {
    throw new Error(
      '[env] CRITICAL SECURITY CONFIG ERROR: ALLOW_DEV_VERIFY_BYPASS cannot be enabled in production. ' +
        'Unset ALLOW_DEV_VERIFY_BYPASS or set it to false before deploying.'
    );
  }

  // 2. Reject hardcoded dev or placeholder JWT secrets
  const devSecrets = [
    'localseo-dev-access-secret-32-chars-long!!',
    'localseo-dev-refresh-secret-32-chars-long!!',
    'replace_with_random_32_bytes_hex_string',
  ];
  if (
    !ENV.JWT_ACCESS_SECRET ||
    devSecrets.includes(ENV.JWT_ACCESS_SECRET) ||
    ENV.JWT_ACCESS_SECRET.includes('replace_with') ||
    ENV.JWT_ACCESS_SECRET.length < 32
  ) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: JWT_ACCESS_SECRET is missing, default, or insecure (<32 chars) in production.'
    );
  }
  if (
    !ENV.JWT_REFRESH_SECRET ||
    devSecrets.includes(ENV.JWT_REFRESH_SECRET) ||
    ENV.JWT_REFRESH_SECRET.includes('replace_with') ||
    ENV.JWT_REFRESH_SECRET.length < 32
  ) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: JWT_REFRESH_SECRET is missing, default, or insecure (<32 chars) in production.'
    );
  }

  // 3. Reject hardcoded dev or placeholder TOKEN_ENCRYPTION_KEY
  const devEncryptionKeys = [
    '6c9a2ffa9b3584fdbeb0915ec8eb5d8e702e5311189cf2fe65c665cd034f622a',
    'replace_with_random_32_bytes_hex_string',
  ];
  if (
    !ENV.TOKEN_ENCRYPTION_KEY ||
    devEncryptionKeys.includes(ENV.TOKEN_ENCRYPTION_KEY) ||
    ENV.TOKEN_ENCRYPTION_KEY.includes('replace_with') ||
    ENV.TOKEN_ENCRYPTION_KEY.length < 32
  ) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: TOKEN_ENCRYPTION_KEY is missing, default, or insecure in production.'
    );
  }

  // 4. Validate MONGO_URI
  if (!ENV.MONGO_URI || ENV.MONGO_URI.includes('localhost') || ENV.MONGO_URI.includes('127.0.0.1') || ENV.MONGO_URI.includes('<username>')) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: MONGO_URI is missing, placeholder, or points to localhost in production.'
    );
  }

  // 5. Validate REDIS_URL
  if (!ENV.REDIS_URL || ENV.REDIS_URL.includes('replace_with')) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: REDIS_URL is missing or unconfigured in production.'
    );
  }

  // 6. Validate FRONTEND_URL
  if (!ENV.FRONTEND_URL || ENV.FRONTEND_URL.includes('localhost') || ENV.FRONTEND_URL.includes('127.0.0.1')) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: FRONTEND_URL is missing or points to localhost in production.'
    );
  }

  // 7. Validate TRUST_PROXY is explicitly configured
  if (process.env.TRUST_PROXY === undefined || process.env.TRUST_PROXY === '') {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: TRUST_PROXY must be explicitly configured in production (e.g. TRUST_PROXY=1 for Render/ALB or 2 for Cloudflare+Render).'
    );
  }

  // 8. Validate EMAIL_FROM (No sandbox resend.dev in live production)
  if (!ENV.EMAIL_FROM || ENV.EMAIL_FROM.includes('resend.dev') || ENV.EMAIL_FROM.includes('onboarding@')) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: EMAIL_FROM cannot use the Resend sandbox address (onboarding@resend.dev) in production. ' +
      'Verify a custom domain at resend.com/domains and configure EMAIL_FROM=Rankora <notifications@yourdomain.com>.'
    );
  }

  // 9. Queue durable processing
  if (!ENV.REQUIRE_REDIS) {
    throw new Error(
      '[env] REQUIRE_REDIS=true is required in production for durable rank-scan processing.'
    );
  }

  // 10. Validate in-house HTTP scraper proxy configuration
  const scraperProxy = (process.env.SCRAPER_PROXY_URL || process.env.SCRAPER_PROXY_URLS || '').trim();
  if (!scraperProxy) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: SCRAPER_PROXY_URL (or SCRAPER_PROXY_URLS) is required in production for the in-house HTTP scraper.'
    );
  }

  // 11. PostgreSQL production credentials validation (no default dev passwords)
  if (!process.env.POSTGRES_DIRECT_URL && !process.env.DATABASE_DIRECT_URL) {
    throw new Error('[env] Missing required POSTGRES_DIRECT_URL (or DATABASE_DIRECT_URL) in production.');
  }
  if (!process.env.POSTGRES_POOL_URL && !process.env.DATABASE_URL) {
    throw new Error('[env] Missing required POSTGRES_POOL_URL (or DATABASE_URL) in production.');
  }
  if (
    ENV.POSTGRES_DIRECT_URL.includes('localo_dev_password') ||
    ENV.POSTGRES_POOL_URL.includes('localo_dev_password')
  ) {
    throw new Error('[env] Production is using default PostgreSQL dev password. Configure secure credentials.');
  }

  // 12. Proxy cost variables validation in production
  const dcCost = parseFloat(process.env.PROXY_COST_PER_GB_USD || process.env.PROXY_DATACENTER_COST_PER_GB_USD || '');
  if (isNaN(dcCost) || dcCost <= 0) {
    throw new Error('[env] Missing required valid proxy datacenter cost per GB (PROXY_COST_PER_GB_USD or PROXY_DATACENTER_COST_PER_GB_USD) in production.');
  }
  const resCost = parseFloat(process.env.RESIDENTIAL_COST_PER_GB_USD || process.env.PROXY_RESIDENTIAL_COST_PER_GB_USD || '');
  if (isNaN(resCost) || resCost <= 0) {
    throw new Error('[env] Missing required valid proxy residential cost per GB (RESIDENTIAL_COST_PER_GB_USD or PROXY_RESIDENTIAL_COST_PER_GB_USD) in production.');
  }
}


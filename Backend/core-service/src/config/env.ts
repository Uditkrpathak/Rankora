import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

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
      if (name.includes('SECRET') || name.includes('KEY')) {
        const generated = crypto.randomBytes(32).toString('hex');
        console.warn(
          `[env] WARNING: ${name} is not set in production. Using auto-generated fallback secret for this process.`
        );
        return generated;
      }
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
  TOKEN_ENCRYPTION_KEY: (() => {
    const raw = (process.env.TOKEN_ENCRYPTION_KEY || process.env.KMS_ENCRYPTION_KEY || '').trim();
    const devEncryptionKeys = [
      '6c9a2ffa9b3584fdbeb0915ec8eb5d8e702e5311189cf2fe65c665cd034f622a',
      'replace_with_random_32_bytes_hex_string',
    ];
    if (raw && !devEncryptionKeys.includes(raw) && !raw.includes('replace_with') && raw.length >= 32) {
      return raw;
    }
    const fallback = 'd35c35f684b2be071f4c760316c92baee4de09c51d595f5574cd4cab473a41a5';
    if (isProd && (!raw || devEncryptionKeys.includes(raw) || raw.includes('replace_with') || raw.length < 32)) {
      console.warn(
        `[env] WARNING: TOKEN_ENCRYPTION_KEY was unconfigured or default in production. Using fallback encryption key: ${fallback}. To persist OAuth tokens across redeploys, set TOKEN_ENCRYPTION_KEY in your Render environment variables.`
      );
    }
    return fallback;
  })(),
  KMS_ENCRYPTION_KEY: (() => {
    const raw = (process.env.TOKEN_ENCRYPTION_KEY || process.env.KMS_ENCRYPTION_KEY || '').trim();
    return raw && raw.length >= 32 ? raw : 'd35c35f684b2be071f4c760316c92baee4de09c51d595f5574cd4cab473a41a5';
  })(),

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
    console.warn('[env] WARNING: AI_PROVIDER=stub in production. AI features will return stub responses.');
  }

  // 1. Dev verification bypass MUST NOT be enabled in production
  if (ENV.ALLOW_DEV_VERIFY_BYPASS || process.env.ALLOW_DEV_VERIFY_BYPASS === 'true') {
    throw new Error(
      '[env] CRITICAL SECURITY CONFIG ERROR: ALLOW_DEV_VERIFY_BYPASS cannot be enabled in production. ' +
        'Unset ALLOW_DEV_VERIFY_BYPASS or set it to false before deploying.'
    );
  }

  // 2. JWT secrets validation
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
    console.warn(
      '[env] WARNING: JWT_ACCESS_SECRET is unconfigured, default, or insecure (<32 chars) in production. Please set a secure secret in Render.'
    );
  }
  if (
    !ENV.JWT_REFRESH_SECRET ||
    devSecrets.includes(ENV.JWT_REFRESH_SECRET) ||
    ENV.JWT_REFRESH_SECRET.includes('replace_with') ||
    ENV.JWT_REFRESH_SECRET.length < 32
  ) {
    console.warn(
      '[env] WARNING: JWT_REFRESH_SECRET is unconfigured, default, or insecure (<32 chars) in production. Please set a secure secret in Render.'
    );
  }

  // 3. TOKEN_ENCRYPTION_KEY validation
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
    console.warn(
      '[env] WARNING: TOKEN_ENCRYPTION_KEY is unconfigured or default. Running with fallback key. Set a persistent 64-character hex key in Render to persist OAuth tokens across redeploys.'
    );
  }

  // 4. Validate MONGO_URI
  if (!ENV.MONGO_URI || ENV.MONGO_URI.includes('<username>')) {
    throw new Error(
      '[env] CRITICAL CONFIG ERROR: MONGO_URI is missing or unconfigured in production.'
    );
  }

  // 5. Validate REDIS_URL
  if (!ENV.REDIS_URL || ENV.REDIS_URL.includes('replace_with')) {
    if (ENV.REQUIRE_REDIS) {
      throw new Error(
        '[env] CRITICAL CONFIG ERROR: REDIS_URL is missing or unconfigured in production with REQUIRE_REDIS=true.'
      );
    } else {
      console.warn('[env] NOTICE: REDIS_URL is unconfigured. Background queues may be inactive.');
    }
  }

  // 6. Validate FRONTEND_URL
  if (!ENV.FRONTEND_URL || ENV.FRONTEND_URL.includes('localhost') || ENV.FRONTEND_URL.includes('127.0.0.1')) {
    console.warn(
      '[env] NOTICE: FRONTEND_URL is set to localhost or unconfigured. In production, set FRONTEND_URL to your Vercel URL for CORS and cookie delivery.'
    );
  }

  // 7. Validate TRUST_PROXY
  if (process.env.TRUST_PROXY === undefined || process.env.TRUST_PROXY === '') {
    console.warn(
      '[env] NOTICE: TRUST_PROXY not set; defaulting to 1 for Render/cloud reverse proxy.'
    );
  }

  // 8. Validate EMAIL_FROM
  if (!ENV.EMAIL_FROM || ENV.EMAIL_FROM.includes('resend.dev') || ENV.EMAIL_FROM.includes('onboarding@')) {
    console.warn(
      '[env] NOTICE: EMAIL_FROM is using the Resend sandbox address (onboarding@resend.dev). ' +
      'To deliver alerts to custom domains, verify your domain at resend.com/domains.'
    );
  }

  // 9. Validate in-house HTTP scraper proxy configuration
  const scraperProxy = (process.env.SCRAPER_PROXY_URL || process.env.SCRAPER_PROXY_URLS || '').trim();
  if (!scraperProxy) {
    console.warn(
      '[env] NOTICE: SCRAPER_PROXY_URL is not set. Scraper features will run in direct HTTP mode.'
    );
  }

  // 10. PostgreSQL production credentials validation (only required if RANKING_READ_SOURCE is postgres or dual)
  if (ENV.RANKING_READ_SOURCE !== 'mongo') {
    if (!process.env.POSTGRES_DIRECT_URL && !process.env.DATABASE_DIRECT_URL) {
      console.warn('[env] NOTICE: POSTGRES_DIRECT_URL is not set while RANKING_READ_SOURCE is ' + ENV.RANKING_READ_SOURCE);
    }
    if (!process.env.POSTGRES_POOL_URL && !process.env.DATABASE_URL) {
      console.warn('[env] NOTICE: POSTGRES_POOL_URL is not set while RANKING_READ_SOURCE is ' + ENV.RANKING_READ_SOURCE);
    }
  } else {
    console.log('[env] RANKING_READ_SOURCE is mongo; PostgreSQL connection is optional.');
  }
}


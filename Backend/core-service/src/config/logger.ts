import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// Warn at startup only if HTTP_FETCHER is undici in development as a fallback
const isProd = process.env.NODE_ENV === 'production';
const httpFetcher = (process.env.HTTP_FETCHER || (isProd ? 'curl-impersonate' : 'undici')).toLowerCase();
if (httpFetcher === 'undici' && !isProd) {
  logger.warn(
    '[Fetcher Warning] HTTP_FETCHER=undici is in use (dev fallback). OpenSSL TLS client fingerprints differ from real browser signatures. In production, curl-impersonate is the default.'
  );
}

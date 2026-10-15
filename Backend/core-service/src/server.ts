import { mcpRouter } from './modules/mcp/mcp.routes';
import express from 'express';
import path from 'path';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { connectRedis, redisClient } from './config/redis';
import { authRouter } from './modules/auth/auth.routes';
import { workspaceRouter } from './modules/workspaces/workspace.routes';
import { publicRouter } from './modules/public/public.routes';
import { handleResendWebhook } from './modules/webhooks/resend.webhook';
import { placesRouter } from './modules/places/places.routes';
import { placesController } from './modules/places/places.controller';
import { register } from './monitoring/metrics';
import { apiGlobalLimiter } from './middleware/rate-limit.middleware';
import { verifyCsrf } from './middleware/auth.middleware';

const app = express();

// Proxy Topology: parse numeric hop counts correctly (e.g. '2' -> 2, '1' -> 1)
// Use false for unset/0/false, 1 for 'true', Number(raw) for digits, otherwise pass string through
const rawTrustProxy = (process.env.TRUST_PROXY || '').trim().toLowerCase();
if (!rawTrustProxy || rawTrustProxy === '0' || rawTrustProxy === 'false') {
  app.set('trust proxy', false);
} else if (rawTrustProxy === 'true') {
  app.set('trust proxy', 1);
} else if (/^\d+$/.test(rawTrustProxy)) {
  app.set('trust proxy', Number(rawTrustProxy));
} else {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

// Security & Parsing
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(cors({ origin: [ENV.FRONTEND_URL, 'http://localhost:5173'], credentials: true }));
app.use(cookieParser());
app.use(verifyCsrf);
app.use(apiGlobalLimiter);

// Support raw body capture for Svix signature verification on webhook routes
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'core-service',
    timestamp: new Date().toISOString()
  });
});

// Prometheus Metrics Endpoint (Â§Phase 5)
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

// Photo proxy endpoints (handles /v1/places/photo and /api/places/photo)
app.get('/v1/places/photo', (req, res) => placesController.getPhoto(req, res));
app.get('/api/places/photo', (req, res) => placesController.getPhoto(req, res));

// Readiness is separate from liveness so the process can remain alive while
// an orchestrator removes it from traffic during a dependency outage.
app.get('/ready', async (req, res) => {
  let pgHealthy = false;
  try {
    const { checkPostgresHealth } = await import('./database/postgres/postgres.client');
    const pg = await checkPostgresHealth();
    pgHealthy = Boolean(pg.direct || pg.app);
  } catch {
    pgHealthy = false;
  }

  let bullmqHealthy = false;
  try {
    const { getOnDemandScanQueue } = await import('./jobs/scan.queue');
    const q = getOnDemandScanQueue();
    const client = await q.client;
    bullmqHealthy = client.status === 'ready';
  } catch {
    bullmqHealthy = false;
  }

  const dependencies = {
    mongo: mongoose.connection.readyState === 1,
    redis: redisClient.status === 'ready',
    postgres: pgHealthy,
    bullmq: bullmqHealthy,
  };
  const ready = Object.values(dependencies).every(Boolean);
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'core-service',
    dependencies,
    timestamp: new Date().toISOString(),
  });
});

// Mongoose otherwise buffers queries for 10 seconds after a connection drops.
// Return an actionable service error instead of a misleading sign-in failure.
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is unavailable. Please retry when the service is restored.',
      },
    });
    return;
  }
  next();
});

// Webhooks
app.post('/v1/webhooks/resend', handleResendWebhook);

// Serve local uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './docs/openapi';

// Swagger UI & OpenAPI 3.1 Spec Endpoint
app.get('/docs/openapi.json', (req, res) => res.json(openApiSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Routes
app.use('/v1/auth', authRouter);
app.use('/v1/workspaces', workspaceRouter);
app.use('/v1/places', placesRouter);
app.use('/v1/public', publicRouter);
app.use('/v1/mcp', mcpRouter);
app.use('/api/mcp', mcpRouter);

const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email address or password you entered is incorrect.',
  ACCOUNT_TEMPORARILY_LOCKED: 'This account has been temporarily locked due to consecutive failed attempts. Please try again in 5 minutes.',
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists. Please sign in instead.',
  INVALID_GOOGLE_CREDENTIAL: 'Could not verify your Google authentication token. Please try again.',
  GOOGLE_EMAIL_MISSING: 'No email address was provided by your Google account.',
  USER_NOT_FOUND: 'Account not found.',
  USER_DELETED: 'This account has been deleted.',
  USER_SUSPENDED: 'This account is currently suspended. Please contact support.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  SESSION_REVOKED: 'Your session was revoked. Please log in again.',
  INVALID_TOKEN_TYPE: 'Invalid token type.',
  UNAUTHORIZED: 'You must be authenticated to perform this action.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to access this resource.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address to unlock workspace features.',
  INVALID_MFA_CODE: 'Invalid two-factor authentication code or backup code.',
  MFA_CHALLENGE_EXPIRED: 'Two-factor session expired. Please sign in again.',
  INVALID_OR_EXPIRED_TOKEN: 'This verification or confirmation link is invalid or has expired.',
  WORKSPACE_NOT_FOUND: 'Workspace not found.',
  WORKSPACE_UNAVAILABLE: 'This workspace is unavailable or suspended.',
  LOCATION_LIMIT_EXCEEDED: 'You have reached the maximum number of locations on your current plan.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down and try again shortly.',
  INVITE_EXPIRED: 'This invitation link has expired.',
  INVITE_ALREADY_ACCEPTED: 'This invitation has already been accepted.',
  ALREADY_MEMBER: 'You are already a member of this workspace.'
};

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const isZod = err?.name === 'ZodError';
  const statusCode = isZod
    ? 400
    : (err?.statusCode || err?.status || (err?.message === 'EMAIL_ALREADY_EXISTS' ? 409 : 400));
  
  const code = isZod ? 'VALIDATION_ERROR' : (err?.code || (/^[A-Z0-9_]+$/.test(err?.message || '') ? err.message : 'BAD_REQUEST'));
  const rawMessage = isZod ? err.errors?.[0]?.message || 'Validation failed' : (err?.message || 'An error occurred');
  const message = DEFAULT_ERROR_MESSAGES[code] || rawMessage;

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
});

export async function startCoreService() {
  await connectDatabase();
  await connectRedis();

  const server = app.listen(ENV.PORT, () => {
    console.log(`ðŸš€ Core Business Service listening on http://localhost:${ENV.PORT}`);
  });

  function shutdown(signal: string) {
    console.log(`[${signal}] Closing server gracefully...`);
    server.close(async () => {
      await Promise.allSettled([
        disconnectDatabase(),
        redisClient.quit(),
      ]);
      process.exit(0);
    });
    // Force-exit after 5s if connections don't drain â€” prevents tsx watch hang on Windows
    setTimeout(() => {
      console.warn('[shutdown] Forced exit â€” connections did not drain in 5s');
      process.exit(1);
    }, 5_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  startCoreService().catch((err) => {
    console.error('[Core] Startup failed:', err?.message || err);
    process.exitCode = 1;
  });
}

export { app };
// Localo Core Service Server initialized with live Google OAuth 2.0 & GBP Integration
export default app;


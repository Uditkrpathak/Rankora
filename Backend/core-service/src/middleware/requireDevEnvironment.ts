import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

/**
 * Middleware that guards developer-only convenience endpoints.
 *
 * Enforces a 404 (Not Found) rather than 403 (Forbidden) when disabled or in production,
 * ensuring the route is indistinguishable from a non-existent route and avoiding route disclosure.
 */
export function requireDevEnvironment(req: Request, res: Response, next: NextFunction): void {
  // Strict allowlist: Only permit when NODE_ENV is explicitly 'development' AND bypass flag is enabled
  const isDev = (process.env.NODE_ENV || ENV.NODE_ENV) === 'development';
  const isBypassAllowed = Boolean(ENV.ALLOW_DEV_VERIFY_BYPASS);

  if (!isDev || !isBypassAllowed) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' }
    });
    return;
  }
  next();
}

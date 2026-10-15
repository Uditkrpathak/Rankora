import { Response, NextFunction } from 'express';
import { PlatformRole } from '@localo/types';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Rejects requests from suspended users on authenticated endpoints.
 */
export function blockSuspended(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user && req.user.status === 'SUSPENDED') {
    res.status(403).json({
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.'
      }
    });
    return;
  }
  next();
}

/**
 * Enforces temporary password change: blocks everything except change-password, me, and logout
 * when user.mustChangePassword is true.
 */
export function requirePasswordChanged(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user && req.user.mustChangePassword) {
    const url = (req.originalUrl || req.baseUrl + req.path || '').toLowerCase();
    const isAllowed =
      url.includes('change-password') ||
      url.includes('/me') ||
      url.includes('/logout') ||
      url.endsWith('/auth/me');

    if (!isAllowed) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your temporary password before accessing the platform.'
        }
      });
      return;
    }
  }
  next();
}

/**
 * Guards routes based on platform-level role (SUPER_ADMIN, ADMIN, USER).
 */
export function requireRole(...roles: PlatformRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const userRole = (req.user.platformRole as PlatformRole) || 'USER';
    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient platform role permissions'
        }
      });
      return;
    }

    next();
  };
}

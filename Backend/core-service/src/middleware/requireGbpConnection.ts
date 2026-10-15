import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Enforces that a workspace has an active, connected Google Business Profile
 * Rejects requests with 403 GBP_NOT_CONNECTED if connection has not been completed.
 */
export function requireGbpConnection(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const workspace = req.workspace;
  if (!workspace || (workspace as any).gbpConnectionStatus !== 'connected') {
    res.status(403).json({
      success: false,
      error: {
        code: 'GBP_NOT_CONNECTED',
        message: 'This action requires an active Google Business Profile connection. Please connect your Google account.',
      },
    });
    return;
  }
  next();
}

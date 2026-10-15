import { Router } from 'express';
import { googleController } from './google.controller';
import {
  authenticate,
  resolveTenant,
  requirePermission,
} from '../../middleware/auth.middleware';
import { requireGbpConnection } from '../../middleware/requireGbpConnection';

export const googleRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * All google integration routes are nested under /v1/workspaces/:id/google
 */
googleRouter.get(
  '/auth-url',
  authenticate,
  resolveTenant,
  requirePermission('google.connect'),
  asyncHandler((req: any, res: any) => googleController.getAuthUrl(req, res))
);

googleRouter.post(
  '/callback',
  authenticate,
  resolveTenant,
  requirePermission('google.connect'),
  asyncHandler((req: any, res: any) => googleController.handleCallback(req, res))
);

googleRouter.get(
  '/status',
  authenticate,
  resolveTenant,
  asyncHandler((req: any, res: any) => googleController.getStatus(req, res))
);

googleRouter.get(
  '/accounts',
  authenticate,
  resolveTenant,
  requirePermission('google.connect'),
  asyncHandler((req: any, res: any) => googleController.getAccounts(req, res))
);

googleRouter.delete(
  '/disconnect',
  authenticate,
  resolveTenant,
  requirePermission('google.connect'),
  asyncHandler((req: any, res: any) => googleController.disconnect(req, res))
);

googleRouter.get(
  '/discovered-locations',
  authenticate,
  resolveTenant,
  requirePermission('google.connect'),
  requireGbpConnection,
  asyncHandler((req: any, res: any) => googleController.getDiscoveredLocations(req, res))
);

googleRouter.post(
  '/import',
  authenticate,
  resolveTenant,
  requirePermission('location.create'),
  requireGbpConnection,
  asyncHandler((req: any, res: any) => googleController.importLocation(req, res))
);

googleRouter.post(
  '/accounts/batch-import',
  authenticate,
  resolveTenant,
  requirePermission('location.create'),
  requireGbpConnection,
  asyncHandler((req: any, res: any) => googleController.batchImport(req, res))
);

googleRouter.post(
  '/batch-import',
  authenticate,
  resolveTenant,
  requirePermission('location.create'),
  requireGbpConnection,
  asyncHandler((req: any, res: any) => googleController.batchImport(req, res))
);

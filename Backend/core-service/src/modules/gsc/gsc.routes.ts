import { Router } from 'express';
import { gscController } from './gsc.controller';
import { authenticate, resolveTenant, requirePermission } from '../../middleware/auth.middleware';

export const gscRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All GSC routes are tenant-isolated under /v1/workspaces/:id/gsc
gscRouter.use(authenticate);
gscRouter.use(resolveTenant);

/**
 * List verified Google Search Console properties
 * GET /v1/workspaces/:id/gsc/sites
 */
gscRouter.get(
  '/sites',
  requirePermission('google.connect'),
  asyncHandler((req: any, res: any) => gscController.listSites(req, res))
);

/**
 * Connect a GSC property to a location and trigger initial sync
 * POST /v1/workspaces/:id/gsc/locations/:locId/connect
 */
gscRouter.post(
  '/locations/:locId/connect',
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => gscController.connectSite(req, res))
);

/**
 * Retrieve daily performance (clicks, impressions, CTR, averagePosition)
 * GET /v1/workspaces/:id/gsc/locations/:locId/performance?range=28d|90d
 */
gscRouter.get(
  '/locations/:locId/performance',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => gscController.getPerformance(req, res))
);

/**
 * Retrieve high-opportunity queries (discovered and striking distance)
 * GET /v1/workspaces/:id/gsc/locations/:locId/top-queries
 */
gscRouter.get(
  '/locations/:locId/top-queries',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => gscController.getTopQueries(req, res))
);

/**
 * Retrieve GSC metrics for all tracked keywords
 * GET /v1/workspaces/:id/gsc/locations/:locId/keyword-metrics
 */
gscRouter.get(
  '/locations/:locId/keyword-metrics',
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => gscController.getKeywordMetrics(req, res))
);

/**
 * Trigger manual re-sync (rate-limited per location)
 * POST /v1/workspaces/:id/gsc/locations/:locId/sync
 */
gscRouter.post(
  '/locations/:locId/sync',
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => gscController.manualSync(req, res))
);

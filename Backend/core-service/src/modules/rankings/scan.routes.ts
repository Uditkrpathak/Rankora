import { Router } from 'express';
import { scanController } from './scan.controller';
import { authenticate, resolveTenant, requirePermission, requireVerifiedEmail } from '../../middleware/auth.middleware';

export const scanRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Mounts under /v1/workspaces/:id
// Location-scoped routes
scanRouter.post(
  '/locations/:locId/scans',
  authenticate,
  requireVerifiedEmail,
  resolveTenant,
  requirePermission('geo_scan.run'),
  asyncHandler((req: any, res: any) => scanController.triggerLocationScan(req, res))
);

scanRouter.get(
  '/locations/:locId/scans',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.view'),
  asyncHandler((req: any, res: any) => scanController.listLocationScans(req, res))
);

// Workspace direct scan routes
scanRouter.get(
  '/scans/config',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.view'),
  asyncHandler((req: any, res: any) => scanController.getScanConfig(req, res))
);

scanRouter.get(
  '/scans/:scanId',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.view'),
  asyncHandler((req: any, res: any) => scanController.getScan(req, res))
);

scanRouter.get(
  '/scans/:scanId/stream',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.view'),
  asyncHandler((req: any, res: any) => scanController.streamScanEvents(req, res))
);

scanRouter.get(
  '/locations/:locId/scans/history',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.view'),
  asyncHandler((req: any, res: any) => scanController.getLocationScanHistory(req, res))
);

scanRouter.post(
  '/locations/:locId/scans/:scanId/share',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.run'),
  asyncHandler((req: any, res: any) => scanController.shareScan(req, res))
);

scanRouter.post(
  '/scans/:scanId/share',
  authenticate,
  resolveTenant,
  requirePermission('geo_scan.run'),
  asyncHandler((req: any, res: any) => scanController.shareScan(req, res))
);

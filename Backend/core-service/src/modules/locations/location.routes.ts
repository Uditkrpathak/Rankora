import { Router } from 'express';
import { locationController } from './location.controller';
import {
  authenticate,
  resolveTenant,
  requirePermission,
  requireVerifiedEmail,
} from '../../middleware/auth.middleware';
import { requireWithinLimit } from '../../middleware/plan.middleware';

export const locationRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * All location routes are nested under /v1/workspaces/:id/locations
 */
locationRouter.post(
  '/',
  authenticate,
  requireVerifiedEmail,
  resolveTenant,
  requirePermission('location.create'),
  requireWithinLimit('locations'),
  asyncHandler((req: any, res: any) => locationController.createLocation(req, res))
);

locationRouter.get(
  '/',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => locationController.listLocations(req, res))
);

locationRouter.get(
  '/overview',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => locationController.getOverview(req, res))
);

locationRouter.get(
  '/workspace-metrics',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => locationController.getWorkspaceDashboardMetrics(req, res))
);

locationRouter.get(
  '/:locId/dashboard',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => locationController.getSingleLocationDashboard(req, res))
);

locationRouter.patch(
  '/:locId/optimization',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => locationController.toggleOptimization(req, res))
);

locationRouter.patch(
  '/:locId/pin',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => locationController.togglePin(req, res))
);

locationRouter.get(
  '/:locId',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => locationController.getLocation(req, res))
);

locationRouter.patch(
  '/:locId',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => locationController.updateLocation(req, res))
);

locationRouter.delete(
  '/:locId',
  authenticate,
  resolveTenant,
  requirePermission('location.delete'),
  asyncHandler((req: any, res: any) => locationController.deleteLocation(req, res))
);

locationRouter.post(
  '/:locId/sync',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler(async (req: any, res: any) => {
    const { googleController } = await import('../google/google.controller');
    return googleController.syncLocation(req, res);
  })
);

locationRouter.post(
  '/:locId/ai/description-draft',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler(async (req: any, res: any, next: any) => {
    const { aiController } = await import('../ai/ai.controller');
    return aiController.generateDescriptionDraft(req, res, next);
  })
);

import { Router } from 'express';
import { competitorController } from './competitor.controller';
import { authenticate, resolveTenant, requirePermission } from '../../middleware/auth.middleware';

export const competitorRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Mounts under /v1/workspaces/:id
competitorRouter.get(
  '/locations/:locId/competitors',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => competitorController.listCompetitors(req, res))
);

competitorRouter.get(
  '/locations/:locId/competitors/benchmark',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => competitorController.getBenchmark(req, res))
);

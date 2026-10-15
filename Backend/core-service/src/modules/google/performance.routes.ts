import { Router } from 'express';
import { authenticate, requirePermission, resolveTenant } from '../../middleware/auth.middleware';
import { performanceController } from './performance.controller';

export const performanceRouter = Router({ mergeParams: true });
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

performanceRouter.get(
  '/locations/:locId/performance',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => performanceController.getHistory(req, res))
);

performanceRouter.post(
  '/locations/:locId/performance/refresh',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => performanceController.refresh(req, res))
);

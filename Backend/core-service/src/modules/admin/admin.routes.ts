import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { blockSuspended, requirePasswordChanged, requireRole } from '../../middleware/platform.middleware';

export const adminRouter = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All admin routes require authentication, unsuspended status, completed password setup,
// and ADMIN or SUPER_ADMIN platform role.
adminRouter.use(authenticate);
adminRouter.use(blockSuspended);
adminRouter.use(requirePasswordChanged);
adminRouter.use(requireRole('ADMIN', 'SUPER_ADMIN'));

adminRouter.get('/users', asyncHandler((req: any, res: any) => adminController.listUsers(req, res)));
adminRouter.get('/users/:id', asyncHandler((req: any, res: any) => adminController.getUserDetail(req, res)));
adminRouter.patch('/users/:id/limits', asyncHandler((req: any, res: any) => adminController.updateLimits(req, res)));
adminRouter.patch('/users/:id/permissions', asyncHandler((req: any, res: any) => adminController.updatePermissions(req, res)));
adminRouter.patch('/users/:id/plan', asyncHandler((req: any, res: any) => adminController.updatePlan(req, res)));
adminRouter.patch('/users/:id/status', asyncHandler((req: any, res: any) => adminController.updateStatus(req, res)));
adminRouter.post('/users/:id/reset-usage', asyncHandler((req: any, res: any) => adminController.resetUsage(req, res)));
adminRouter.post('/users/:id/verify-email', asyncHandler((req: any, res: any) => adminController.manuallyVerifyEmail(req, res)));
adminRouter.get('/stats', asyncHandler((req: any, res: any) => adminController.getStats(req, res)));

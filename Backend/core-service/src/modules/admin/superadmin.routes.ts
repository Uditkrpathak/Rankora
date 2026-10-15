import { Router } from 'express';
import { superAdminController } from './superadmin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { blockSuspended, requirePasswordChanged, requireRole } from '../../middleware/platform.middleware';

export const superadminRouter = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All superadmin routes strictly require SUPER_ADMIN role
superadminRouter.use(authenticate);
superadminRouter.use(blockSuspended);
superadminRouter.use(requirePasswordChanged);
superadminRouter.use(requireRole('SUPER_ADMIN'));

superadminRouter.post('/admins', asyncHandler((req: any, res: any) => superAdminController.createAdmin(req, res)));
superadminRouter.get('/admins', asyncHandler((req: any, res: any) => superAdminController.listAdmins(req, res)));
superadminRouter.patch('/admins/:id', asyncHandler((req: any, res: any) => superAdminController.updateAdmin(req, res)));
superadminRouter.delete('/admins/:id', asyncHandler((req: any, res: any) => superAdminController.deleteAdmin(req, res)));
superadminRouter.get('/admins/:id/activity', asyncHandler((req: any, res: any) => superAdminController.getAdminActivity(req, res)));
superadminRouter.get('/overview', asyncHandler((req: any, res: any) => superAdminController.getOverview(req, res)));
superadminRouter.get('/audit-log', asyncHandler((req: any, res: any) => superAdminController.getAuditLog(req, res)));

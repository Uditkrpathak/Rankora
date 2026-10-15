import { Router } from 'express';
import { auditController } from './audit.controller';
import { authenticate, resolveTenant, requirePermission } from '../../middleware/auth.middleware';

export const auditRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Mounts under /v1/workspaces/:id
// Location-scoped routes
auditRouter.post(
  '/locations/:locId/audits',
  authenticate,
  resolveTenant,
  requirePermission('audit.run'),
  asyncHandler((req: any, res: any) => auditController.runLocationAudit(req, res))
);

auditRouter.get(
  '/locations/:locId/audits',
  authenticate,
  resolveTenant,
  requirePermission('audit.view'),
  asyncHandler((req: any, res: any) => auditController.listLocationAudits(req, res))
);

auditRouter.get(
  '/locations/:locId/audit-tasks',
  authenticate,
  resolveTenant,
  requirePermission('audit.view'),
  asyncHandler((req: any, res: any) => auditController.listLocationTasks(req, res))
);

auditRouter.patch(
  '/locations/:locId/audit-schedule',
  authenticate,
  resolveTenant,
  requirePermission('audit.run'),
  asyncHandler((req: any, res: any) => auditController.setLocationAuditSchedule(req, res))
);

auditRouter.patch(
  '/audit-tasks/:taskId',
  authenticate,
  resolveTenant,
  requirePermission('audit.run'),
  asyncHandler((req: any, res: any) => auditController.updateTaskStatus(req, res))
);

// Specific audit & recalculation
auditRouter.get(
  '/audits/:auditId',
  authenticate,
  resolveTenant,
  requirePermission('audit.view'),
  asyncHandler((req: any, res: any) => auditController.getAudit(req, res))
);

auditRouter.post(
  '/locations/:locId/audits/:auditId/recalculate',
  authenticate,
  resolveTenant,
  requirePermission('audit.run'),
  asyncHandler((req: any, res: any) => auditController.recalculateAudit(req, res))
);

import { Router } from 'express';
import { workspaceController } from './workspace.controller';
import { authenticate, resolveTenant, requirePermission, requireVerifiedEmail } from '../../middleware/auth.middleware';
import { locationRouter } from '../locations/location.routes';
import { googleRouter } from '../google/google.routes';
import { placesRouter } from '../places/places.routes';
import { scanRouter } from '../rankings/scan.routes';
import { auditRouter } from '../audits/audit.routes';
import { reviewRouter } from '../reviews/review.routes';
import { performanceRouter } from '../google/performance.routes';
import { competitorRouter } from '../competitors/competitor.routes';
import { keywordsRouter } from '../keywords/keywords.routes';
import aiRouter from '../ai/ai.routes';
import protectionRouter from '../protection/protection.routes';
import { gscRouter } from '../gsc/gsc.routes';
import { chatRouter } from '../chat/chat.routes';
import { notificationRouter } from '../notifications/notification.routes';

import { blockSuspended, requirePasswordChanged } from '../../middleware/platform.middleware';

export const workspaceRouter = Router();

workspaceRouter.use(blockSuspended);
workspaceRouter.use(requirePasswordChanged);

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Base workspace routes
workspaceRouter.get('/', authenticate, asyncHandler((req: any, res: any) => workspaceController.listWorkspaces(req, res)));
workspaceRouter.post('/', authenticate, requireVerifiedEmail, asyncHandler((req: any, res: any) => workspaceController.createWorkspace(req, res)));
workspaceRouter.post('/accept-invite', authenticate, requireVerifiedEmail, asyncHandler((req: any, res: any) => workspaceController.acceptInvite(req, res)));

// Specific workspace routes
workspaceRouter.get('/:id', authenticate, asyncHandler((req: any, res: any) => workspaceController.getWorkspace(req, res)));
workspaceRouter.patch('/:id', authenticate, resolveTenant, requirePermission('workspace.update'), asyncHandler((req: any, res: any) =>
  workspaceController.updateWorkspace(req, res)
));
workspaceRouter.get('/:id/members', authenticate, resolveTenant, requirePermission('member.view'), asyncHandler((req: any, res: any) =>
  workspaceController.listMembers(req, res)
));
workspaceRouter.post('/:id/invites', authenticate, requireVerifiedEmail, resolveTenant, requirePermission('member.invite'), asyncHandler((req: any, res: any) =>
  workspaceController.inviteMember(req, res)
));
workspaceRouter.delete('/:id/invites/:inviteId', authenticate, resolveTenant, requirePermission('member.invite'), asyncHandler((req: any, res: any) =>
  workspaceController.revokeInvite(req, res)
));
workspaceRouter.patch('/:id/members/:userId', authenticate, resolveTenant, requirePermission('member.changeRole'), asyncHandler((req: any, res: any) =>
  workspaceController.changeMemberRole(req, res)
));
workspaceRouter.delete('/:id/members/:userId', authenticate, resolveTenant, requirePermission('member.remove'), asyncHandler((req: any, res: any) =>
  workspaceController.removeMember(req, res)
));
workspaceRouter.delete('/:id', authenticate, resolveTenant, requirePermission('workspace.delete'), asyncHandler((req: any, res: any) =>
  workspaceController.scheduleDeletion(req, res)
));
workspaceRouter.post('/:id/cancel-deletion', authenticate, resolveTenant, requirePermission('workspace.delete'), asyncHandler((req: any, res: any) =>
  workspaceController.cancelDeletion(req, res)
));

// Sub-resources mounted with workspace ID param propagation
workspaceRouter.use('/:id/locations', locationRouter);
workspaceRouter.use('/:id', aiRouter);
workspaceRouter.use('/:id/google', googleRouter);
workspaceRouter.use('/:id/places', placesRouter);
workspaceRouter.use('/:id', scanRouter);
workspaceRouter.use('/:id', auditRouter);
workspaceRouter.use('/:id', reviewRouter);
workspaceRouter.use('/:id', performanceRouter);
workspaceRouter.use('/:id', competitorRouter);
workspaceRouter.use('/:id', keywordsRouter);
workspaceRouter.use('/:id', protectionRouter);
workspaceRouter.use('/:id/gsc', gscRouter);
workspaceRouter.use('/:id', chatRouter);
workspaceRouter.use('/:id/notifications', notificationRouter);

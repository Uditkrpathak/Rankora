import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate, resolveTenant } from '../../middleware/auth.middleware';

export const notificationRouter = Router({ mergeParams: true });

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All routes require authentication and tenant resolution for the workspace
notificationRouter.use(authenticate, resolveTenant);

notificationRouter.get('/', asyncHandler((req: any, res: any) => notificationController.list(req, res)));
notificationRouter.get('/unread-count', asyncHandler((req: any, res: any) => notificationController.unreadCount(req, res)));
notificationRouter.patch('/:notificationId/read', asyncHandler((req: any, res: any) => notificationController.markRead(req, res)));
notificationRouter.post('/read-all', asyncHandler((req: any, res: any) => notificationController.markAllRead(req, res)));
notificationRouter.delete('/:notificationId', asyncHandler((req: any, res: any) => notificationController.delete(req, res)));

notificationRouter.get('/stream', (req: any, res: any) => notificationController.stream(req, res));
notificationRouter.get('/preferences', asyncHandler((req: any, res: any) => notificationController.getPreferences(req, res)));
notificationRouter.put('/preferences', asyncHandler((req: any, res: any) => notificationController.updatePreferences(req, res)));
notificationRouter.post('/test', asyncHandler((req: any, res: any) => notificationController.sendTest(req, res)));

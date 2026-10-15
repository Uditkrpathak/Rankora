import { Router } from 'express';
import { authenticate, requirePermission, resolveTenant } from '../../middleware/auth.middleware';
import { chatController } from './chat.controller';
import { validateLocationInWorkspace } from './chat.middleware';
import { chatRateLimiter } from './chat.ratelimit';

export const chatRouter = Router({ mergeParams: true });
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * POST /v1/workspaces/:id/locations/:locId/chat
 * Send a prompt or question to the business AI chatbot
 * Pipeline:
 * 1. authenticate (validates JWT and active session)
 * 2. resolveTenant (confirms user belongs to :id workspace)
 * 3. requirePermission('location.view')
 * 4. validateLocationInWorkspace (confirms :locId belongs to :id workspace)
 * 5. chatRateLimiter (fixed-window 20 msgs / 15 min per user)
 * 6. chatController.handleMessage (Zod validation -> Guardrail check -> Service)
 */
chatRouter.post(
  '/locations/:locId/chat',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler(validateLocationInWorkspace),
  chatRateLimiter,
  asyncHandler((req: any, res: any) => chatController.handleMessage(req, res))
);

/**
 * GET /v1/workspaces/:id/locations/:locId/chat/dossier
 * Get full live business intelligence dossier
 */
chatRouter.get(
  '/locations/:locId/chat/dossier',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler(validateLocationInWorkspace),
  asyncHandler((req: any, res: any) => chatController.getDossier(req, res))
);


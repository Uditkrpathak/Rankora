import { Router } from 'express';
import { authenticate, requirePermission, resolveTenant } from '../../middleware/auth.middleware';
import { reviewController } from './review.controller';

export const reviewRouter = Router({ mergeParams: true });
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

// ─── Existing routes ─────────────────────────────────────────────────────────

reviewRouter.get(
  '/locations/:locId/reviews',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => reviewController.listLocationReviews(req, res))
);

reviewRouter.put(
  '/locations/:locId/reviews/:reviewId/reply',
  authenticate,
  resolveTenant,
  requirePermission('review.reply'),
  asyncHandler((req: any, res: any) => reviewController.sendReply(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/generate-copilot-tones',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => reviewController.generateCopilotTones(req, res))
);

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * GET /v1/workspaces/:id/locations/:locId/reviews/analytics
 * Returns sentiment timeline, topic extraction, and competitor benchmarks.
 * ?refresh=true forces recompute.
 */
reviewRouter.get(
  '/locations/:locId/reviews/analytics',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => reviewController.getAnalytics(req, res))
);

// ─── Negative Review Alerts ───────────────────────────────────────────────────

/**
 * GET  /v1/workspaces/:id/locations/:locId/reviews/alerts
 * POST /v1/workspaces/:id/locations/:locId/reviews/alerts   (upsert)
 * DELETE /v1/workspaces/:id/locations/:locId/reviews/alerts
 * POST /v1/workspaces/:id/locations/:locId/reviews/alerts/check  (manual trigger)
 */
reviewRouter.get(
  '/locations/:locId/reviews/alerts',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => reviewController.getAlert(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/alerts',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.upsertAlert(req, res))
);

reviewRouter.delete(
  '/locations/:locId/reviews/alerts',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.deleteAlert(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/alerts/check',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.runAlertCheck(req, res))
);

// ─── Review Request Drip Campaigns ───────────────────────────────────────────

/**
 * GET  /v1/workspaces/:id/locations/:locId/reviews/drip
 * POST /v1/workspaces/:id/locations/:locId/reviews/drip        (upsert campaign)
 * POST /v1/workspaces/:id/locations/:locId/reviews/drip/contacts  (add contacts)
 * POST /v1/workspaces/:id/locations/:locId/reviews/drip/test-email
 * POST /v1/workspaces/:id/locations/:locId/reviews/drip/contacts/:contactId/reviewed
 * POST /v1/workspaces/:id/locations/:locId/reviews/drip/contacts/:contactId/optout
 */
reviewRouter.get(
  '/locations/:locId/reviews/drip',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => reviewController.getCampaign(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/drip',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.upsertCampaign(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/drip/contacts',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.addDripContacts(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/drip/test-email',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.sendTestDripEmail(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/drip/contacts/:contactId/reviewed',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.markContactReviewed(req, res))
);

reviewRouter.post(
  '/locations/:locId/reviews/drip/contacts/:contactId/optout',
  authenticate,
  resolveTenant,
  requirePermission('location.update'),
  asyncHandler((req: any, res: any) => reviewController.optOutContact(req, res))
);

// ─── Bulk AI Reply Generation ─────────────────────────────────────────────────

/**
 * POST /v1/workspaces/:id/locations/:locId/reviews/bulk-reply
 * Body: { tone: 'professional' | 'friendly' | 'seo_optimized', maxBatch?: number }
 */
reviewRouter.post(
  '/locations/:locId/reviews/bulk-reply',
  authenticate,
  resolveTenant,
  requirePermission('location.view'),
  asyncHandler((req: any, res: any) => reviewController.generateBulkReplies(req, res))
);

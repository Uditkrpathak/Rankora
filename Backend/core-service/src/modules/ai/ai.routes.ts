import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticate, resolveTenant, requirePermission } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(authenticate, resolveTenant);

router.post('/locations/:locId/ai/drafts', requirePermission('ai.draft.create'), asyncHandler((req: any, res: any, next: any) => aiController.createDraft(req, res, next)));
router.get('/locations/:locId/ai/drafts', requirePermission('audit.view'), asyncHandler((req: any, res: any) => aiController.listDrafts(req, res)));
router.post('/ai/drafts/:draftId/approve', requirePermission('ai.draft.approve'), asyncHandler((req: any, res: any, next: any) => aiController.approveDraft(req, res, next)));
router.patch('/ai/drafts/:draftId', requirePermission('ai.draft.approve'), asyncHandler((req: any, res: any, next: any) => aiController.updateDraft(req, res, next)));
router.post('/ai/drafts/:draftId/reject', requirePermission('ai.draft.approve'), asyncHandler((req: any, res: any, next: any) => aiController.rejectDraft(req, res, next)));
router.post('/ai/drafts/:draftId/publish-review-reply', requirePermission('review.publish'), asyncHandler((req: any, res: any, next: any) => aiController.publishReviewReply(req, res, next)));
router.post('/ai/drafts/:draftId/publish-gbp-post', requirePermission('location.update'), asyncHandler((req: any, res: any, next: any) => aiController.publishGbpPost(req, res, next)));

export default router;

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { aiService } from './ai.service';
import { reviewService } from '../reviews/review.service';
import { gbpPostService } from '../google/gbp-post.service';

function workspaceId(req: AuthenticatedRequest): string { return req.workspace?._id?.toString() || req.params.id || ''; }
function actorId(req: AuthenticatedRequest): string { return req.user?._id?.toString() || req.user?.id || ''; }

export class AiController {
  public async generateDescriptionDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiService.generateDescriptionDraft({ workspaceId: workspaceId(req), locationId: req.params.locationId || req.params.locId, actorUserId: actorId(req) });
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  public async createDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kind, instruction, auditId, signalCode, reviewId } = req.body || {};
      let draft;
      const input = { workspaceId: workspaceId(req), locationId: req.params.locId, actorUserId: actorId(req), kind, instruction, auditId, signalCode, reviewId };
      if (kind === 'AUDIT_EXPLANATION' || kind === 'ACTION_DRAFT') draft = await aiService.generateAuditDraft(input);
      else if (kind === 'REVIEW_REPLY') draft = await aiService.generateReviewReplyDraft(input);
      else if (kind === 'GBP_POST') draft = await aiService.generateGbpPostDraft(input);
      else {
        res.status(400).json({ success: false, error: { code: 'INVALID_AI_DRAFT_KIND', message: 'Choose AUDIT_EXPLANATION, ACTION_DRAFT, REVIEW_REPLY, or GBP_POST.' } });
        return;
      }
      res.status(201).json({ success: true, data: draft });
    } catch (error) { next(error); }
  }

  public async listDrafts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await aiService.listDrafts(workspaceId(req), req.params.locId);
    res.json({ success: true, data });
  }

  public async approveDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try { const data = await aiService.approveDraft(workspaceId(req), req.params.draftId, actorId(req)); res.json({ success: true, data }); }
    catch (error) { next(error); }
  }

  public async updateDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (typeof req.body?.draftText !== 'string') {
        res.status(400).json({ success: false, error: { code: 'INVALID_AI_DRAFT_TEXT', message: 'draftText is required.' } });
        return;
      }
      const data = await aiService.updatePendingDraft(workspaceId(req), req.params.draftId, actorId(req), req.body.draftText);
      if (!data) { res.status(409).json({ success: false, error: { code: 'AI_DRAFT_NOT_EDITABLE', message: 'Only pending drafts can be edited.' } }); return; }
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }

  public async rejectDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try { const data = await aiService.rejectDraft(workspaceId(req), req.params.draftId, actorId(req)); res.json({ success: true, data }); }
    catch (error) { next(error); }
  }

  public async publishReviewReply(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiService.publishDraft(workspaceId(req), req.params.draftId, (draft) =>
        reviewService.sendReplyFromAiDraft(workspaceId(req), draft.locationId.toString(), draft._id.toString())
      );
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  public async publishGbpPost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiService.publishDraft(workspaceId(req), req.params.draftId, (draft) => gbpPostService.publishDraft(workspaceId(req), draft));
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }
}

export const aiController = new AiController();

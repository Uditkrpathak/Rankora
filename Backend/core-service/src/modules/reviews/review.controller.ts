import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { reviewService } from './review.service';
import { reviewAnalyticsService } from './review-analytics.service';
import { reviewAlertService } from './review-alert.service';
import { reviewDripService } from './review-drip.service';
import { reviewBulkReplyService } from './review-bulk-reply.service';

export class ReviewController {
  // ─── Existing ──────────────────────────────────────────────────────────────

  public async listLocationReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
    const pageToken = typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined;
    if (pageToken && pageToken.length > 2048) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAGE_TOKEN', message: 'Review page token is too long.' } });
      return;
    }
    const forceSync = req.query.sync === 'true' || req.query.forceSync === 'true';
    const result = await reviewService.listReviews(req.params.id, req.params.locId, pageToken, forceSync);
    const data = (result as any)?.data || result;
    res.json({ success: true, data });
  }

  public async sendReply(req: AuthenticatedRequest, res: Response): Promise<void> {
    const comment = req.body?.comment;
    if (typeof comment !== 'string') {
      res.status(400).json({ success: false, error: { code: 'INVALID_REVIEW_REPLY', message: 'A reply comment is required.' } });
      return;
    }
    const data = await reviewService.sendReply(req.params.id, req.params.locId, req.params.reviewId, comment);
    res.json({ success: true, data });
  }

  public async generateCopilotTones(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { reviewText, reviewerName, rating, reviewId } = req.body || {};
    const data = await reviewService.generateCopilotTones(req.params.id, req.params.locId, {
      reviewText,
      reviewerName,
      rating,
      reviewId,
    });
    res.json({ success: true, data });
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────

  public async getAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const forceRefresh = req.query.refresh === 'true';
    const data = await reviewAnalyticsService.getAnalytics(req.params.id, req.params.locId, forceRefresh);
    res.json({ success: true, data });
  }

  // ─── Alerts ────────────────────────────────────────────────────────────────

  public async getAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await reviewAlertService.getAlert(req.params.id, req.params.locId);
    res.json({ success: true, data: data || null });
  }

  public async upsertAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { ratingThreshold, notifyEmails, slackWebhookUrl, enabled } = req.body || {};
    if (!Array.isArray(notifyEmails) || notifyEmails.length === 0) {
      res.status(400).json({ success: false, error: { code: 'MISSING_EMAILS', message: 'At least one notify email is required.' } });
      return;
    }
    const threshold = Number(ratingThreshold ?? 3);
    if (isNaN(threshold) || threshold < 1 || threshold > 5) {
      res.status(400).json({ success: false, error: { code: 'INVALID_THRESHOLD', message: 'Rating threshold must be between 1 and 5.' } });
      return;
    }
    const data = await reviewAlertService.upsertAlert(req.params.id, req.params.locId, {
      ratingThreshold: threshold,
      notifyEmails,
      slackWebhookUrl,
      enabled: enabled !== false,
    });
    res.json({ success: true, data });
  }

  public async deleteAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    await reviewAlertService.deleteAlert(req.params.id, req.params.locId);
    res.json({ success: true });
  }

  public async runAlertCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await reviewAlertService.checkAndFireAlert(req.params.id, req.params.locId);
    res.json({ success: true, data: result });
  }

  // ─── Drip Campaigns ────────────────────────────────────────────────────────

  public async getCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await reviewDripService.getCampaign(req.params.id, req.params.locId);
    res.json({ success: true, data: data || null });
  }

  public async upsertCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await reviewDripService.upsertCampaign(req.params.id, req.params.locId, req.body || {});
    res.json({ success: true, data });
  }

  public async addDripContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const contacts = req.body?.contacts;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      res.status(400).json({ success: false, error: { code: 'MISSING_CONTACTS', message: 'contacts array is required.' } });
      return;
    }
    if (contacts.length > 200) {
      res.status(400).json({ success: false, error: { code: 'TOO_MANY_CONTACTS', message: 'Max 200 contacts per batch.' } });
      return;
    }
    const data = await reviewDripService.addContacts(req.params.id, req.params.locId, contacts);
    res.json({ success: true, data });
  }

  public async markContactReviewed(req: AuthenticatedRequest, res: Response): Promise<void> {
    await reviewDripService.markReviewed(req.params.id, req.params.locId, req.params.contactId);
    res.json({ success: true });
  }

  public async optOutContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    await reviewDripService.optOutContact(req.params.id, req.params.locId, req.params.contactId);
    res.json({ success: true });
  }

  public async sendTestDripEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email, name } = req.body || {};
    if (!email || !name) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'email and name are required.' } });
      return;
    }
    const result = await reviewDripService.sendTestEmail(req.params.id, req.params.locId, email, name);
    res.json({ success: true, data: result });
  }

  // ─── Bulk Reply ────────────────────────────────────────────────────────────

  public async generateBulkReplies(req: AuthenticatedRequest, res: Response): Promise<void> {
    const tone = req.body?.tone || 'professional';
    if (!['professional', 'friendly', 'seo_optimized'].includes(tone)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TONE', message: 'tone must be professional, friendly, or seo_optimized.' } });
      return;
    }
    const maxBatch = Math.min(Number(req.body?.maxBatch || 20), 30);
    const data = await reviewBulkReplyService.generateBulkReplies(req.params.id, req.params.locId, tone, maxBatch);
    res.json({ success: true, data });
  }
}

export const reviewController = new ReviewController();

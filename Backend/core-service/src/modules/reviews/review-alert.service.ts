import { ReviewAlert } from '../../models/ReviewAlert';
import { Location } from '../../models/Location';
import { reviewService } from './review.service';
import { ENV } from '../../config/env';
import { notificationService } from '../notifications/notification.service';

/**
 * Scans a location's live reviews for any new reviews at or below ratingThreshold
 * and fires email + Slack notifications using Resend.
 *
 * Designed to be called from a BullMQ worker or a scheduled cron.
 * No GBP API required — uses the existing multi-tier review fetch pipeline.
 */
export class ReviewAlertService {
  /**
   * Upserts the alert configuration for a location.
   */
  public async upsertAlert(
    workspaceId: string,
    locationId: string,
    config: {
      ratingThreshold: number;
      notifyEmails: string[];
      slackWebhookUrl?: string;
      enabled: boolean;
    }
  ) {
    return ReviewAlert.findOneAndUpdate(
      { workspaceId, locationId },
      {
        $set: {
          ratingThreshold: config.ratingThreshold,
          notifyEmails: config.notifyEmails,
          slackWebhookUrl: config.slackWebhookUrl ?? null,
          enabled: config.enabled,
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Returns the alert config for a location (or null if none exists).
   */
  public async getAlert(workspaceId: string, locationId: string) {
    return ReviewAlert.findOne({ workspaceId, locationId });
  }

  /**
   * Deletes an alert config.
   */
  public async deleteAlert(workspaceId: string, locationId: string) {
    return ReviewAlert.deleteOne({ workspaceId, locationId });
  }

  /**
   * Checks all active alerts for a given workspace and fires notifications
   * for any new negative reviews that haven't been alerted yet.
   *
   * Call this from a scheduled BullMQ job or a manual trigger.
   */
  public async runAlertCheckForWorkspace(workspaceId: string): Promise<void> {
    const alerts = await ReviewAlert.find({ workspaceId, enabled: true });

    for (const alert of alerts) {
      try {
        await this.checkAndFireAlert(alert.workspaceId, alert.locationId.toString());
      } catch (err: any) {
        console.warn(`[ReviewAlertService] Alert check failed for loc=${alert.locationId}:`, err?.message);
      }
    }
  }

  /**
   * Core alert check logic for a single location.
   */
  public async checkAndFireAlert(workspaceId: string, locationId: string): Promise<{ newAlertsFired: number }> {
    const alertConfig = await ReviewAlert.findOne({ workspaceId, locationId, enabled: true });
    if (!alertConfig) return { newAlertsFired: 0 };

    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null }).select('name placeId averageRating');
    if (!location) return { newAlertsFired: 0 };

    // Fetch latest reviews (uses cache-first approach; no extra API cost if cache is warm)
    const result = await reviewService.listReviews(workspaceId, locationId, undefined, false);
    const reviews = (result as any)?.data?.reviews || [];

    const threshold = alertConfig.ratingThreshold ?? 3;
    const alreadyAlerted = new Set(alertConfig.alreadyAlertedReviewIds);

    const negativeNewReviews = reviews.filter(
      (r: any) => r.numericRating <= threshold && !alreadyAlerted.has(r.reviewId)
    );

    if (negativeNewReviews.length === 0) {
      await ReviewAlert.updateOne({ _id: alertConfig._id }, { $set: { lastCheckedAt: new Date() } });
      return { newAlertsFired: 0 };
    }

    // Fire alert for each new negative review
    let fired = 0;
    for (const review of negativeNewReviews) {
      await this.sendAlertEmail(alertConfig.notifyEmails, location.name, review);
      await this.sendSlackAlert(alertConfig.slackWebhookUrl, location.name, review);

      // Trigger unified Notification Center (in-app notification + preference-based email)
      try {
        await notificationService.createNotification({
          workspaceId,
          type: 'NEGATIVE_REVIEW',
          severity: review.numericRating <= 2 ? 'CRITICAL' : 'WARNING',
          title: `⚠️ New ${review.numericRating}★ Review — ${location.name}`,
          message: review.comment || 'A new low-rating review was received on Google Maps.',
          link: '/reviews',
          metadata: {
            locationId,
            locationName: location.name,
            businessName: location.name,
            reviewId: review.reviewId,
            reviewerName: review.reviewer?.displayName || 'A customer',
            rating: review.numericRating,
            comment: review.comment,
            date: review.createTime,
          },
        });
      } catch (notifErr: any) {
        console.warn('[ReviewAlertService] Notification center dispatch error:', notifErr?.message);
      }

      fired++;
    }

    // Update the alerted IDs list to prevent duplicate fires
    const updatedAlertedIds = [
      ...alreadyAlerted,
      ...negativeNewReviews.map((r: any) => r.reviewId),
    ].slice(-500); // Cap at 500 to prevent unbounded array growth

    await ReviewAlert.updateOne(
      { _id: alertConfig._id },
      { $set: { alreadyAlertedReviewIds: updatedAlertedIds, lastCheckedAt: new Date() } }
    );

    return { newAlertsFired: fired };
  }

  // ─── Notification senders ─────────────────────────────────────────────────

  private async sendAlertEmail(emails: string[], businessName: string, review: any): Promise<void> {
    if (!emails.length) return;

    const resendKey = ENV.RESEND_API_KEY;
    if (!resendKey) {
      console.warn('[ReviewAlertService] RESEND_API_KEY not configured — email alert skipped.');
      return;
    }

    const stars = '★'.repeat(review.numericRating) + '☆'.repeat(5 - review.numericRating);
    const reviewerName = review.reviewer?.displayName || 'A customer';
    const reviewText = review.comment || '(No written comment)';
    const reviewDate = review.createTime
      ? new Date(review.createTime).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Recently';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 560px; margin: 0 auto; overflow: hidden; }
  .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px 24px; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
  .body { padding: 24px; }
  .stars { font-size: 22px; color: #f59e0b; margin-bottom: 8px; }
  .reviewer { font-weight: 700; color: #1e293b; font-size: 15px; }
  .date { color: #64748b; font-size: 12px; margin-bottom: 12px; }
  .review-text { background: #f8fafc; border-left: 3px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; color: #334155; font-size: 14px; line-height: 1.6; }
  .cta { margin-top: 20px; text-align: center; }
  .btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; padding: 12px 24px; border-top: 1px solid #f1f5f9; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>⚠️ New Negative Review Alert</h1>
    <p>${businessName} — Action Required</p>
  </div>
  <div class="body">
    <div class="stars">${stars}</div>
    <div class="reviewer">${reviewerName}</div>
    <div class="date">${reviewDate}</div>
    <div class="review-text">"${reviewText}"</div>
    <div class="cta">
      <a href="${ENV.FRONTEND_URL}/reviews" class="btn">Respond on Rankora →</a>
    </div>
  </div>
  <div class="footer">You are receiving this because you enabled negative review alerts for ${businessName}.</div>
</div>
</body>
</html>`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: ENV.EMAIL_FROM,
          to: emails,
          subject: `⚠️ New ${review.numericRating}★ Review — ${businessName} Needs a Response`,
          html: htmlBody,
        }),
      });
    } catch (err: any) {
      console.warn('[ReviewAlertService] Email send failed:', err?.message);
    }
  }

  private async sendSlackAlert(webhookUrl: string | undefined, businessName: string, review: any): Promise<void> {
    if (!webhookUrl) return;
    const stars = '★'.repeat(review.numericRating) + '☆'.repeat(5 - review.numericRating);
    const reviewerName = review.reviewer?.displayName || 'A customer';
    const reviewText = review.comment || '(No written comment)';

    const payload = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `⚠️ New ${review.numericRating}★ Review — ${businessName}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Reviewer:* ${reviewerName}` },
            { type: 'mrkdwn', text: `*Rating:* ${stars}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `> "${reviewText.slice(0, 300)}"` },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Respond on Rankora' },
              url: `${ENV.FRONTEND_URL}/reviews`,
              style: 'primary',
            },
          ],
        },
      ],
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      console.warn('[ReviewAlertService] Slack alert failed:', err?.message);
    }
  }
}

export const reviewAlertService = new ReviewAlertService();

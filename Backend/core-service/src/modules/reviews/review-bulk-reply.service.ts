import { reviewService } from './review.service';
import { IStoredReview } from '../../models/ReviewCache';

export interface BulkReplyResult {
  reviewId: string;
  reviewerName: string;
  rating: number;
  tone: 'professional' | 'friendly' | 'seo_optimized';
  replyText: string;
  status: 'ready' | 'skipped' | 'error';
  reason?: string;
}

/**
 * Generates AI replies for all unreplied reviews in a location in one batch.
 * Uses the existing generateCopilotTones pipeline (no GBP API required).
 */
export class ReviewBulkReplyService {
  /**
   * @param tone - Which copilot tone to use for all replies
   * @param maxBatch - Safety cap to prevent rate-limit blowout (default 20)
   */
  public async generateBulkReplies(
    workspaceId: string,
    locationId: string,
    tone: 'professional' | 'friendly' | 'seo_optimized' = 'professional',
    maxBatch = 20
  ): Promise<{ results: BulkReplyResult[]; skipped: number }> {
    // 1. Load reviews from cache (no external call)
    const reviewData = await reviewService.listReviews(workspaceId, locationId, undefined, false);
    const reviews: IStoredReview[] = (reviewData as any)?.data?.reviews || [];

    // 2. Filter unreplied reviews
    const unreplied = reviews
      .filter((r) => !r.reviewReply?.comment || r.reviewReply.comment.trim().length === 0)
      .slice(0, maxBatch);

    const skipped = Math.max(0, reviews.filter((r) => !r.reviewReply?.comment).length - unreplied.length);

    const results: BulkReplyResult[] = [];

    // 3. Generate copilot tones in sequence (avoid parallel AI flood)
    for (const review of unreplied) {
      try {
        const tonesResult = await reviewService.generateCopilotTones(workspaceId, locationId, {
          reviewId: review.reviewId,
          reviewText: review.comment,
          reviewerName: review.reviewer?.displayName,
          rating: review.numericRating,
        });

        const toneKey = tone === 'seo_optimized' ? 'seo_optimized' : tone;
        const selectedTone = tonesResult.tones[toneKey as keyof typeof tonesResult.tones];

        results.push({
          reviewId: review.reviewId,
          reviewerName: review.reviewer?.displayName || 'Customer',
          rating: review.numericRating,
          tone,
          replyText: selectedTone.replyText,
          status: 'ready',
        });
      } catch (err: any) {
        results.push({
          reviewId: review.reviewId,
          reviewerName: review.reviewer?.displayName || 'Customer',
          rating: review.numericRating,
          tone,
          replyText: '',
          status: 'error',
          reason: err?.message || 'Generation failed',
        });
      }
    }

    return { results, skipped };
  }
}

export const reviewBulkReplyService = new ReviewBulkReplyService();

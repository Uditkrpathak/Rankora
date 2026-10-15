import mongoose, { Schema, Document } from 'mongoose';

/**
 * Tracks active negative-review alert configurations per location.
 * When a review with numericRating <= threshold appears in a fresh scrape,
 * the alert fires via email / webhook.
 */
export interface ReviewAlertDocument extends Document {
  workspaceId: string;
  locationId: string;
  /** Rating threshold — reviews at or below this trigger the alert (default: 3) */
  ratingThreshold: number;
  /** Email addresses to notify */
  notifyEmails: string[];
  /** Slack webhook URL (optional) */
  slackWebhookUrl?: string;
  enabled: boolean;
  /** Last review IDs that were already alerted to prevent duplicate fires */
  alreadyAlertedReviewIds: string[];
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewAlertSchema = new Schema<ReviewAlertDocument>(
  {
    workspaceId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    ratingThreshold: { type: Number, default: 3, min: 1, max: 5 },
    notifyEmails: { type: [String], default: [] },
    slackWebhookUrl: { type: String, default: null },
    enabled: { type: Boolean, default: true },
    alreadyAlertedReviewIds: { type: [String], default: [] },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ReviewAlertSchema.index({ workspaceId: 1, locationId: 1 }, { unique: true });

export const ReviewAlert = mongoose.model<ReviewAlertDocument>('ReviewAlert', ReviewAlertSchema);

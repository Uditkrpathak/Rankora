import mongoose, { Schema, Document } from 'mongoose';

/**
 * A single contact enrolled in a review-request drip campaign.
 */
export interface IDripContact {
  name: string;
  email?: string;
  phone?: string; // E.164 format e.g. +919876543210
  addedAt: string; // ISO date
  /** Has the initial request been sent? */
  step1SentAt?: string;
  /** Has the follow-up been sent? */
  step2SentAt?: string;
  /** Did they leave a review (manual mark by owner)? */
  reviewedAt?: string;
  /** Opted out via unsubscribe link */
  optedOutAt?: string;
}

export interface ReviewDripDocument extends Document {
  workspaceId: string;
  locationId: string;
  /** Human readable campaign name */
  campaignName: string;
  enabled: boolean;
  /** Google Maps direct review link */
  reviewLink: string;
  /** Step 1: Initial request (delay 0 = immediate) */
  step1DelayHours: number;
  step1SubjectTemplate: string;
  step1BodyTemplate: string;
  /** Step 2: Follow-up reminder */
  step2DelayHours: number;
  step2SubjectTemplate: string;
  step2BodyTemplate: string;
  contacts: IDripContact[];
  totalSent: number;
  totalConverted: number;
  createdAt: Date;
  updatedAt: Date;
}

const DripContactSchema = new Schema<IDripContact>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    addedAt: { type: String, required: true },
    step1SentAt: { type: String },
    step2SentAt: { type: String },
    reviewedAt: { type: String },
    optedOutAt: { type: String },
  },
  { _id: true }
);

const ReviewDripSchema = new Schema<ReviewDripDocument>(
  {
    workspaceId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    campaignName: { type: String, required: true, trim: true, default: 'Review Request Campaign' },
    enabled: { type: Boolean, default: true },
    reviewLink: { type: String, required: true },
    step1DelayHours: { type: Number, default: 0 },
    step1SubjectTemplate: {
      type: String,
      default: 'How was your experience at {{businessName}}? 🌟',
    },
    step1BodyTemplate: {
      type: String,
      default:
        'Hi {{name}},\n\nThank you for visiting {{businessName}}! We hope you had a great experience.\n\nWe would love to hear your feedback — it only takes 30 seconds:\n\n{{reviewLink}}\n\nThank you for your support!\n\n— The {{businessName}} Team',
    },
    step2DelayHours: { type: Number, default: 72 },
    step2SubjectTemplate: {
      type: String,
      default: 'A quick reminder — share your {{businessName}} experience!',
    },
    step2BodyTemplate: {
      type: String,
      default:
        'Hi {{name}},\n\nWe noticed you haven\'t had a chance to leave a review yet. Your opinion really matters to us and helps future customers.\n\nLeave a quick review here:\n\n{{reviewLink}}\n\nThank you!\n\n— The {{businessName}} Team',
    },
    contacts: { type: [DripContactSchema], default: [] },
    totalSent: { type: Number, default: 0 },
    totalConverted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ReviewDripSchema.index({ workspaceId: 1, locationId: 1 });

export const ReviewDrip = mongoose.model<ReviewDripDocument>('ReviewDrip', ReviewDripSchema);

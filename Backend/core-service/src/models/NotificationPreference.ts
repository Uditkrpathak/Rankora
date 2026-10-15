import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationCategorySetting {
  enabled: boolean;
  email: boolean;
  inApp: boolean;
}

export interface INegativeReviewAlertSetting extends INotificationCategorySetting {
  ratingThreshold: number; // e.g. 1, 2, or 3 (alert triggered on <= ratingThreshold)
}

export interface IRankDropAlertSetting extends INotificationCategorySetting {
  minDropPositions: number; // e.g. 3 spots or more
}

export interface NotificationPreferenceDocument extends Document {
  workspaceId: string;
  emailAlertsEnabled: boolean;
  inAppAlertsEnabled: boolean;
  notifyEmails: string[];
  categories: {
    negativeReviews: INegativeReviewAlertSetting;
    listingProtection: INotificationCategorySetting;
    rankDrops: IRankDropAlertSetting;
    workspace: INotificationCategorySetting;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CategorySettingSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
  },
  { _id: false }
);

const NegativeReviewSettingSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    ratingThreshold: { type: Number, default: 3, min: 1, max: 5 },
  },
  { _id: false }
);

const RankDropSettingSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    minDropPositions: { type: Number, default: 3, min: 1, max: 50 },
  },
  { _id: false }
);

const NotificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    workspaceId: { type: String, required: true, unique: true, index: true },
    emailAlertsEnabled: { type: Boolean, default: true },
    inAppAlertsEnabled: { type: Boolean, default: true },
    notifyEmails: { type: [String], default: [] },
    categories: {
      negativeReviews: {
        type: NegativeReviewSettingSchema,
        default: () => ({ enabled: true, email: true, inApp: true, ratingThreshold: 3 }),
      },
      listingProtection: {
        type: CategorySettingSchema,
        default: () => ({ enabled: true, email: true, inApp: true }),
      },
      rankDrops: {
        type: RankDropSettingSchema,
        default: () => ({ enabled: true, email: true, inApp: true, minDropPositions: 3 }),
      },
      workspace: {
        type: CategorySettingSchema,
        default: () => ({ enabled: true, email: true, inApp: true }),
      },
    },
  },
  { timestamps: true }
);

export const NotificationPreference = mongoose.model<NotificationPreferenceDocument>(
  'NotificationPreference',
  NotificationPreferenceSchema
);

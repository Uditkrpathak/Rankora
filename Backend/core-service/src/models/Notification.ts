import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'NEGATIVE_REVIEW'
  | 'LISTING_PROTECTION'
  | 'RANK_DROP'
  | 'AUDIT_COMPLETED'
  | 'CREDITS_LOW'
  | 'TEAM_INVITE'
  | 'SYSTEM';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface NotificationDocument extends Document {
  workspaceId: string;
  userId?: string; // Optional: target specific user or all members if null
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  channels: ('IN_APP' | 'EMAIL')[];
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: false, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'NEGATIVE_REVIEW',
        'LISTING_PROTECTION',
        'RANK_DROP',
        'AUDIT_COMPLETED',
        'CREDITS_LOW',
        'TEAM_INVITE',
        'SYSTEM',
      ],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, required: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    channels: {
      type: [String],
      enum: ['IN_APP', 'EMAIL'],
      default: ['IN_APP'],
    },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ workspaceId: 1, createdAt: -1 });
NotificationSchema.index({ workspaceId: 1, isRead: 1 });

export const Notification = mongoose.model<NotificationDocument>('Notification', NotificationSchema);

import mongoose, { Document, Schema } from 'mongoose';
import { IAuditLog } from '@localo/types';

export interface AuditLogDocument extends Omit<IAuditLog, '_id'>, Document {}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId as any,
      ref: 'Workspace',
      required: false,
      index: true
    },
    actorUserId: {
      type: String,
      required: true,
      index: true
    },
    actorRole: {
      type: String,
      required: false,
      index: true
    },
    targetUserId: {
      type: String,
      required: false,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      required: false
    },
    resourceId: {
      type: String,
      required: false
    },
    before: {
      type: Schema.Types.Mixed,
      required: false
    },
    after: {
      type: Schema.Types.Mixed,
      required: false
    },
    ip: String,
    userAgent: String,
    correlationId: {
      type: String,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', AuditLogSchema);

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
    action: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      required: true
    },
    resourceId: {
      type: String,
      required: true
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

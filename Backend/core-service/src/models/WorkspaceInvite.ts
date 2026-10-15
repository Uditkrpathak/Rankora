import mongoose, { Document, Schema } from 'mongoose';
import { IWorkspaceInvite, InviteStatus, UserRole } from '@localo/types';

export interface WorkspaceInviteDocument extends Omit<IWorkspaceInvite, '_id'>, Document {}

const WorkspaceInviteSchema = new Schema<WorkspaceInviteDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId as any,
      ref: 'Workspace',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'] as UserRole[],
      required: true
    },
    invitedBy: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] as InviteStatus[],
      default: 'PENDING',
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    acceptedAt: Date,
    revokedAt: Date
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

WorkspaceInviteSchema.index({ workspaceId: 1, email: 1, status: 1 });

export const WorkspaceInvite = mongoose.model<WorkspaceInviteDocument>('WorkspaceInvite', WorkspaceInviteSchema);

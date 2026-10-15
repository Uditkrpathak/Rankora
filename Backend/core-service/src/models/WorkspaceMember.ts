import mongoose, { Document, Schema } from 'mongoose';
import { IWorkspaceMember, UserRole } from '@localo/types';

export interface WorkspaceMemberDocument extends Omit<IWorkspaceMember, '_id'>, Document {}

const WorkspaceMemberSchema = new Schema<WorkspaceMemberDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId as any,
      ref: 'Workspace',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'] as UserRole[],
      required: true,
      index: true
    },
    customPermissions: {
      type: [String],
      default: []
    },
    invitedBy: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: false
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMember = mongoose.model<WorkspaceMemberDocument>('WorkspaceMember', WorkspaceMemberSchema);

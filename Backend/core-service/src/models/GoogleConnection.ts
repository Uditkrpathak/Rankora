import mongoose, { Schema, Document } from 'mongoose';
import { GbpConnectionStatus } from '@localo/types';

export interface GoogleConnectionDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  connectedByUserId: mongoose.Types.ObjectId;
  googleEmail: string;
  googleAccountId: string;
  encryptedRefreshToken: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  scopes: string[];
  connectionType?: 'gbp' | 'gsc' | 'all';
  status: GbpConnectionStatus;
  lastRefreshError?: string | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleConnectionSchema = new Schema<GoogleConnectionDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    connectedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    googleEmail: { type: String, required: true, trim: true, lowercase: true },
    googleAccountId: { type: String, required: true, trim: true },
    encryptedRefreshToken: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: Number, default: 1 },
    scopes: { type: [String], default: [] },
    connectionType: {
      type: String,
      enum: ['gbp', 'gsc', 'all'],
      default: 'gbp',
    },
    status: {
      type: String,
      enum: ['CONNECTED', 'EXPIRED', 'REVOKED'],
      default: 'CONNECTED',
    },
    lastRefreshError: { type: String, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index allowing multi-account connections per workspace
GoogleConnectionSchema.index({ workspaceId: 1, googleEmail: 1 }, { unique: true });

export const GoogleConnection = mongoose.model<GoogleConnectionDocument>(
  'GoogleConnection',
  GoogleConnectionSchema
);

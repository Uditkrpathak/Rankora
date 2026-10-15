import mongoose, { Document, Schema } from 'mongoose';
import { IRefreshToken } from '@localo/types';

export interface RefreshTokenDocument extends Omit<IRefreshToken, '_id'>, Document {}

const RefreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      index: true
    },
    parentTokenId: {
      type: String,
      required: false
    },
    replacedByTokenId: {
      type: String,
      required: false
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    revokedAt: {
      type: Date,
      required: false
    },
    revocationReason: {
      type: String,
      enum: ['ROTATED', 'REPLAY_DETECTED', 'MANUAL_LOGOUT', 'PASSWORD_RESET'],
      required: false
    },
    userAgent: {
      type: String,
      required: false
    },
    userAgentHash: {
      type: String,
      required: false
    },
    ipAddress: {
      type: String,
      required: false
    },
    ipHash: {
      type: String,
      required: false
    },
    locationSummary: {
      type: String,
      required: false
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index for automatic expiration
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const RefreshToken = mongoose.model<RefreshTokenDocument>('RefreshToken', RefreshTokenSchema);

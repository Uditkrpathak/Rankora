import mongoose, { Document, Schema } from 'mongoose';

export interface TrialClaimDocument extends Document {
  placeId: string;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  businessName?: string;
  claimedAt: Date;
  trialExpiresAt: Date;
  ipAddress?: string;
  gridQuotaGranted: number;
  gridQuotaUsed: number;
  status: 'ACTIVE' | 'EXPIRED' | 'FROZEN' | 'CONVERTED';
}

const TrialClaimSchema = new Schema<TrialClaimDocument>(
  {
    placeId: {
      type: String,
      required: true,
      unique: true, // Strict 1 trial per Google Place ID guarantee
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    trialExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    gridQuotaGranted: {
      type: Number,
      default: 1, // Exactly 1 3x3 (9-pin) grid scan granted per trial
    },
    gridQuotaUsed: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'FROZEN', 'CONVERTED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TrialClaim = mongoose.models.TrialClaim || mongoose.model<TrialClaimDocument>('TrialClaim', TrialClaimSchema);

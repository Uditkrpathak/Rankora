import mongoose, { Document, Schema } from 'mongoose';
import { AuditTaskStatus } from '@localo/types';

export interface AuditTaskDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  auditId: mongoose.Types.ObjectId;
  signalCode: string;
  pillar?: string;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  destination: string;
  impact: number;
  potentialGain?: number;
  baselineAuditScore?: number;
  completedAuditScore?: number | null;
  status: AuditTaskStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AuditTaskSchema = new Schema<AuditTaskDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    auditId: { type: Schema.Types.ObjectId, ref: 'Audit', required: true },
    signalCode: { type: String, required: true },
    pillar: { type: String },
    title: { type: String, required: true },
    whyItMatters: { type: String, required: true },
    recommendedAction: { type: String, required: true },
    destination: { type: String, required: true },
    impact: { type: Number, required: true, min: 0 },
    potentialGain: { type: Number },
    baselineAuditScore: { type: Number },
    completedAuditScore: { type: Number, default: null },
    status: {
      type: String,
      enum: ['OPEN', 'PENDING_VERIFICATION', 'DONE', 'VERIFIED', 'DISMISSED'],
      default: 'OPEN',
      index: true,
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AuditTaskSchema.index({ workspaceId: 1, locationId: 1, signalCode: 1 }, { unique: true });
AuditTaskSchema.index({ workspaceId: 1, status: 1, impact: -1 });

export const AuditTask = mongoose.model<AuditTaskDocument>('AuditTask', AuditTaskSchema);

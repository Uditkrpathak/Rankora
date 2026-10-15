import mongoose, { Schema, Document } from 'mongoose';
import { IAuditSignal, IAuditCategoryScore, AuditPillar, SignalSeverity } from '@localo/types';

export interface AuditDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  auditVersion: string; // e.g. '1.0'
  rulesVersion: string; // e.g. '2026.1'
  score: number; // 0 to 100
  categoryScores: IAuditCategoryScore[];
  signals: IAuditSignal[];
  summary: {
    criticalCount: number;
    warningCount: number;
    optimizationCount: number;
    passedCount: number;
    unknownCount: number;
  };
  recalculatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SignalSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    pillar: { type: String, required: true },
    weight: { type: Number, required: true },
    score: { type: Number, required: true },
    severity: { type: String, enum: ['CRITICAL', 'WARNING', 'OPTIMIZATION', 'PASS', 'UNKNOWN'], required: true },
    passed: { type: Boolean, required: true },
    actualValue: { type: Schema.Types.Mixed },
    recommendedValue: { type: Schema.Types.Mixed },
    remediationTip: { type: String, required: true },
    evidenceSource: { type: String },
    confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] },
    explanation: { type: String },
  },
  { _id: false }
);

const CategoryScoreSchema = new Schema(
  {
    pillar: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    percentage: { type: Number, required: true },
  },
  { _id: false }
);

const AuditSchema = new Schema<AuditDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    auditVersion: { type: String, required: true, default: '1.0' },
    rulesVersion: { type: String, required: true, default: '2026.1' },
    score: { type: Number, required: true, min: 0, max: 100 },
    categoryScores: { type: [CategoryScoreSchema], default: [] },
    signals: { type: [SignalSchema], default: [] },
    summary: {
      criticalCount: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
      optimizationCount: { type: Number, default: 0 },
      passedCount: { type: Number, default: 0 },
      unknownCount: { type: Number, default: 0 },
    },
    recalculatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AuditSchema.index({ workspaceId: 1, locationId: 1, createdAt: -1 });

export const Audit = mongoose.model<AuditDocument>('Audit', AuditSchema);

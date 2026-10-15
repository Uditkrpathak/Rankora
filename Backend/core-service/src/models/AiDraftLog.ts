import mongoose, { Document, Schema } from 'mongoose';
import { AiDraftKind, AiDraftStatus, AiEvidenceFact, AiMissingEvidence } from '../modules/ai/ai.types';

export interface AiDraftLogDocument extends Omit<Document, 'model'> {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  prompt: string;
  factsUsed: {
    name: string;
    city: string;
    address?: string;
    primaryCategory?: string;
    secondaryCategories?: string[];
    phone?: string;
    website?: string;
  };
  draftText: string;
  charCount: number;
  model: string;
  latencyMs: number;
  kind: AiDraftKind;
  status: AiDraftStatus;
  evidenceUsed: AiEvidenceFact[];
  evidenceMissing: AiMissingEvidence[];
  reviewId?: string;
  auditId?: mongoose.Types.ObjectId;
  signalCode?: string;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  rejectedBy?: mongoose.Types.ObjectId | null;
  rejectedAt?: Date | null;
  publishedAt?: Date | null;
  publicationError?: string | null;
  isAiGenerated: boolean;
  generationVersion: number;
  stateHistory: Array<{ state: AiDraftStatus; actorUserId?: mongoose.Types.ObjectId; at: Date; note?: string }>;
  createdAt: Date;
}

const AiDraftLogSchema = new Schema<AiDraftLogDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prompt: { type: String, required: true },
    factsUsed: { type: Schema.Types.Mixed, required: true },
    draftText: { type: String, required: true },
    charCount: { type: Number, required: true },
    model: { type: String, default: 'localo-seo-grounded-v1' },
    latencyMs: { type: Number, default: 0 },
    kind: { type: String, enum: ['DESCRIPTION', 'AUDIT_EXPLANATION', 'ACTION_DRAFT', 'REVIEW_REPLY', 'GBP_POST'], default: 'DESCRIPTION', index: true },
    status: { type: String, enum: ['PENDING_APPROVAL', 'APPROVED', 'PUBLISHING', 'PUBLICATION_UNCERTAIN', 'REJECTED', 'PUBLISHED'], default: 'PENDING_APPROVAL', index: true },
    evidenceUsed: { type: [Schema.Types.Mixed], default: [] } as any,
    evidenceMissing: { type: [Schema.Types.Mixed], default: [] } as any,
    reviewId: { type: String, default: null },
    auditId: { type: Schema.Types.ObjectId, ref: 'Audit', default: null },
    signalCode: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    publicationError: { type: String, default: null },
    isAiGenerated: { type: Boolean, default: true, immutable: true },
    generationVersion: { type: Number, default: 1, immutable: true },
    stateHistory: [{ state: { type: String, enum: ['PENDING_APPROVAL', 'APPROVED', 'PUBLISHING', 'PUBLICATION_UNCERTAIN', 'REJECTED', 'PUBLISHED'], required: true }, actorUserId: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, required: true }, note: { type: String } }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AiDraftLogSchema.index({ workspaceId: 1, createdAt: -1 });
AiDraftLogSchema.index({ workspaceId: 1, locationId: 1, status: 1, createdAt: -1 });

export const AiDraftLog = mongoose.model<AiDraftLogDocument>('AiDraftLog', AiDraftLogSchema);

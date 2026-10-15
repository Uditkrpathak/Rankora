import mongoose, { Schema, Document } from 'mongoose';

export interface CompetitorDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  placeId: string;
  cid?: string;
  name: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  primaryCategory?: string;
  phone?: string;
  website?: string;
  avgRank: number;
  solv: number;
  visibilityIndex: number;
  lastObservedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompetitorSchema = new Schema<CompetitorDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    placeId: { type: String, required: true },
    cid: { type: String, index: true },
    name: { type: String, required: true },
    address: { type: String },
    rating: { type: Number },
    reviewsCount: { type: Number },
    primaryCategory: { type: String },
    phone: { type: String },
    website: { type: String },
    avgRank: { type: Number, default: 21 },
    solv: { type: Number, default: 0 },
    visibilityIndex: { type: Number, default: 0 },
    lastObservedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Strictly tenant-isolated: unique per workspace, location, and competitor placeId
CompetitorSchema.index({ workspaceId: 1, locationId: 1, placeId: 1 }, { unique: true });
CompetitorSchema.index({ workspaceId: 1, locationId: 1, visibilityIndex: -1 });

export const Competitor = mongoose.model<CompetitorDocument>('Competitor', CompetitorSchema);

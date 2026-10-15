import mongoose, { Document, Schema } from 'mongoose';

export type GBPPerformanceMetric =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'BUSINESS_DIRECTION_REQUESTS'
  | 'CALL_CLICKS'
  | 'WEBSITE_CLICKS'
  | 'BUSINESS_CONVERSATIONS'
  | 'BUSINESS_BOOKINGS'
  | 'BUSINESS_FOOD_ORDERS'
  | 'BUSINESS_FOOD_MENU_CLICKS';

export interface GBPPerformanceSnapshotDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  date: Date;
  metrics: Partial<Record<GBPPerformanceMetric, number>>;
  source: 'GOOGLE_BUSINESS_PROFILE';
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GBPPerformanceSnapshotSchema = new Schema<GBPPerformanceSnapshotDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    date: { type: Date, required: true },
    metrics: { type: Schema.Types.Mixed, required: true, default: {} },
    source: { type: String, enum: ['GOOGLE_BUSINESS_PROFILE'], required: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

GBPPerformanceSnapshotSchema.index({ workspaceId: 1, locationId: 1, date: 1 }, { unique: true });

export const GBPPerformanceSnapshot = mongoose.model<GBPPerformanceSnapshotDocument>(
  'GBPPerformanceSnapshot',
  GBPPerformanceSnapshotSchema
);

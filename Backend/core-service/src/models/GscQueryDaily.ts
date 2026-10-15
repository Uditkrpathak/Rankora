import mongoose, { Schema, Document, Types } from 'mongoose';

export interface GscQueryDailyDocument extends Document {
  locationId: Types.ObjectId;
  siteUrl: string;
  date: string; // YYYY-MM-DD
  query: string;
  normalizedQuery: string;
  page: string;
  device: string; // DESKTOP, MOBILE, TABLET
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GscQueryDailySchema = new Schema<GscQueryDailyDocument>(
  {
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    siteUrl: { type: String, required: true },
    date: { type: String, required: true },
    query: { type: String, required: true },
    normalizedQuery: { type: String, required: true, index: true },
    page: { type: String, required: true },
    device: { type: String, required: true },
    clicks: { type: Number, required: true, default: 0 },
    impressions: { type: Number, required: true, default: 0 },
    ctr: { type: Number, required: true, default: 0 },
    position: { type: Number, required: true, default: 0 },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique index enforcing idempotency across location, date, query, page, and device
GscQueryDailySchema.index({ locationId: 1, date: 1, query: 1, page: 1, device: 1 }, { unique: true });
GscQueryDailySchema.index({ locationId: 1, normalizedQuery: 1, date: -1 });
GscQueryDailySchema.index({ locationId: 1, date: -1 });

export const GscQueryDaily = mongoose.model<GscQueryDailyDocument>('GscQueryDaily', GscQueryDailySchema);

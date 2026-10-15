import mongoose, { Schema, Document } from 'mongoose';

export interface IProtectionIncident {
  type: 'STATUS_CLOSED' | 'PHONE_CHANGED' | 'NAME_TAMPERED' | 'HOURS_MODIFIED' | 'ADDRESS_MOVED';
  field: string;
  previousValue: string;
  currentValue: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  detectedAt: Date;
  resolvedAt?: Date;
  isResolved: boolean;
}

export interface IProtectionSnapshotDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  placeId: string;
  status: 'SECURE' | 'DRIFT_DETECTED' | 'CRITICAL_SABOTAGE';
  lastCheckedAt: Date;
  baseline: {
    name: string;
    phone?: string;
    address?: string;
    website?: string;
    businessStatus?: string;
    rating?: number;
    userRatingCount?: number;
  };
  current: {
    name: string;
    phone?: string;
    address?: string;
    website?: string;
    businessStatus?: string;
    rating?: number;
    userRatingCount?: number;
  };
  incidents: IProtectionIncident[];
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IProtectionIncident>(
  {
    type: {
      type: String,
      enum: ['STATUS_CLOSED', 'PHONE_CHANGED', 'NAME_TAMPERED', 'HOURS_MODIFIED', 'ADDRESS_MOVED'],
      required: true,
    },
    field: { type: String, required: true },
    previousValue: { type: String, default: '' },
    currentValue: { type: String, default: '' },
    severity: { type: String, enum: ['CRITICAL', 'WARNING', 'INFO'], default: 'WARNING' },
    message: { type: String, required: true },
    detectedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    isResolved: { type: Boolean, default: false },
  },
  { _id: true }
);

const ListingProtectionSnapshotSchema = new Schema<IProtectionSnapshotDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true, unique: true },
    placeId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['SECURE', 'DRIFT_DETECTED', 'CRITICAL_SABOTAGE'],
      default: 'SECURE',
      index: true,
    },
    lastCheckedAt: { type: Date, default: Date.now },
    baseline: {
      name: { type: String, required: true },
      phone: { type: String },
      address: { type: String },
      website: { type: String },
      businessStatus: { type: String, default: 'OPERATIONAL' },
      rating: { type: Number },
      userRatingCount: { type: Number },
    },
    current: {
      name: { type: String, required: true },
      phone: { type: String },
      address: { type: String },
      website: { type: String },
      businessStatus: { type: String, default: 'OPERATIONAL' },
      rating: { type: Number },
      userRatingCount: { type: Number },
    },
    incidents: [IncidentSchema],
  },
  { timestamps: true }
);

export const ListingProtectionSnapshot = mongoose.model<IProtectionSnapshotDocument>(
  'ListingProtectionSnapshot',
  ListingProtectionSnapshotSchema
);

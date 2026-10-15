import mongoose, { Schema, Document } from 'mongoose';
import { GbpSyncStatus, IGbpCategory, IGbpHourPeriod, IGbpSpecialHour, LocationAddedVia, CoordinatesSource } from '@localo/types';

export interface LocationDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  coordinates?: { lat: number; lng: number } | null;
  placesCoordinates?: { lat: number; lng: number } | null;
  coordinatesSource?: CoordinatesSource;
  coordinatesVerifiedAt?: Date | null;
  placeId?: string | null;
  mapsCid?: string | null;
  status: 'active' | 'paused' | 'archived';
  ownershipVerified: boolean;
  addedVia: LocationAddedVia;
  gbpUrl?: string | null;
  gbpAccountId?: string | null;
  gbpLocationId?: string | null;
  googleConnectionId?: mongoose.Types.ObjectId | null;
  categories: string[];
  primaryCategory?: IGbpCategory | null;
  secondaryCategories: IGbpCategory[];
  regularHours?: Record<string, IGbpHourPeriod>;
  specialHours?: IGbpSpecialHour[];
  phone?: string;
  website?: string;
  description?: string;
  averageRating?: number | null;
  totalReviewCount?: number | null;
  reviewResponseRate?: number | null;
  placesDetailsFetchedAt?: Date | null;
  photosCount?: number;
  mediaSyncedAt?: Date | null;
  coverPhotoUrl?: string;
  logoUrl?: string;
  attributes?: string[];
  hasLocalBusinessSchema?: boolean;
  schemaVerification?: {
    verified: boolean;
    verifiedAt: Date;
    detectedTypes: string[];
    verificationMethod: 'automated_crawler' | 'manual_audit';
    rawSnippet?: string;
    error?: string;
  };
  hasRecentReview?: boolean;
  hasRecentPost?: boolean;
  isPinned?: boolean;
  tags?: string[];
  lastOpenedAt?: Date | null;
  optimization?: {
    enabled: boolean;
    enabledAt?: Date | null;
    enabledBy?: mongoose.Types.ObjectId | null;
    protectionWatchdog?: boolean;
    lastProtectedCheckAt?: Date | null;
  };
  cachedKpis?: {
    visibilityScore: number;
    averagePosition: number;
    profileViewsThisMonth: number;
    profileViewsLastMonth: number;
    profileViewsDelta: number;
    totalReviews: number;
    averageRating: number;
    newReviewsCount: number;
    areaDifficulty?: string;
    lastCalculatedAt?: Date | null;
  };
  recommendedTasks?: any[];
  sublocalities?: string[];
  keywordLimit?: number | null;
  onboardingGuidedAt?: Date | null;
  areaDifficultyIndex?: number;
  businessVisibilityScore?: number;
  syncStatus: GbpSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: Date | null;
  gscSiteUrl?: string | null;
  gscConnectionStatus?: 'connected' | 'needs_reauth' | 'none';
  gscLastSyncedAt?: Date | null;
  auditScheduleEnabled: boolean;
  nextAuditAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<LocationDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    placesCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    coordinatesSource: {
      type: String,
      enum: ['PLACES_API', 'GEOCODED', 'USER_CONFIRMED', 'MOCK_FALLBACK'],
      default: undefined,
    },
    coordinatesVerifiedAt: { type: Date, default: null },
    placeId: { type: String, default: null, trim: true },
    mapsCid: { type: String, default: null, trim: true },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
    ownershipVerified: { type: Boolean, default: false, index: true },
    addedVia: {
      type: String,
      enum: ['gbp_import', 'places_search', 'manual_entry'],
      default: 'manual_entry',
      index: true,
    },
    gbpUrl: { type: String, default: null, trim: true },
    gbpAccountId: { type: String, default: null, trim: true },
    gbpLocationId: { type: String, default: null, trim: true },
    googleConnectionId: { type: Schema.Types.ObjectId, ref: 'GoogleConnection', default: null },
    categories: { type: [String], default: [] },
    primaryCategory: {
      id: { type: String },
      displayName: { type: String },
    },
    secondaryCategories: [
      {
        id: { type: String },
        displayName: { type: String },
      },
    ],
    regularHours: { type: Schema.Types.Mixed, default: {} },
    specialHours: [
      {
        date: { type: String },
        open: { type: String },
        close: { type: String },
        isClosed: { type: Boolean, default: false },
      },
    ],
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    description: { type: String, default: '' },
    averageRating: { type: Number, default: null },
    totalReviewCount: { type: Number, default: null },
    reviewResponseRate: { type: Number, default: null },
    placesDetailsFetchedAt: { type: Date, default: null },
    photosCount: { type: Number, default: 0 },
    mediaSyncedAt: { type: Date, default: null },
    coverPhotoUrl: { type: String, default: null },
    logoUrl: { type: String, default: null },
    attributes: { type: [String], default: [] },
    hasRecentReview: { type: Boolean, default: false },
    hasRecentPost: { type: Boolean, default: false },
    hasLocalBusinessSchema: { type: Boolean, default: false },
    schemaVerification: {
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date, default: null },
      detectedTypes: { type: [String], default: [] },
      verificationMethod: { type: String, enum: ['automated_crawler', 'manual_audit'], default: 'automated_crawler' },
      rawSnippet: { type: String, default: null },
      error: { type: String, default: null },
    },
    isPinned: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
    lastOpenedAt: { type: Date, default: Date.now },
    optimization: {
      enabled: { type: Boolean, default: false, index: true },
      enabledAt: { type: Date, default: null },
      enabledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      protectionWatchdog: { type: Boolean, default: false },
      lastProtectedCheckAt: { type: Date, default: null },
    },
    cachedKpis: {
      visibilityScore: { type: Number, default: 0 },
      averagePosition: { type: Number, default: 0 },
      profileViewsThisMonth: { type: Number, default: 0 },
      profileViewsLastMonth: { type: Number, default: 0 },
      profileViewsDelta: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      newReviewsCount: { type: Number, default: 0 },
      areaDifficulty: { type: String, default: 'LOW' },
      lastCalculatedAt: { type: Date, default: null },
    },
    recommendedTasks: { type: [Schema.Types.Mixed], default: [] },
    sublocalities: { type: [String], default: [] },
    keywordLimit: { type: Number, default: null },
    onboardingGuidedAt: { type: Date, default: null },
    areaDifficultyIndex: { type: Number, default: 50 },
    businessVisibilityScore: { type: Number, default: 0 },
    syncStatus: {
      type: String,
      enum: ['SYNCED', 'PENDING', 'ERROR', 'STANDALONE'],
      default: 'STANDALONE',
    },
    syncError: { type: String, default: null },
    lastSyncedAt: { type: Date, default: null },
    gscSiteUrl: { type: String, default: null, trim: true },
    gscConnectionStatus: {
      type: String,
      enum: ['connected', 'needs_reauth', 'none'],
      default: 'none',
      index: true,
    },
    gscLastSyncedAt: { type: Date, default: null },
    auditScheduleEnabled: { type: Boolean, default: true },
    nextAuditAt: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index for active workspace location queries
LocationSchema.index({ workspaceId: 1, deletedAt: 1 });

// Partial unique indexes for placeId and gbpLocationId: allows multiple soft-deleted records or re-imports
LocationSchema.index(
  { workspaceId: 1, placeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      placeId: { $type: 'string', $gt: '' },
    },
  }
);

LocationSchema.index(
  { workspaceId: 1, gbpLocationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      gbpLocationId: { $type: 'string', $gt: '' },
    },
  }
);

export const Location = mongoose.model<LocationDocument>('Location', LocationSchema);

import mongoose, { Schema, Document, Types } from 'mongoose';
import { VolumeSource, ISparklinePoint, KeywordScanStatus, KeywordRankState, VolumeTier, GridType, KeywordSource } from '@localo/types';
import { DEFAULT_GRID_SIZE, DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MIN_RADIUS_KM, VALID_GRID_SIZES } from '../modules/rankings/scan-settings';

export interface TrackedKeywordDocument extends Document {
  workspaceId: Types.ObjectId;
  locationId: Types.ObjectId;
  keyword: string;
  source: KeywordSource;
  normalizedKeyword: string;
  monthlySearchVolume: number | null;
  volumeSource: VolumeSource;
  volumeBand: string | null;
  volumeTier: VolumeTier;
  hasLocalPack: boolean;
  triggersLocalPack: boolean;
  currentRank: number | null;
  overallRank?: number | null;
  totalCompetitors?: number | null;
  previousRank: number | null;
  rankState: KeywordRankState;
  visibilityScore: number;
  visibilityDelta: number;
  sparkline: ISparklinePoint[];
  gscMetrics?: {
    clicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
    lastSyncedAt: Date;
  } | null;
  lastScannedAt: Date | null;
  lastProvider: string | null;
  lastScanError?: string | null;
  scanStatus: KeywordScanStatus;
  gridType: GridType;
  lastScanId: string | null;
  noLocalResults?: boolean;
  noLocalResultsAt?: Date | null;
  lastRefundedNoLocalResultsAt?: Date | null;
  status: 'active' | 'paused';
  scanFrequency: 'manual' | 'daily' | 'weekly';
  gridSize: number;
  radiusKm: number;
  nextScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TrackedKeywordSchema = new Schema<TrackedKeywordDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    keyword: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ['MANUAL', 'SUGGESTION', 'RECOMMENDED_SEED', 'GOOGLE_AUTOCOMPLETE', 'LEGACY'],
      default: 'MANUAL',
      index: true,
    },
    normalizedKeyword: { type: String, required: true },
    monthlySearchVolume: { type: Number, default: null },
    volumeSource: {
      type: String,
      enum: ['live', 'cached', 'estimated_band'],
      default: 'estimated_band',
    },
    volumeBand: { type: String, default: null },
    volumeTier: {
      type: String,
      enum: ['POPULAR', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
      index: true,
    },
    hasLocalPack: { type: Boolean, default: false },
    triggersLocalPack: { type: Boolean, default: false },
    currentRank: { type: Number, default: null },
    overallRank: { type: Number, default: null },
    totalCompetitors: { type: Number, default: null },
    previousRank: { type: Number, default: null },
    rankState: {
      type: String,
      enum: ['RANKED', 'NOT_IN_TOP_20', 'UNKNOWN'],
      default: 'UNKNOWN',
      index: true,
    },
    visibilityScore: { type: Number, default: 0 },
    visibilityDelta: { type: Number, default: 0 },
    sparkline: [
      {
        date: { type: Date, required: true },
        rank: { type: Number, default: null },
        visibility: { type: Number, required: true },
        scanId: { type: String, default: null },
        _id: false,
      },
    ],
    gscMetrics: {
      type: {
        clicks: { type: Number, default: 0 },
        impressions: { type: Number, default: 0 },
        ctr: { type: Number, default: 0 },
        averagePosition: { type: Number, default: 0 },
        lastSyncedAt: { type: Date, default: null },
      },
      default: null,
      _id: false,
    },
    lastScannedAt: { type: Date, default: null },
    lastProvider: { type: String, default: null },
    lastScanError: { type: String, default: null },
    scanStatus: {
      type: String,
      enum: ['NOT_SCANNED', 'QUEUED', 'SCANNING', 'SCANNED', 'PARTIAL', 'FAILED', 'NO_LOCAL_RESULTS'],
      default: 'NOT_SCANNED',
      index: true,
    },
    gridType: {
      type: String,
      enum: ['QUICK', 'SMART_GRID'],
      default: 'QUICK',
    },
    lastScanId: { type: String, default: null },
    noLocalResults: { type: Boolean, default: false },
    noLocalResultsAt: { type: Date, default: null },
    lastRefundedNoLocalResultsAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    scanFrequency: { type: String, enum: ['manual', 'daily', 'weekly'], default: 'manual' },
    gridSize: { type: Number, enum: [...VALID_GRID_SIZES], default: DEFAULT_GRID_SIZE },
    radiusKm: { type: Number, min: MIN_RADIUS_KM, max: MAX_RADIUS_KM, default: DEFAULT_RADIUS_KM },
    nextScheduledAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// High-performance indexes:
TrackedKeywordSchema.index({ locationId: 1, normalizedKeyword: 1 }, { unique: true });
TrackedKeywordSchema.index({ workspaceId: 1, locationId: 1, createdAt: -1 });
TrackedKeywordSchema.index({ workspaceId: 1, locationId: 1, scanStatus: 1, lastScannedAt: -1 });
TrackedKeywordSchema.index({ workspaceId: 1, locationId: 1, visibilityScore: -1 });
TrackedKeywordSchema.index({ workspaceId: 1, locationId: 1, currentRank: 1 });

export const TrackedKeyword = mongoose.model<TrackedKeywordDocument>('TrackedKeyword', TrackedKeywordSchema);

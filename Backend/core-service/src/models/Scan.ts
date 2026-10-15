import mongoose, { Schema, Document } from 'mongoose';
import { ScanStatus, IScanLocalization, IGridPointResult, IRankMetrics } from '@localo/types';
import { DEFAULT_GRID_SIZE, DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MIN_RADIUS_KM, SCAN_SHAPES, ScanShape, VALID_GRID_SIZES } from '../modules/rankings/scan-settings';

export interface IRawSERPRecord {
  provider: string;
  providerRequestId?: string;
  parserVersion: string;
  gridPoint: { lat: number; lng: number; row: number; col: number };
  fetchedAt: Date;
  rawPayload: any;
}

export interface IScanGridSpec {
  geometryId: string; // 'RINGS_1_6_10_14' | 'QUICK_RINGS_1_8' | 'SQUARE_GRID'
  gridSpecVersion: number;
  centerLat: number;
  centerLng: number;
  centerSource: 'BUSINESS' | 'CUSTOM';
  radiusKm: number;
  ringFractions: number[];
  pinCount: number;
  spacingKm: number;
}

export interface ScanDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  keyword: string;
  searchSpanMeters?: number;
  /** Absent on historical square scans. */
  scanShape?: ScanShape;
  gridSize: number;
  /** Absent on historical square scans; fall back to gridSize². */
  pointCount?: number;
  gridSpecVersion?: number;
  gridSpec?: IScanGridSpec;
  dedupeFingerprint?: string;
  billingCycleKey?: string;
  radiusKm: number;
  center: {
    lat: number;
    lng: number;
  };
  localization: IScanLocalization;
  status: ScanStatus;
  credits: {
    required: number;
    reserved: boolean;
    charged: boolean;
    refunded: boolean;
    refundAmount?: number;
    chargedAmount?: number;
  };
  costTracking?: {
    estimatedCostUsd: number;
    actualCostUsd: number;
    reconciled: boolean;
    reconciledAt?: Date;
    billingCycleKey?: string;
  };
  metricsVersion?: string;
  gridPoints: IGridPointResult[];
  rawResponses: IRawSERPRecord[];
  metrics?: IRankMetrics | null;
  areaDifficulty?: 'LOW' | 'MEDIUM' | 'HIGH';
  error?: string | null;
  requeueCount?: number;
  noLocalResults?: boolean;
  inconclusive?: boolean;
  isPublicShareable?: boolean;
  shareToken?: string | null;
  agencyBranding?: {
    agencyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    contactEmail?: string | null;
    websiteUrl?: string | null;
    notes?: string | null;
  };
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GridPointSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    pinIndex: { type: Number },
    ring: { type: Number },
    ringIndex: { type: Number },
    distanceKm: { type: Number },
    bearingDeg: { type: Number, default: null },
    searchLat: { type: Number },
    searchLng: { type: Number },
    cellId: { type: String },
    h3Resolution: { type: Number },
    snapOffsetM: { type: Number },
    searchSpanMeters: { type: Number, default: 1000 },
    targetRank: { type: Number, default: null },
    found: { type: Boolean, default: false },
    observationState: {
      type: String,
      enum: ['OBSERVED', 'CORRECTED', 'ESTIMATED', 'MISSING'],
      default: 'OBSERVED',
    },
    pinStatus: {
      type: String,
      enum: ['OK', 'EMPTY', 'BLOCKED', 'CAPTCHA', 'TIMEOUT', 'ERROR'],
      default: 'OK',
    },
    isDuplicateCell: { type: Boolean, default: false },
    items: [
      {
        placeId: { type: String, required: true },
        cid: { type: String },
        name: { type: String, required: true },
        address: { type: String },
        rating: { type: Number },
        reviewsCount: { type: Number },
        primaryCategory: { type: String },
        phone: { type: String },
        website: { type: String },
        lat: { type: Number },
        lng: { type: Number },
        rank: { type: Number, required: true },
        isTarget: { type: Boolean, default: false },
        matchedBy: { type: String },
      },
    ],
    scannedAt: { type: Date, default: Date.now },
    provider: { type: String, default: null },
    cached: { type: Boolean, default: false },
    latencyMs: { type: Number, default: null },
    error: { type: String, default: null },
    difficulty: { type: Number, default: null },
    attempts: { type: Number, default: 1 },
  },
  { _id: false }
);

const ScanSchema = new Schema<ScanDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    idempotencyKey: { type: String, required: true },
    keyword: { type: String, required: true, trim: true },
    searchSpanMeters: { type: Number, default: 1000 },
    scanShape: { type: String, enum: [...SCAN_SHAPES] },
    gridSize: { type: Number, enum: [...VALID_GRID_SIZES], default: DEFAULT_GRID_SIZE },
    pointCount: { type: Number, min: 1 },
    gridSpecVersion: { type: Number },
    gridSpec: {
      geometryId: { type: String },
      gridSpecVersion: { type: Number },
      centerLat: { type: Number },
      centerLng: { type: Number },
      centerSource: { type: String, enum: ['BUSINESS', 'CUSTOM'], default: 'BUSINESS' },
      radiusKm: { type: Number },
      ringFractions: [{ type: Number }],
      pinCount: { type: Number },
      spacingKm: { type: Number },
    },
    dedupeFingerprint: { type: String },
    billingCycleKey: { type: String, index: true },
    radiusKm: { type: Number, min: MIN_RADIUS_KM, max: MAX_RADIUS_KM, default: DEFAULT_RADIUS_KM },
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    localization: {
      hl: { type: String, default: 'en' },
      gl: { type: String, default: 'us' },
      device: { type: String, enum: ['DESKTOP', 'MOBILE'], default: 'DESKTOP' },
    },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'],
      default: 'QUEUED',
    },
    areaDifficulty: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: null,
    },
    credits: {
      required: { type: Number, required: true, default: 1 },
      reserved: { type: Boolean, default: true },
      charged: { type: Boolean, default: false },
      refunded: { type: Boolean, default: false },
      refundAmount: { type: Number, default: 0 },
      chargedAmount: { type: Number, default: 0 },
    },
    costTracking: {
      estimatedCostUsd: { type: Number, default: 0 },
      actualCostUsd: { type: Number, default: 0 },
      reconciled: { type: Boolean, default: false },
      reconciledAt: { type: Date, default: null },
      billingCycleKey: { type: String },
    },
    metricsVersion: { type: String, default: '2.0' },
    gridPoints: { type: [GridPointSchema], default: [] },
    rawResponses: [
      {
        provider: { type: String },
        providerRequestId: { type: String },
        parserVersion: { type: String },
        gridPoint: { type: Schema.Types.Mixed },
        fetchedAt: { type: Date },
        rawPayload: { type: Schema.Types.Mixed },
      },
    ],
    metrics: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    requeueCount: { type: Number, default: 0 },
    isPublicShareable: { type: Boolean, default: false },
    shareToken: { type: String, default: null },
    noLocalResults: { type: Boolean, default: false },
    inconclusive: { type: Boolean, default: false },
    agencyBranding: {
      agencyName: { type: String, default: null },
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: null },
      contactEmail: { type: String, default: null },
      websiteUrl: { type: String, default: null },
      notes: { type: String, default: null },
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound unique index for idempotency: scoped strictly to workspace
ScanSchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
ScanSchema.index({ workspaceId: 1, locationId: 1, createdAt: -1 });
ScanSchema.index({ shareToken: 1 }, { sparse: true });
// Only one pending run of the same keyword and scan geometry can spend credits.
ScanSchema.index(
  { workspaceId: 1, dedupeFingerprint: 1 },
  { unique: true, partialFilterExpression: { dedupeFingerprint: { $exists: true }, status: { $in: ['QUEUED', 'RUNNING'] } } }
);

export const Scan = mongoose.model<ScanDocument>('Scan', ScanSchema);

/**
 * Computes deterministic billing cycle key for a workspace and cycle start date
 */
export function computeBillingCycleKey(
  workspaceId: mongoose.Types.ObjectId | string,
  cycleStart?: Date | null
): string {
  const start = cycleStart instanceof Date ? cycleStart : new Date();
  return `${workspaceId.toString()}:${start.toISOString().slice(0, 10)}`;
}

/**
 * Atomic Scan Spend Reconciliation
 * Ensures that unused estimated spend headroom is released back to the workspace
 * exactly once, skipping spend release if workspace has already advanced to a new billing cycle.
 */
export async function reconcileScanSpend(
  scanId: mongoose.Types.ObjectId | string,
  workspaceId: mongoose.Types.ObjectId | string,
  actualCostUsd: number,
  estimatedCostUsd: number
): Promise<boolean> {
  const scan = await Scan.findOneAndUpdate(
    {
      _id: scanId,
      'costTracking.reconciled': { $ne: true },
    },
    {
      $set: {
        'costTracking.reconciled': true,
        'costTracking.actualCostUsd': actualCostUsd,
        'costTracking.estimatedCostUsd': estimatedCostUsd,
        'costTracking.reconciledAt': new Date(),
      },
    },
    { new: false }
  );

  if (!scan) {
    return false; // Already reconciled
  }

  const spendDiff = Number((actualCostUsd - estimatedCostUsd).toFixed(4));
  if (spendDiff !== 0) {
    const { Workspace } = await import('./Workspace');
    const ws = await Workspace.findById(workspaceId);

    if (ws) {
      // Check if workspace billing cycle has rolled over since scan was created
      const currentCycleKey = computeBillingCycleKey(workspaceId, ws.spendLimits?.billingCycleStart);
      const scanCycleKey = scan.billingCycleKey || scan.costTracking?.billingCycleKey;

      if (scanCycleKey && scanCycleKey !== currentCycleKey) {
        console.log(`[Spend Reconciliation] Scan ${scanId} belongs to prior billing cycle (${scanCycleKey} vs ${currentCycleKey}). Skipping spend adjust.`);
        return true;
      }

      await Workspace.findByIdAndUpdate(workspaceId, {
        $inc: { 'spendLimits.currentMonthSpendUsd': spendDiff },
      });
    }
  }

  return true;
}

/**
 * Sweeper for terminal scans and abandoned RUNNING reservations.
 */
export async function sweepUnreconciledScans(maxAgeMinutes: number = 5): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const unreconciled = await Scan.find({
    $or: [
      { status: { $in: ['COMPLETED', 'PARTIAL', 'FAILED'] }, createdAt: { $lt: cutoff } },
      { status: 'RUNNING', updatedAt: { $lt: new Date(Date.now() - Math.max(maxAgeMinutes * 60 * 1000, 30 * 60 * 1000)) } },
    ],
    'costTracking.reconciled': { $ne: true },
  }).limit(50);

  let count = 0;
  for (const scan of unreconciled) {
    if (scan.status === 'RUNNING') {
      const expired = await Scan.findOneAndUpdate(
        { _id: scan._id, status: 'RUNNING', updatedAt: { $lt: new Date(Date.now() - Math.max(maxAgeMinutes * 60 * 1000, 30 * 60 * 1000)) } },
        { $set: { status: 'FAILED', error: 'Scan worker stopped before completion', completedAt: new Date() } },
        { new: true }
      );
      if (!expired) continue;
      await refundScanCredit(expired._id, expired.workspaceId, expired.credits.required);
    }
    const livePoints = (scan.gridPoints || []).filter(
      (p: any) => p.observationState === 'OBSERVED' && !p.cached
    ).length;
    const estCost = scan.costTracking?.estimatedCostUsd || ((scan.pointCount || 9) * 0.002);
    const actCost = scan.status === 'FAILED' || scan.status === 'RUNNING' ? 0.0 : Number((livePoints * 0.002).toFixed(4));
    const ok = await reconcileScanSpend(scan._id, scan.workspaceId, actCost, estCost);
    if (ok) count++;
  }
  return count;
}

/**
 * Atomic Scan Credit Refund
 * Ensures that refund can never double-fire even if DLQ/worker handler retries
 */
export async function refundScanCredit(
  scanId: mongoose.Types.ObjectId | string,
  workspaceId: mongoose.Types.ObjectId | string,
  amount: number
): Promise<boolean> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be positive and finite');
  const scan = await Scan.findOneAndUpdate(
    {
      _id: scanId,
      workspaceId,
      'credits.refunded': { $ne: true },
    },
    {
      $set: {
        'credits.refunded': true,
        'credits.refundAmount': amount,
      },
    },
    { new: false }
  );

  if (!scan) {
    return false; // Already refunded by another worker/thread
  }

  const { Workspace } = await import('./Workspace');
  await Workspace.findByIdAndUpdate(workspaceId, {
    $inc: { 'limits.scanCredits': amount },
  });

  return true;
}

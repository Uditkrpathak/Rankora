import mongoose, { Schema, Document } from 'mongoose';
import { IRankItem } from '@localo/types';

export interface SerpSnapshotDocument extends Document {
  cacheKey: string;
  cellId: string;
  resolution: number;
  provider: string;
  keywordNorm: string;
  lat: number;
  lng: number;
  radiusKm: number;
  hl: string;
  gl: string;
  dateBucket: string;
  items: IRankItem[];
  empty: boolean;
  rawPayload?: any;
  providerRequestId?: string;
  parserVersion?: string;
  costUsd?: number;
  fetchedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SerpSnapshotItemSchema = new Schema(
  {
    placeId: { type: String, required: true },
    name: { type: String, required: true },
    address: { type: String },
    rating: { type: Number },
    reviewsCount: { type: Number },
    primaryCategory: { type: String },
    phone: { type: String },
    website: { type: String },
    rank: { type: Number, required: true },
    isTarget: { type: Boolean, default: false },
  },
  { _id: false }
);

const SerpSnapshotSchema = new Schema<SerpSnapshotDocument>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    cellId: { type: String, required: true, index: true },
    resolution: { type: Number, required: true },
    provider: { type: String, required: true },
    keywordNorm: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusKm: { type: Number, required: true, default: 3.5 },
    hl: { type: String, default: 'en' },
    gl: { type: String, default: 'us' },
    dateBucket: { type: String, required: true },
    items: { type: [SerpSnapshotItemSchema], default: [] },
    empty: { type: Boolean, default: false },
    rawPayload: { type: Schema.Types.Mixed },
    providerRequestId: { type: String },
    parserVersion: { type: String, default: '1.0' },
    costUsd: { type: Number, default: 0.002 },
    fetchedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL Index for automatic background purge of expired snapshots
SerpSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SerpSnapshotSchema.index({ keywordNorm: 1, cellId: 1 });

/**
 * Calculates SERP spatial cache TTL in seconds.
 * Per S3 Spec: Default 60h, configurable between 48h and 72h via SERP_CACHE_TTL_HOURS.
 * Verified-genuine empty results get a 1h TTL (3600 seconds).
 */
export function getSerpCacheTtlSeconds(isEmpty = false): number {
  if (isEmpty) return 3600; // 1 hour for verified genuine empty results
  const envHours = parseFloat(process.env.SERP_CACHE_TTL_HOURS || '60');
  const clampedHours = Math.max(48, Math.min(72, isNaN(envHours) ? 60 : envHours));
  return Math.round(clampedHours * 3600);
}

/**
 * Computes deterministic canonical cacheKey for an H3 cell SERP search in Redis.
 *
 * SPEC S3 SPECIFICATION:
 * - Format: v2:{keyword-normalized}:{h3CellId}:{hl}:{gl}:{device}
 * - No UTC date bucket in the key (prevents artificial midnight UTC expirations).
 * - Key includes device ('mobile' | 'desktop') matching request emulation.
 * - H3 Resolution Architecture: Resolution 7/8 (~460m - 1.2km) matches urban local
 *   search intent without excessive fragmentation.
 * - Cross-Tenant Sharing: The spatial cache is intentionally shared across ALL tenants.
 *   Google Maps rankings for a geographic coordinate and query are public and identical
 *   across users; cross-tenant sharing eliminates duplicate scrapes and achieves the
 *   ₹3-5/month unit cost target.
 */
export function generateSnapshotCacheKey(
  keywordOrProvider: string,
  cellIdOrKeyword: string,
  cellIdOrHl?: string,
  hlOrGl?: string,
  glOrDevice?: string,
  deviceParam?: 'mobile' | 'desktop'
): string {
  // Support both 5-arg new signature and legacy 6-arg signature
  let keyword: string;
  let cellId: string;
  let hl: string;
  let gl: string;
  let device: string;

  if (deviceParam !== undefined || (glOrDevice && (glOrDevice === 'mobile' || glOrDevice === 'desktop'))) {
    // Could be 6-arg or 5-arg
    if (deviceParam) {
      // Legacy: (provider, keyword, cellId, hl, gl, device)
      keyword = cellIdOrKeyword;
      cellId = cellIdOrHl || '';
      hl = hlOrGl || 'en';
      gl = glOrDevice || 'in';
      device = deviceParam;
    } else {
      // New 5-arg: (keyword, cellId, hl, gl, device)
      keyword = keywordOrProvider;
      cellId = cellIdOrKeyword;
      hl = cellIdOrHl || 'en';
      gl = hlOrGl || 'in';
      device = glOrDevice || 'mobile';
    }
  } else {
    // 5-arg with default device or 4-arg:
    keyword = keywordOrProvider;
    cellId = cellIdOrKeyword;
    hl = cellIdOrHl || 'en';
    gl = hlOrGl || 'in';
    device = 'mobile';
  }

  const normKw = keyword.trim().toLowerCase().replace(/\s+/g, ' ');
  const normDevice = device.toLowerCase() === 'desktop' ? 'desktop' : 'mobile';
  return `v2:${normKw}:${cellId}:${hl.toLowerCase()}:${gl.toLowerCase()}:${normDevice}`;
}

export const SerpSnapshot = mongoose.model<SerpSnapshotDocument>('SerpSnapshot', SerpSnapshotSchema);

export type ObservationState = 'OBSERVED' | 'CORRECTED' | 'ESTIMATED' | 'MISSING';
export type ScanStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
export type ScanShape = 'GRID' | 'RINGS' | 'SUNFLOWER' | 'QUICK';

export interface IGridCoordinate {
  lat: number;
  lng: number;
  row: number;
  col: number;
  pinIndex?: number;
  ring?: number;
  ringIndex?: number;
  distanceKm?: number;
  bearingDeg?: number | null;
  searchLat?: number;
  searchLng?: number;
  cellId?: string;
  h3Resolution?: number;
  snapOffsetM?: number;
}

export interface IScanGridSpec {
  geometryId: string;
  gridSpecVersion: number;
  centerLat: number;
  centerLng: number;
  centerSource: 'BUSINESS' | 'CUSTOM';
  radiusKm: number;
  ringFractions: number[];
  pinCount: number;
  spacingKm: number;
}

export interface IRankItem {
  placeId: string;
  cid?: string;
  name: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  primaryCategory?: string;
  phone?: string;
  website?: string;
  lat?: number;
  lng?: number;
  rank: number;
  isTarget: boolean;
  matchedBy?: string;
}

export type GridPinStatus = 'OK' | 'EMPTY' | 'BLOCKED' | 'CAPTCHA' | 'TIMEOUT' | 'ERROR' | 'DUPLICATE';

export interface IGridPointResult {
  lat: number;
  lng: number;
  row: number;
  col: number;
  pinIndex?: number;
  ring?: number;
  ringIndex?: number;
  distanceKm?: number;
  bearingDeg?: number | null;
  searchLat?: number;
  searchLng?: number;
  cellId?: string;
  h3Resolution?: number;
  snapOffsetM?: number;
  targetRank: number | null; // null if > 20 or not found
  observationState: ObservationState;
  pinStatus?: GridPinStatus;
  isDuplicateCell?: boolean;
  items: IRankItem[];
  scannedAt: Date;
  provider?: string;
  error?: string | null;
  costUsd?: number;
  cached?: boolean;
  difficulty?: number; // 0-10 competition difficulty score
}

export type TaskCategory = 'REVIEWS' | 'RATING' | 'PHOTOS' | 'POSTS' | 'PROFILE' | 'CATEGORIES';
export type TaskImpact = 'HIGH' | 'MEDIUM' | 'LOW';

export interface IRecommendedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  impact: TaskImpact;
  priority: number;
  actionUrl?: string;
  sourceLabel?: string;
  metrics?: {
    targetValue: number | string;
    competitorMedian: number | string;
    gap?: number | string;
  };
  generatedAt: string | Date;
}

export interface IRankMetrics {
  arp: number | null; // Average Rank Position (observed ranked points only; null if unranked)
  atrp: number; // Average Total Rank Position (unranked default to 21)
  solv: number; // Share of Local Voice (% of grid points in Top 3)
  coverage: number; // Coverage (% of grid points in Top 20)
  visibilityIndex: number; // Sum(w(r)) / Sum(w(1)) * 100
  top3Count: number;
  top10Count: number;
  top20Count: number;
  unrankedCount: number;
  missingCount: number;
  observedCount?: number; // Points with an actual provider response; excludes MISSING.
  totalPoints: number;
}

export interface IScanLocalization {
  hl: string; // language code e.g. 'en'
  gl: string; // country code e.g. 'us'
  device?: 'DESKTOP' | 'MOBILE';
}

export interface IScanRun {
  _id: string;
  workspaceId: string;
  locationId: string;
  idempotencyKey: string;
  keyword: string;
  scanShape?: ScanShape; // Historical square scans have no scanShape field.
  gridSize: number; // 3, 5, 7, 9, 11, 13
  pointCount?: number; // Historical square scans fall back to gridSize².
  radiusKm: number;
  gridSpec?: IScanGridSpec;
  center: {
    lat: number;
    lng: number;
  };
  localization: IScanLocalization;
  status: ScanStatus;
  areaDifficulty?: 'LOW' | 'MEDIUM' | 'HIGH';
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
    providerCostRecorded: boolean;
  };
  gridPoints: IGridPointResult[];
  metrics?: IRankMetrics | null;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceDashboardMetrics {
  avgLocalRank: number | null;
  avgVisibilityScore: number | null;
  gbpHealthIndex: number | null;
  coverage: {
    totalLocations: number;
    scannedLocations: number;
    auditedLocations: number;
  };
  auditPillars: {
    profileCompleteness: number;
    keywords: number;
    media: number;
    reviews: number;
    citations: number;
  };
  auditFreshness: {
    newestAuditAt?: Date | string | null;
    oldestAuditAt?: Date | string | null;
    hasStaleAudits: boolean;
  };
  rankMomentum: Array<{
    date: string;
    avgRank: number;
    visibilityScore: number;
    scanCount: number;
  }>;
}

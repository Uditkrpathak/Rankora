export type VolumeSource = 'live' | 'cached' | 'estimated_band';

export type KeywordScanStatus = 'NOT_SCANNED' | 'QUEUED' | 'SCANNING' | 'SCANNED' | 'PARTIAL' | 'FAILED' | 'NO_LOCAL_RESULTS';

export type KeywordRankState = 'RANKED' | 'NOT_IN_TOP_20' | 'UNKNOWN';
export type VolumeTier = 'POPULAR' | 'MEDIUM' | 'LOW';
export type GridType = 'QUICK' | 'SMART_GRID';
export type KeywordSource = 'MANUAL' | 'SUGGESTION' | 'RECOMMENDED_SEED' | 'GOOGLE_AUTOCOMPLETE' | 'LEGACY';

export interface ISparklinePoint {
  date: Date | string;
  rank: number | null;
  visibility: number;
  scanId?: string;
}

export interface ITrackedKeyword {
  _id?: string;
  id?: string;
  workspaceId: string;
  locationId: string;
  keyword: string;
  normalizedKeyword: string;
  monthlySearchVolume: number | null;
  volumeSource: VolumeSource;
  volumeBand: string | null;
  volumeTier?: VolumeTier;
  hasLocalPack: boolean;
  triggersLocalPack?: boolean;
  currentRank: number | null;
  overallRank?: number | null;
  totalCompetitors?: number | null;
  previousRank: number | null;
  rankState?: KeywordRankState;
  visibilityScore: number;
  visibilityDelta: number;
  sparkline: ISparklinePoint[];
  lastScannedAt: Date | string | null;
  /** Provider used for the latest completed observation; null means unknown or never scanned. */
  lastProvider?: string | null;
  /** Last queue/setup error when no scan snapshot exists yet. */
  lastScanError?: string | null;
  scanStatus?: KeywordScanStatus;
  gridType?: GridType;
  source?: KeywordSource;
  lastScanId?: string | null;
  status: 'active' | 'paused';
  scanFrequency: 'manual' | 'daily' | 'weekly';
  gridSize: number;
  radiusKm: number;
  nextScheduledAt: Date | string | null;
  gscMetrics?: {
    clicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
    lastSyncedAt: Date | string;
  } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ITrackedKeywordSettings {
  status?: 'active' | 'paused';
  scanFrequency?: 'manual' | 'daily' | 'weekly';
  gridSize?: number;
  radiusKm?: number;
}

export interface IBulkAddKeywordsInput {
  keywords: string[];
}

export interface IKeywordsListResponse {
  keywords: ITrackedKeyword[];
  total: number;
  page: number;
  pages: number;
}

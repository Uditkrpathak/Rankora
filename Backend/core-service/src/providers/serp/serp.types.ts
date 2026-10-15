import { IScanLocalization, ObservationState } from '@localo/types';

export type GridPinStatus = 'OK' | 'EMPTY' | 'BLOCKED' | 'CAPTCHA' | 'TIMEOUT' | 'ERROR';

export interface SERPItem {
  placeId: string;
  cid?: string;
  name: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  primaryCategory?: string;
  phone?: string;
  website?: string;
  photoUrl?: string;
  lat?: number;
  lng?: number;
  rank: number;
  isTarget?: boolean;
  matchedBy?: string;
}

export type ParseStatus = 'OK' | 'BLOCKED' | 'CAPTCHA' | 'PARSE_ERROR' | 'EMPTY_VALID';

export interface SERPResult {
  provider: string;
  providerRequestId?: string;
  parserVersion: string;
  status?: ParseStatus;
  pinStatus?: GridPinStatus;
  items: SERPItem[];
  empty?: boolean;
  rawPayload: any;
  rawPayloadDebug?: string;
  fetchedAt: Date;
  dataAsOf?: Date;
  cached?: boolean;
  costUsd?: number;
  wireBytes?: number;
  decodedBytes?: number;
  contentEncoding?: string;
  latencyMs?: number;
  snappedLat?: number;
  snappedLng?: number;
  cellId?: string;
  h3Resolution?: number;
  cascadeTierUsed?: 'datacenter' | 'residential';
  cascadeGatewayKey?: string;
  cascadeAttempts?: any[];
}

export interface SERPOptions {
  keyword: string;
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  searchSpanMeters?: number; // Configurable search span: 500, 1000 (default), 2000, 5000, 10000
  radiusKm?: number;
  cellId?: string;
  h3Resolution?: number;
  maxAgeHours?: number; // Legacy freshness window in hours
  maxAgeMinutes?: number; // Freshness window for on-demand re-scans (default 60 min)
  forceFresh?: boolean; // Force fresh live search bypassing cache
  bypassCache?: boolean; // Alias for forceFresh (bypasses spatial cache)
  scheduled?: boolean; // Scheduled scan flag (uses full 48-72h TTL)
  device?: 'mobile' | 'desktop'; // Mobile vs desktop request emulation and cache isolation
  localization: IScanLocalization;
  targetPlaceId?: string;
  targetName?: string;
}

export interface IProxyProvider {
  name: string;
  getProxy(sessionId?: string): Promise<{ proxyUrl?: string; dispatcher?: any; sessionId?: string }>;
  reportSuccess(sessionId: string): void;
  reportFailure(sessionId: string, error: any): void;
}

export interface NormalizedPlace {
  placeId: string;
  cid?: string;
  name: string;
  address?: string;
  rating?: number | null;
  reviewsCount?: number | null;
  primaryCategory?: string;
  phone?: string;
  website?: string;
  lat?: number;
  lng?: number;
  rank: number;
  isTarget?: boolean;
}

export interface TargetMatchCriteria {
  placeId?: string | null;
  cid?: string | null;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

export interface ISERPProvider {
  name: string;
  search(options: SERPOptions): Promise<SERPResult>;
}

export interface CascadeRoutingResult extends SERPResult {
  tierUsed: 'datacenter' | 'residential' | 'cached';
  attemptsCount: number;
  formatChangedAlert?: boolean;
}

export const SERP_PROVIDER_COST_USD: Record<string, number> = {
  GOOGLE_MAPS_HTTP: 0.000,
  MOCK: 0.000,
};



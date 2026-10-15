export type GbpConnectionStatus = 'CONNECTED' | 'EXPIRED' | 'REVOKED';

export type GbpSyncStatus = 'SYNCED' | 'PENDING' | 'ERROR' | 'STANDALONE';

export type LocationAddedVia = 'gbp_import' | 'places_search' | 'manual_entry';

export type CoordinatesSource = 'PLACES_API' | 'GEOCODED' | 'USER_CONFIRMED' | 'MOCK_FALLBACK';

export interface IGbpCategory {
  id: string;
  displayName: string;
}

export interface IGbpHourPeriod {
  open: string;
  close: string;
  isClosed: boolean;
}

export interface IGbpSpecialHour {
  date: string;
  open?: string;
  close?: string;
  isClosed: boolean;
}

export interface IGoogleConnection {
  _id: string;
  workspaceId: string;
  connectedByUserId: string;
  googleEmail: string;
  googleAccountId: string;
  encryptedRefreshToken: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  scopes: string[];
  status: GbpConnectionStatus;
  lastRefreshError?: string | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOAuthState {
  _id: string;
  token: string;
  workspaceId: string;
  userId: string;
  createdAt: Date;
  used: boolean;
}

export interface IGbpDiscoveredLocation {
  gbpLocationId: string;
  gbpAccountId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  coordinates?: { lat: number; lng: number } | null;
  placeId?: string | null;
  primaryCategory?: IGbpCategory | null;
  secondaryCategories?: IGbpCategory[];
  phone?: string;
  website?: string;
  description?: string;
  regularHours?: Record<string, IGbpHourPeriod>;
  photosCount?: number;
  coverPhotoUrl?: string;
  logoUrl?: string;
  mediaSyncedAt?: string;
  mediaSyncError?: string;
  isImported?: boolean;
  importedLocationId?: string | null;
  accountEmail?: string;
  needsUpgrade?: boolean;
}

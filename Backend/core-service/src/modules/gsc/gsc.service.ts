import mongoose from 'mongoose';
import { ENV } from '../../config/env';
import { Location } from '../../models/Location';
import { TrackedKeyword } from '../../models/TrackedKeyword';
import { GscQueryDaily } from '../../models/GscQueryDaily';
import { googleVaultService } from '../google/google-vault.service';

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscQueryAnalyticsParams {
  siteUrl: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
}

export interface GscRow {
  keys: string[]; // [query, page, date, device]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface AggregatedGscQuery {
  query: string;
  normalizedQuery: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

export interface OpportunityQueriesResult {
  discovered: AggregatedGscQuery[];
  strikingDistance: AggregatedGscQuery[];
}

/**
 * Normalizes search queries for consistent keyword matching:
 * - Lowercase and trim
 * - Collapse consecutive whitespace
 * - Strip intent modifiers: "near me", "nearby"
 * - Strip location city name if provided
 * - Cleans dangling punctuation while preserving alphanumeric tokens
 */
export function normalizeQuery(rawQuery: string, cityName?: string): string {
  if (!rawQuery) return '';

  let normalized = rawQuery.toLowerCase().trim();

  // Strip "near me" and "nearby"
  normalized = normalized.replace(/\bnear\s+me\b/gi, ' ');
  normalized = normalized.replace(/\bnearby\b/gi, ' ');

  // Strip city name if provided
  if (cityName && cityName.trim().length > 1) {
    const escapedCity = cityName.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(`\\b${escapedCity}\\b`, 'gi'), ' ');
  }

  // Collapse spaces and strip leading/trailing non-alphanumeric punctuation
  normalized = normalized
    .replace(/[^\w\s\u0900-\u097F]/g, ' ') // support unicode devanagari if applicable
    .replace(/\s+/g, ' ')
    .trim();

  // If stripping left nothing, fallback to simple clean of the original query
  if (!normalized) {
    normalized = rawQuery.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  return normalized;
}

/**
 * Computes impression-weighted average position for a set of query data points.
 * Formula: SUM(position * impressions) / SUM(impressions)
 * Avoids the severe mathematical distortion of naive unweighted averaging.
 */
export function calculateImpressionWeightedPosition(
  items: Array<{ position: number; impressions: number }>
): number {
  if (!items || items.length === 0) return 0;

  let totalImpressions = 0;
  let weightedPositionSum = 0;

  for (const item of items) {
    const imp = Math.max(0, item.impressions || 0);
    totalImpressions += imp;
    weightedPositionSum += (item.position || 0) * imp;
  }

  if (totalImpressions === 0) {
    return 0;
  }

  return Math.round((weightedPositionSum / totalImpressions) * 10) / 10;
}

/**
 * Groups raw rows by normalized query and aggregates clicks, impressions, ctr,
 * and impression-weighted position.
 */
export function aggregateRowsByQuery(
  rows: Array<{ query: string; normalizedQuery?: string; clicks: number; impressions: number; position: number }>,
  cityName?: string
): Map<string, AggregatedGscQuery> {
  const queryMap = new Map<
    string,
    {
      originalQuery: string;
      normalizedQuery: string;
      clicks: number;
      impressions: number;
      weightedPositionSum: number;
    }
  >();

  for (const row of rows) {
    const key = row.normalizedQuery || normalizeQuery(row.query, cityName);
    const existing = queryMap.get(key);

    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const pos = row.position || 0;

    if (!existing) {
      queryMap.set(key, {
        originalQuery: row.query,
        normalizedQuery: key,
        clicks,
        impressions,
        weightedPositionSum: pos * impressions,
      });
    } else {
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.weightedPositionSum += pos * impressions;
    }
  }

  const results = new Map<string, AggregatedGscQuery>();
  for (const [key, val] of queryMap.entries()) {
    const avgPos =
      val.impressions > 0
        ? Math.round((val.weightedPositionSum / val.impressions) * 10) / 10
        : 0;
    const ctr =
      val.impressions > 0
        ? Math.round((val.clicks / val.impressions) * 10000) / 10000
        : 0;

    results.set(key, {
      query: val.originalQuery,
      normalizedQuery: key,
      clicks: val.clicks,
      impressions: val.impressions,
      ctr,
      averagePosition: avgPos,
    });
  }

  return results;
}

export class GscService {
  /**
   * Helper to execute fetch with exponential backoff on 429 and 5xx errors
   */
  private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    let attempt = 0;
    let delayMs = 1000;

    while (true) {
      attempt++;
      try {
        const response = await fetch(url, options);

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt <= maxRetries) {
            const jitter = Math.random() * 300;
            console.warn(`[GSC] Rate limit / server error (${response.status}). Retrying in ${delayMs + jitter}ms... (Attempt ${attempt}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
            delayMs *= 2;
            continue;
          }
        }

        return response;
      } catch (err: any) {
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Lists verified sites for the connected user.
   * Excludes sites where permissionLevel is 'siteUnverifiedUser'.
   * Supports both domain properties ('sc-domain:example.com') and URL prefix ('https://example.com/').
   */
  public async listVerifiedSites(accessToken: string): Promise<GscSite[]> {
    const url = 'https://www.googleapis.com/webmasters/v3/sites';
    const res = await this.fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        const err: any = new Error(errorData?.error?.message || 'Unauthorized or insufficient GSC scopes');
        err.statusCode = res.status;
        err.code = res.status === 403 ? 'GSC_INSUFFICIENT_SCOPE' : 'GSC_UNAUTHORIZED';
        throw err;
      }
      throw new Error(`GSC sites fetch failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    const siteEntries = data.siteEntry || [];

    return siteEntries
      .filter((site: any) => site.permissionLevel && site.permissionLevel !== 'siteUnverifiedUser')
      .map((site: any) => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      }));
  }

  /**
   * Queries search analytics with automatic pagination up to full date range.
   * Default dimensions: ["query", "page", "date", "device"].
   * Default endDate: today minus 3 days (accounting for GSC ~2-3 day data lag).
   */
  public async querySearchAnalytics(
    accessToken: string,
    params: GscQueryAnalyticsParams
  ): Promise<GscRow[]> {
    const {
      siteUrl,
      dimensions = ['query', 'page', 'date', 'device'],
      rowLimit = 25000,
    } = params;

    // Default dates
    const now = new Date();
    const defaultEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate || defaultEnd.toISOString().split('T')[0];

    const defaultStart = new Date(defaultEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
    const startDate = params.startDate || defaultStart.toISOString().split('T')[0];

    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    const allRows: GscRow[] = [];
    let startRow = params.startRow ?? 0;
    const fetchLimit = Math.min(rowLimit, 25000);

    while (true) {
      const payload = {
        startDate,
        endDate,
        dimensions,
        rowLimit: fetchLimit,
        startRow,
        dataState: 'final',
      };

      const res = await this.fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const err: any = new Error(errData?.error?.message || 'GSC permission denied');
          err.statusCode = res.status;
          err.code = res.status === 403 ? 'GSC_INSUFFICIENT_SCOPE' : 'GSC_UNAUTHORIZED';
          throw err;
        }
        throw new Error(`GSC querySearchAnalytics failed with status ${res.status}`);
      }

      const data = await res.json();
      const rows: GscRow[] = data.rows || [];

      if (rows.length === 0) {
        break;
      }

      allRows.push(...rows);

      if (rows.length < fetchLimit) {
        // Less than rowLimit returned means we've reached the end
        break;
      }

      startRow += rows.length;

      // Hard safety guard: avoid infinite looping beyond 250,000 rows in single run
      if (allRows.length >= 250000) {
        break;
      }
    }

    return allRows;
  }

  /**
   * Synchronizes Search Console data for a given location:
   * - First sync: pulls up to 16 months (last 480 days).
   * - Incremental sync: pulls last 7 days (Google revises recent days).
   * - Upserts rows into GscQueryDaily in batches.
   * - Updates Location.gscLastSyncedAt and Location.gscConnectionStatus.
   * - Automatically recalculates and writes keyword metrics.
   */
  public async syncLocation(locationId: string): Promise<{ totalUpserted: number; siteUrl: string }> {
    const loc = await Location.findById(locationId);
    if (!loc) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    if (!loc.gscSiteUrl) {
      const err: any = new Error('LOCATION_NOT_CONNECTED_TO_GSC');
      err.statusCode = 400;
      throw err;
    }

    const workspaceId = loc.workspaceId.toString();

    // Fetch active access token from GoogleVaultService
    let accessToken: string;
    try {
      accessToken = await googleVaultService.getValidAccessToken(
        workspaceId,
        undefined,
        'https://www.googleapis.com/auth/webmasters.readonly'
      );
    } catch (err: any) {
      if (err.message === 'GOOGLE_CONNECTION_REVOKED' || err.statusCode === 409) {
        await Location.findByIdAndUpdate(locationId, { gscConnectionStatus: 'needs_reauth' });
      }
      throw err;
    }

    // Determine start date based on whether data was ever synced
    const now = new Date();
    const endTimestamp = now.getTime() - 3 * 24 * 60 * 60 * 1000;
    const endDate = new Date(endTimestamp).toISOString().split('T')[0];

    const isFirstSync = !loc.gscLastSyncedAt;
    const startTimestamp = isFirstSync
      ? endTimestamp - 480 * 24 * 60 * 60 * 1000 // ~16 months
      : endTimestamp - 7 * 24 * 60 * 60 * 1000;   // last 7 days

    const startDate = new Date(startTimestamp).toISOString().split('T')[0];

    let rows: GscRow[];
    try {
      rows = await this.querySearchAnalytics(accessToken, {
        siteUrl: loc.gscSiteUrl,
        startDate,
        endDate,
        dimensions: ['query', 'page', 'date', 'device'],
      });
    } catch (err: any) {
      if (err.code === 'GSC_INSUFFICIENT_SCOPE' || err.code === 'GSC_UNAUTHORIZED') {
        await Location.findByIdAndUpdate(locationId, { gscConnectionStatus: 'needs_reauth' });
      }
      throw err;
    }

    // Upsert into GscQueryDaily in batches of 1,000
    const locationObjectId = new mongoose.Types.ObjectId(locationId);
    const BATCH_SIZE = 1000;
    let totalUpserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const bulkOps = batch.map((row) => {
        const query = row.keys[0] || '';
        const page = row.keys[1] || '';
        const date = row.keys[2] || '';
        const device = row.keys[3] || 'DESKTOP';
        const normalized = normalizeQuery(query, loc.city);

        return {
          updateOne: {
            filter: {
              locationId: locationObjectId,
              date,
              query,
              page,
              device,
            },
            update: {
              $set: {
                locationId: locationObjectId,
                siteUrl: loc.gscSiteUrl || '',
                date,
                query,
                normalizedQuery: normalized,
                page,
                device,
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0,
                syncedAt: new Date(),
              },
            },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0) {
        await GscQueryDaily.bulkWrite(bulkOps as any, { ordered: false });
        totalUpserted += bulkOps.length;
      }
    }

    // Update location sync metadata
    await Location.findByIdAndUpdate(locationId, {
      gscConnectionStatus: 'connected',
      gscLastSyncedAt: new Date(),
    });

    // Recalculate metrics for all currently tracked keywords
    await this.matchTrackedKeywords(locationId);

    return { totalUpserted, siteUrl: loc.gscSiteUrl };
  }

  /**
   * Aggregates the last 28 days from GscQueryDaily per normalized query
   * and writes the mapped metrics into TrackedKeyword.gscMetrics.
   */
  public async matchTrackedKeywords(locationId: string): Promise<number> {
    const loc = await Location.findById(locationId);
    if (!loc) return 0;

    const locationObjectId = new mongoose.Types.ObjectId(locationId);

    // Compute 28-day window boundary in YYYY-MM-DD
    const cutoffDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Aggregate queries from GscQueryDaily for this location
    const aggregated = await GscQueryDaily.aggregate([
      {
        $match: {
          locationId: locationObjectId,
          date: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: '$normalizedQuery',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          weightedPositionSum: { $sum: { $multiply: ['$position', '$impressions'] } },
        },
      },
    ]);

    const metricsMap = new Map<
      string,
      { clicks: number; impressions: number; ctr: number; averagePosition: number }
    >();

    for (const item of aggregated) {
      const imp = item.impressions || 0;
      const clicks = item.clicks || 0;
      const ctr = imp > 0 ? Math.round((clicks / imp) * 10000) / 10000 : 0;
      const avgPos = imp > 0 ? Math.round((item.weightedPositionSum / imp) * 10) / 10 : 0;

      metricsMap.set(item._id, {
        clicks,
        impressions: imp,
        ctr,
        averagePosition: avgPos,
      });
    }

    // Find all active tracked keywords
    const keywords = await TrackedKeyword.find({ locationId: locationObjectId });
    if (keywords.length === 0) return 0;

    const now = new Date();
    const bulkOps = keywords.map((kw) => {
      const norm = normalizeQuery(kw.keyword, loc.city);
      const metrics = metricsMap.get(norm) || {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        averagePosition: 0,
      };

      return {
        updateOne: {
          filter: { _id: kw._id },
          update: {
            $set: {
              gscMetrics: {
                ...metrics,
                lastSyncedAt: now,
              },
            },
          },
        },
      };
    });

    if (bulkOps.length > 0) {
      await TrackedKeyword.bulkWrite(bulkOps as any, { ordered: false });
    }

    return keywords.length;
  }

  /**
   * Detects high-opportunity queries from the last 28 days that:
   * a) are NOT already tracked (comparing normalized forms)
   * b) have impressions above threshold (default 50)
   * c) splits into:
   *    - discovered: top by impressions
   *    - strikingDistance: average position 8-20, sorted by impressions
   */
  public async detectHighOpportunityQueries(
    locationId: string,
    minImpressions: number = ENV.GSC_MIN_IMPRESSIONS
  ): Promise<OpportunityQueriesResult> {
    const loc = await Location.findById(locationId);
    if (!loc) {
      return { discovered: [], strikingDistance: [] };
    }

    const locationObjectId = new mongoose.Types.ObjectId(locationId);

    // Active tracked keywords normalized set
    const tracked = await TrackedKeyword.find({ locationId: locationObjectId }, { keyword: 1, normalizedKeyword: 1 });
    const trackedSet = new Set<string>();
    for (const t of tracked) {
      trackedSet.add(normalizeQuery(t.keyword, loc.city));
      if (t.normalizedKeyword) {
        trackedSet.add(t.normalizedKeyword);
      }
    }

    // 28 days cutoff
    const cutoffDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const aggregated = await GscQueryDaily.aggregate([
      {
        $match: {
          locationId: locationObjectId,
          date: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: '$normalizedQuery',
          originalQuery: { $first: '$query' },
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          weightedPositionSum: { $sum: { $multiply: ['$position', '$impressions'] } },
        },
      },
      {
        $match: {
          impressions: { $gte: minImpressions },
        },
      },
    ]);

    const candidates: AggregatedGscQuery[] = [];

    for (const item of aggregated) {
      const normKey = item._id;
      // Filter out queries already tracked
      if (trackedSet.has(normKey)) {
        continue;
      }

      const imp = item.impressions || 0;
      const clicks = item.clicks || 0;
      const ctr = imp > 0 ? Math.round((clicks / imp) * 10000) / 10000 : 0;
      const avgPos = imp > 0 ? Math.round((item.weightedPositionSum / imp) * 10) / 10 : 0;

      candidates.push({
        query: item.originalQuery,
        normalizedQuery: normKey,
        clicks,
        impressions: imp,
        ctr,
        averagePosition: avgPos,
      });
    }

    // Sort all by impressions descending
    candidates.sort((a, b) => b.impressions - a.impressions);

    // Split into discovered and striking distance
    const discovered = candidates.slice(0, 30);
    const strikingDistance = candidates
      .filter((q) => q.averagePosition >= 8 && q.averagePosition <= 20)
      .slice(0, 30);

    return { discovered, strikingDistance };
  }

  /**
   * Retrieves verified GSC properties for a given workspace.
   */
  public async getSitesForWorkspace(workspaceId: string): Promise<GscSite[]> {
    const accessToken = await googleVaultService.getValidAccessToken(
      workspaceId,
      undefined,
      'https://www.googleapis.com/auth/webmasters.readonly'
    );
    return this.listVerifiedSites(accessToken);
  }

  /**
   * Retrieves performance metrics for a location over a specified range ('28d' or '90d').
   * Returns explicit empty state status ('not_connected' | 'no_data_yet') when appropriate.
   */
  public async getPerformanceHistory(locationId: string, range: '28d' | '90d' = '28d') {
    const loc = await Location.findById(locationId);
    if (!loc) {
      const err: any = new Error('Location not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!loc.gscSiteUrl || loc.gscConnectionStatus !== 'connected') {
      return {
        status: 'not_connected' as const,
        message: 'Google Search Console is not connected for this location.',
        dataNotes: GSC_DATA_NOTES,
      };
    }

    const locationObjectId = new mongoose.Types.ObjectId(locationId);
    const rowCount = await GscQueryDaily.countDocuments({ locationId: locationObjectId });
    if (rowCount === 0) {
      return {
        status: 'no_data_yet' as const,
        message: 'Search Console data is synchronizing or no organic impressions have been recorded yet.',
        dataNotes: GSC_DATA_NOTES,
      };
    }

    const days = range === '90d' ? 90 : 28;
    const cutoffDate = new Date(Date.now() - (days + 3) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const dailyAggregations = await GscQueryDaily.aggregate([
      {
        $match: {
          locationId: locationObjectId,
          date: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: '$date',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          weightedPositionSum: { $sum: { $multiply: ['$position', '$impressions'] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    let totalClicks = 0;
    let totalImpressions = 0;
    let totalWeightedPosition = 0;

    const daily = dailyAggregations.map((item) => {
      const clicks = item.clicks || 0;
      const impressions = item.impressions || 0;
      const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 10000 : 0;
      const averagePosition =
        impressions > 0 ? Math.round((item.weightedPositionSum / impressions) * 10) / 10 : 0;

      totalClicks += clicks;
      totalImpressions += impressions;
      totalWeightedPosition += item.weightedPositionSum || 0;

      return {
        date: item._id,
        clicks,
        impressions,
        ctr,
        averagePosition,
      };
    });

    const totalCtr =
      totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 10000 : 0;
    const overallAveragePosition =
      totalImpressions > 0
        ? Math.round((totalWeightedPosition / totalImpressions) * 10) / 10
        : 0;

    return {
      status: 'connected' as const,
      range,
      siteUrl: loc.gscSiteUrl,
      totals: {
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: totalCtr,
        averagePosition: overallAveragePosition,
      },
      daily,
      dataNotes: GSC_DATA_NOTES,
    };
  }

  /**
   * Retrieves high opportunity queries with explicit status checking.
   */
  public async getOpportunityQueriesForLocation(locationId: string) {
    const loc = await Location.findById(locationId);
    if (!loc) {
      const err: any = new Error('Location not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!loc.gscSiteUrl || loc.gscConnectionStatus !== 'connected') {
      return {
        status: 'not_connected' as const,
        discovered: [],
        strikingDistance: [],
      };
    }

    const rowCount = await GscQueryDaily.countDocuments({ locationId: loc._id });
    if (rowCount === 0) {
      return {
        status: 'no_data_yet' as const,
        discovered: [],
        strikingDistance: [],
      };
    }

    const opportunities = await this.detectHighOpportunityQueries(locationId);
    return {
      status: 'connected' as const,
      discovered: opportunities.discovered,
      strikingDistance: opportunities.strikingDistance,
    };
  }

  /**
   * Retrieves GSC metrics mapped to TrackedKeywords for a location.
   */
  public async getKeywordMetrics(locationId: string) {
    const loc = await Location.findById(locationId);
    if (!loc) {
      const err: any = new Error('Location not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!loc.gscSiteUrl || loc.gscConnectionStatus !== 'connected') {
      return {
        status: 'not_connected' as const,
        keywords: [],
      };
    }

    const keywords = await TrackedKeyword.find({
      locationId: loc._id,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    const hasData = keywords.some((k) => k.gscMetrics && k.gscMetrics.lastSyncedAt);

    return {
      status: (hasData ? 'connected' : 'no_data_yet') as 'connected' | 'no_data_yet',
      keywords: keywords.map((k) => ({
        _id: k._id,
        keyword: k.keyword,
        normalizedKeyword: k.normalizedKeyword,
        gscMetrics: k.gscMetrics || null,
      })),
    };
  }

  /**
   * Syncs all connected locations across the platform for the daily cron job.
   */
  public async syncAllConnectedLocations(): Promise<{ total: number; synced: number; errors: number }> {
    const connectedLocations = await Location.find({
      gscConnectionStatus: 'connected',
      gscSiteUrl: { $ne: null },
      deletedAt: null,
    });

    let synced = 0;
    let errors = 0;

    for (const loc of connectedLocations) {
      try {
        await this.syncLocation(loc._id.toString());
        synced++;
      } catch (err) {
        console.error(`[GSC Scheduled Sync] Failed to sync location ${loc._id}:`, err);
        errors++;
      }
    }

    return { total: connectedLocations.length, synced, errors };
  }
}

export const GSC_DATA_NOTES =
  'Google Search Console data reflects organic web search performance with an approximate 2-3 day reporting lag. Rare and anonymized queries are excluded by Google to protect user privacy, so query-level totals may not equal property-level totals. GSC measures organic web search only and is independent of Google Maps local rankings.';

export const gscService = new GscService();


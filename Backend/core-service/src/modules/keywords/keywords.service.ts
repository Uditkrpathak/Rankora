import mongoose from 'mongoose';
import { Response } from 'express';
import { TrackedKeyword, TrackedKeywordDocument } from '../../models/TrackedKeyword';
import { Location } from '../../models/Location';
import { Workspace } from '../../models/Workspace';
import { AuditLog } from '../../models/AuditLog';
import { Scan } from '../../models/Scan';
import { keywordVolumeService } from './keyword-volume.service';
import { ListKeywordsQuery } from './keywords.schema';
import { ITrackedKeywordSettings } from '@localo/types';
import { scanService } from '../rankings/scan.service';
import { DEFAULT_GRID_SIZE } from '../rankings/grid-generator';
import { DEFAULT_SUNFLOWER_RADIUS_KM } from '../rankings/scan-settings';
import { invalidateLocationChatCache } from '../chat/chat.cache';

export class KeywordsService {
  /**
   * Bulk add keywords for a specific location with atomic quota enforcement and deduplication
   */
  public async bulkAddKeywords(
    workspaceId: string,
    locationId: string,
    rawKeywords: string[],
    actorUserId: string,
    ip?: string,
    source: 'GOOGLE_AUTOCOMPLETE' | 'MANUAL' = 'MANUAL'
  ): Promise<{ inserted: TrackedKeywordDocument[]; baselineKeywords: TrackedKeywordDocument[]; duplicates: string[]; totalAdded: number }> {
    // 1. Verify location exists and belongs to workspace
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
    if (!location) {
      const err: any = new Error('LOCATION_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    // 2. Normalize and in-memory deduplicate the input batch
    const uniqueNormalizedMap = new Map<string, string>(); // normalized -> original trimmed
    for (const raw of rawKeywords) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const normalized = keywordVolumeService.normalize(trimmed);
      if (!uniqueNormalizedMap.has(normalized)) {
        uniqueNormalizedMap.set(normalized, trimmed);
      }
    }

    if (uniqueNormalizedMap.size === 0) {
      const err: any = new Error('NO_VALID_KEYWORDS');
      err.statusCode = 400;
      throw err;
    }

    // 3. Quota check against workspace / location limits (unlimited if null)
    const limit = location.keywordLimit ?? Infinity;
    const currentCount = await TrackedKeyword.countDocuments({ workspaceId, locationId });
    if (currentCount + uniqueNormalizedMap.size > limit) {
      const err: any = new Error('KEYWORD_LIMIT_EXCEEDED');
      err.statusCode = 402;
      throw err;
    }

    // 4. Query existing keywords in database for this location
    const normalizedKeys = Array.from(uniqueNormalizedMap.keys());
    const existingDocs = await TrackedKeyword.find({
      workspaceId,
      locationId,
      normalizedKeyword: { $in: normalizedKeys },
    }).lean();

    const existingNormalizedSet = new Set(existingDocs.map((doc) => doc.normalizedKeyword));
    const duplicates: string[] = [];
    const toInsert: Array<{ normalized: string; original: string }> = [];
    const baselineKeywords: TrackedKeywordDocument[] = [];

    for (const [normalized, original] of uniqueNormalizedMap.entries()) {
      if (existingNormalizedSet.has(normalized)) {
        duplicates.push(original);
        const existing = existingDocs.find((doc) => doc.normalizedKeyword === normalized);
        if (existing && (!existing.source || existing.source === 'LEGACY')) {
          await TrackedKeyword.updateOne(
            { _id: existing._id },
            { $set: { source, currentRank: null, previousRank: null, visibilityScore: 0, visibilityDelta: 0, sparkline: [], lastScannedAt: null, lastProvider: null, scanStatus: 'NOT_SCANNED' } }
          );
          const promoted = await TrackedKeyword.findById(existing._id);
          if (promoted) baselineKeywords.push(promoted);
        }
      } else {
        toInsert.push({ normalized, original });
      }
    }

    // If a single keyword was provided and it already exists, throw 409
    if (source === 'MANUAL' && rawKeywords.length === 1 && duplicates.length === 1 && toInsert.length === 0) {
      const err: any = new Error('KEYWORD_ALREADY_TRACKED');
      err.statusCode = 409;
      err.existingDoc = existingDocs[0];
      throw err;
    }

    if (toInsert.length === 0) {
      return { inserted: [], baselineKeywords, duplicates, totalAdded: 0 };
    }

    // 5. Use only real saved rank snapshots. Demo scans are never copied into tracked terms.
    const docsToCreate = await Promise.all(
      toInsert.map(async ({ normalized, original }) => {
        const volumeData = await keywordVolumeService.getVolume(original);

        // Check if there is an existing completed Scan for this keyword & location to seed rank
        const latestScan = await Scan.findOne({
          locationId,
          keyword: new RegExp(`^${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          status: { $in: ['COMPLETED', 'PARTIAL'] },
          gridPoints: { $not: { $elemMatch: { provider: /^MOCK$/i } } },
        }).sort({ createdAt: -1 });

        const currentRank = latestScan?.metrics?.arp ? Math.round(latestScan.metrics.arp) : null;
        const visibilityScore = latestScan?.metrics?.visibilityIndex ?? 0;
        const initialSparkline = latestScan
          ? [{ date: latestScan.createdAt, rank: currentRank, visibility: visibilityScore }]
          : [];

        return {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          locationId: new mongoose.Types.ObjectId(locationId),
          keyword: original,
          source,
          normalizedKeyword: normalized,
          monthlySearchVolume: volumeData.volume,
          volumeSource: volumeData.source,
          volumeBand: volumeData.band,
          hasLocalPack: volumeData.hasLocalPack,
          currentRank,
          previousRank: null,
          visibilityScore,
          visibilityDelta: 0,
          sparkline: initialSparkline,
          lastScannedAt: latestScan ? latestScan.createdAt : null,
          lastProvider: latestScan
            ? (() => {
                const providers = [...new Set((latestScan.gridPoints || []).map((point) => point.provider?.trim()).filter(Boolean))];
                return providers.length === 0 ? null : providers.length === 1 ? providers[0] : 'MIXED';
              })()
            : null,
          scanStatus: latestScan ? 'SCANNED' : 'NOT_SCANNED',
          status: 'active',
          scanFrequency: 'manual',
          gridSize: DEFAULT_GRID_SIZE,
          radiusKm: DEFAULT_SUNFLOWER_RADIUS_KM,
          nextScheduledAt: null,
        };
      })
    );

    const inserted = (await TrackedKeyword.insertMany(docsToCreate)) as unknown as TrackedKeywordDocument[];
    if (source === 'GOOGLE_AUTOCOMPLETE') baselineKeywords.push(...inserted);

    // Invalidate chat cache so newly tracked keywords appear immediately in chatbot
    invalidateLocationChatCache(locationId).catch(() => {});

    // Auto-enqueue Quick scan for newly inserted keywords if coordinates are present
    if (location.coordinates?.lat && location.coordinates?.lng) {
      for (const kw of inserted) {
        if (kw.scanStatus === 'NOT_SCANNED') {
          scanService.triggerScan({
            workspaceId,
            locationId,
            keyword: kw.keyword,
            scanShape: 'SUNFLOWER',
          }).catch(err => {
            console.warn(`[KeywordsService] Auto-scan trigger for "${kw.keyword}" deferred:`, err?.message || err);
          });
        }
      }
    }

    // 6. Audit log
    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'KEYWORDS_ADDED',
      resourceType: 'TrackedKeyword',
      resourceId: locationId,
      ip,
      after: {
        count: inserted.length,
        keywords: inserted.map((k) => k.keyword),
      },
    });

    return {
      inserted,
      baselineKeywords,
      duplicates,
      totalAdded: inserted.length,
    };
  }

  /**
   * Paginated, sortable, and searchable list of tracked keywords
   */
  public async listKeywords(
    workspaceId: string,
    locationId: string,
    query: ListKeywordsQuery
  ): Promise<{ keywords: TrackedKeywordDocument[]; total: number; page: number; pages: number }> {
    const filter: any = {
      workspaceId,
      locationId,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const terms = query.search.trim().split(/\s+/).filter(Boolean);
      if (terms.length === 1) {
        filter.keyword = new RegExp(terms[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } else if (terms.length > 1) {
        const pattern = terms.map((t) => `(?=.*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
        filter.keyword = new RegExp(pattern, 'i');
      }
    }

    const sortOrder = query.order === 'asc' ? 1 : -1;
    let sortObj: any = { visibilityScore: -1 };

    if (query.sortBy === 'rank') {
      // Sort rank with unranked (null) at bottom
      sortObj = { currentRank: sortOrder };
    } else if (query.sortBy === 'volume') {
      sortObj = { monthlySearchVolume: sortOrder };
    } else if (query.sortBy === 'lastScannedAt') {
      sortObj = { lastScannedAt: sortOrder };
    } else if (query.sortBy === 'createdAt') {
      sortObj = { createdAt: sortOrder };
    } else if (query.sortBy === 'keyword') {
      sortObj = { keyword: sortOrder };
    } else {
      sortObj = { visibilityScore: sortOrder };
    }

    const [keywords, total] = await Promise.all([
      TrackedKeyword.find(filter)
        .sort(sortObj)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      TrackedKeyword.countDocuments(filter),
    ]);

    return {
      keywords: keywords as unknown as TrackedKeywordDocument[],
      total,
      page: query.page,
      pages: Math.ceil(total / query.limit) || 1,
    };
  }

  /**
   * Delete a tracked keyword
   */
  public async deleteKeyword(
    workspaceId: string,
    locationId: string,
    keywordId: string,
    actorUserId: string,
    ip?: string
  ): Promise<boolean> {
    const deleted = await TrackedKeyword.findOneAndDelete({
      _id: keywordId,
      locationId,
      workspaceId,
    });

    if (!deleted) {
      const err: any = new Error('KEYWORD_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'KEYWORD_DELETED',
      resourceType: 'TrackedKeyword',
      resourceId: keywordId,
      ip,
      after: { keyword: deleted.keyword },
    });

    invalidateLocationChatCache(locationId).catch(() => {});

    return true;
  }

  public async updateKeywordSettings(
    workspaceId: string,
    locationId: string,
    keywordId: string,
    settings: ITrackedKeywordSettings,
    actorUserId: string,
    ip?: string
  ): Promise<TrackedKeywordDocument> {
    const keyword = await TrackedKeyword.findOne({ _id: keywordId, workspaceId, locationId });
    if (!keyword) {
      const err: any = new Error('KEYWORD_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    if (settings.status) keyword.status = settings.status;
    if (settings.scanFrequency) keyword.scanFrequency = settings.scanFrequency;
    if (settings.gridSize !== undefined) keyword.gridSize = settings.gridSize;
    if (settings.radiusKm !== undefined) keyword.radiusKm = settings.radiusKm;

    if (keyword.status === 'paused' || keyword.scanFrequency === 'manual') {
      keyword.nextScheduledAt = null;
    } else if (settings.scanFrequency || settings.status === 'active') {
      const intervalMs = keyword.scanFrequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      keyword.nextScheduledAt = new Date(Date.now() + intervalMs);
    }

    await keyword.save();
    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'KEYWORD_SETTINGS_UPDATED',
      resourceType: 'TrackedKeyword',
      resourceId: keywordId,
      ip,
      after: {
        status: keyword.status,
        scanFrequency: keyword.scanFrequency,
        gridSize: keyword.gridSize,
        radiusKm: keyword.radiusKm,
        nextScheduledAt: keyword.nextScheduledAt,
      },
    });

    invalidateLocationChatCache(locationId).catch(() => {});

    return keyword;
  }

  public async processDueScheduledScans(now = new Date(), batchSize = 20): Promise<void> {
    const dueKeywords = await TrackedKeyword.find({
      status: 'active',
      source: { $in: ['GOOGLE_AUTOCOMPLETE', 'MANUAL'] },
      scanFrequency: { $in: ['daily', 'weekly'] },
      nextScheduledAt: { $lte: now },
    }).limit(batchSize);

    for (const candidate of dueKeywords) {
      const frequency = candidate.scanFrequency;
      const intervalMs = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const nextScheduledAt = new Date(now.getTime() + intervalMs);
      const claimed = await TrackedKeyword.findOneAndUpdate(
        {
          _id: candidate._id,
          status: 'active',
          scanFrequency: frequency,
          nextScheduledAt: { $lte: now },
        },
        { $set: { nextScheduledAt } },
        { new: true }
      );
      if (!claimed) continue;

      try {
        await scanService.triggerScan({
          workspaceId: claimed.workspaceId.toString(),
          locationId: claimed.locationId.toString(),
          keyword: claimed.keyword,
          scanShape: 'SUNFLOWER',
          gridSize: claimed.gridSize,
          radiusKm: claimed.radiusKm,
          scheduled: true,
        });
      } catch (err) {
        console.warn(`[Keyword Scheduler] Could not queue scan for ${claimed._id}:`, err);
        await TrackedKeyword.updateOne(
          { _id: claimed._id, scanFrequency: frequency, status: 'active' },
          { $set: { nextScheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1000) } }
        );
      }
    }
  }

  /**
   * Enqueue a refresh scan for a single tracked keyword
   */
  public async refreshKeyword(
    workspaceId: string,
    locationId: string,
    keywordId: string,
    actorUserId: string,
    ip?: string
  ): Promise<{ scanId: string; status: string; message: string }> {
    const keywordDoc = await TrackedKeyword.findOne({
      _id: keywordId,
      locationId,
      workspaceId,
    });

    if (!keywordDoc) {
      const err: any = new Error('KEYWORD_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    // Reuse Phase 3 scanService to enqueue on Scan queue with daily budget & credit checks
    const scan = await scanService.triggerScan({
      workspaceId,
      locationId,
      keyword: keywordDoc.keyword,
      scanShape: 'SUNFLOWER',
      gridSize: keywordDoc.gridSize,
      radiusKm: keywordDoc.radiusKm,
      force: true,
    });

    return {
      scanId: scan._id.toString(),
      status: scan.status,
      message: `Scan for keyword "${keywordDoc.keyword}" has been queued.`,
    };
  }

  /**
   * Stream keywords as CSV with safety ceiling
   */
  public async exportKeywordsCsv(
    workspaceId: string,
    locationId: string,
    res: Response
  ): Promise<void> {
    const MAX_EXPORT_ROWS = 2000;
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
    const locationName = location ? location.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'location';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="localo_keywords_${locationName}_${new Date().toISOString().slice(0, 10)}.csv"`
    );

    // CSV Header
    res.write('Keyword,Monthly Search Volume,Volume Source,Local Pack,Current Rank,Visibility %,Last Scanned\n');

    const cursor = TrackedKeyword.find({ workspaceId, locationId, source: { $in: ['GOOGLE_AUTOCOMPLETE', 'MANUAL'] } })
      .sort({ visibilityScore: -1 })
      .limit(MAX_EXPORT_ROWS + 1)
      .cursor();

    let count = 0;
    for await (const doc of cursor) {
      count++;
      if (count > MAX_EXPORT_ROWS) {
        res.setHeader('X-Export-Truncated', 'true');
        break;
      }

      const escapedKeyword = `"${doc.keyword.replace(/"/g, '""')}"`;
      const volume = doc.monthlySearchVolume !== null ? doc.monthlySearchVolume : doc.volumeBand || 'N/A';
      const volumeSource = doc.volumeSource;
      const localPack = doc.hasLocalPack ? 'Yes' : 'No';
      const currentRank = doc.currentRank !== null ? doc.currentRank : '--';
      const visibility = `${Math.round(doc.visibilityScore || 0)}%`;
      const lastScanned = doc.lastScannedAt ? doc.lastScannedAt.toISOString() : 'Never';

      res.write(`${escapedKeyword},${volume},${volumeSource},${localPack},${currentRank},${visibility},${lastScanned}\n`);
    }

    res.end();
  }

  /**
   * Pre-scan guard probe (§Keyword Engine V2)
   * Evaluates keyword relevance and checks for informational/non-commercial searches before spending credits.
   */
  public async probeKeywordPreScan(
    workspaceId: string,
    locationId: string,
    keyword: string
  ): Promise<{
    isInformational: boolean;
    relevanceScore: number;
    warning: string | null;
    suggestedReplacements: string[];
    category: string;
  }> {
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
    if (!location) {
      const err: any = new Error('LOCATION_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    const { CategoryResolver } = await import('./keyword-engine/category-resolver');
    const { IntentAndJunkFilter } = await import('./keyword-engine/intent-and-junk-filter');
    const { businessKeywordSuggestionsService } = await import('./business-keyword-suggestions.service');
    const { RelevanceProbe } = await import('./keyword-engine/relevance-probe');
    const { GoogleMapsHttpProvider } = await import('../../providers/serp/google-maps-http.provider');

    const resolvedCat = CategoryResolver.resolve({
      placesPrimaryTypeDisplayName: typeof location.primaryCategory === 'object' ? (location.primaryCategory as any)?.displayName : location.primaryCategory,
      placesTypes: location.categories,
      businessName: location.name,
    });

    const candidateSuggestions = await businessKeywordSuggestionsService.suggest({
      category: resolvedCat,
      city: location.city,
      countryCode: location.country || 'in',
      limit: 4,
    });
    const replacements = candidateSuggestions.keywords.map((c) => c.keyword);

    // 1. Static Intent & Junk Token Check
    const evalRes = IntentAndJunkFilter.evaluateCandidate(keyword);
    if (!evalRes.accepted) {
      return {
        isInformational: true,
        relevanceScore: 0.0,
        warning: `This looks like information search, not business search (relevance 0%)`,
        suggestedReplacements: replacements,
        category: resolvedCat.primary,
      };
    }

    // 2. Cheap Single-Pin Probe at Center Coordinate
    const coords = location.coordinates || { lat: 28.6139, lng: 77.2090 };
    const provider = new GoogleMapsHttpProvider({
      requestTimeoutMs: 12000,
      minRequestSpacingMs: 0,
    });

    try {
      const searchRes = await provider.search({
        keyword,
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: 3.0,
        localization: { hl: 'en', gl: 'in', device: 'DESKTOP' },
      });

      const rel = RelevanceProbe.calculateItemRelevance(searchRes.items || [], resolvedCat);
      const minThreshold = parseFloat(process.env.KEYWORD_MIN_RELEVANCE || '0.45');

      if (rel.relevanceRatio < minThreshold) {
        return {
          isInformational: true,
          relevanceScore: rel.relevanceRatio,
          warning: `This looks like information search, not business search (relevance ${Math.round(rel.relevanceRatio * 100)}%)`,
          suggestedReplacements: replacements,
          category: resolvedCat.primary,
        };
      }

      return {
        isInformational: false,
        relevanceScore: rel.relevanceRatio,
        warning: null,
        suggestedReplacements: [],
        category: resolvedCat.primary,
      };
    } catch {
      return {
        isInformational: false,
        relevanceScore: 1.0,
        warning: null,
        suggestedReplacements: [],
        category: resolvedCat.primary,
      };
    } finally {
      await GoogleMapsHttpProvider.closeAllDispatchers();
    }
  }
}

export const keywordsService = new KeywordsService();


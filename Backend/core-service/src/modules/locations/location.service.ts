import mongoose from 'mongoose';
import { Location, LocationDocument } from '../../models/Location';
import { Audit } from '../../models/Audit';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { AuditLog } from '../../models/AuditLog';
import { TrackedKeyword } from '../../models/TrackedKeyword';
import { Scan } from '../../models/Scan';
import { IWorkspaceDashboardMetrics } from '@localo/types';
import { redisClient } from '../../config/redis';
import { CreateLocationInput, UpdateLocationInput } from './location.schema';
import { onLocationConnected } from '../../events/location-connected.hook';
import { placesAutocompleteProvider } from '../../providers/places-autocomplete.provider';
import { AiDraftLog } from '../../models/AiDraftLog';
import { DEFAULT_SUNFLOWER_RADIUS_KM } from '../rankings/scan-settings';
import { invalidateLocationChatCache } from '../chat/chat.cache';

const PAGE_SIZE = 20;

export class LocationService {
  /**
   * Create a new location manually for the given workspace with internal quota & duplicate checks (§4.3)
   * Flagged as ownershipVerified: false, addedVia: 'manual_entry'
   */
  public async createLocation(
    workspaceId: string,
    input: CreateLocationInput,
    actorUserId: string,
    ip?: string
  ): Promise<LocationDocument> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      const err: any = new Error('WORKSPACE_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    // 1. Check workspace plan quotas
    const isExempt =
      process.env.NODE_ENV === 'development' ||
      process.env.DISABLE_PLAN_LIMITS === 'true' ||
      (workspace as any).isQuotaExempt === true;

    if (!isExempt) {
      const activeCount = await Location.countDocuments({ workspaceId, deletedAt: null });
      const maxLocations = workspace.limits?.locations || 1;
      if (maxLocations !== -1 && activeCount >= maxLocations) {
        const err: any = new Error('LOCATION_LIMIT_EXCEEDED');
        err.statusCode = 402;
        throw err;
      }
    }

    // 2. Prevent duplicate active placeId in the same workspace
    if (input.placeId) {
      const existing = await Location.findOne({
        workspaceId,
        placeId: input.placeId,
        deletedAt: null,
      });
      if (existing) {
        const err: any = new Error('LOCATION_ALREADY_EXISTS');
        err.statusCode = 409;
        throw err;
      }
    }

    const location = await Location.create({
      workspaceId,
      ...input,
      ownershipVerified: false,
      addedVia: 'manual_entry',
      deletedAt: null,
      syncStatus: 'STANDALONE',
      lastSyncedAt: new Date(),
    });

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'LOCATION_CREATED',
      resourceType: 'Location',
      resourceId: location._id.toString(),
      ip,
      after: { name: location.name, city: location.city, country: location.country },
    });

    // Auto-trigger 17-point audit hook (§Auto-Audit on Connect)
    await onLocationConnected(location._id.toString(), workspaceId, actorUserId);

    try {
      const { notificationService } = await import('../notifications/notification.service');
      await notificationService.createNotification({
        workspaceId,
        userId: actorUserId,
        type: 'SYSTEM',
        severity: 'INFO',
        title: `Business Added: ${location.name}`,
        message: `${location.name}${location.city ? ` in ${location.city}` : ''} has been added to your workspace.`,
        link: `/locations/${location._id}/profile`,
        metadata: {
          locationId: location._id.toString(),
          businessName: location.name,
          city: location.city,
        },
      });
    } catch (notifErr: any) {
      console.warn(`[LocationService] Manual business added notification failed:`, notifErr?.message || notifErr);
    }

    return location;
  }

  /**
   * Add a location from Places Autocomplete/Text Search
   * Flagged as ownershipVerified: false, addedVia: 'places_search'
   */
  public async addFromPlacesSearch(
    workspaceId: string,
    placeId: string,
    actorUserId: string,
    ip?: string,
    confirmedCoordinates?: { lat: number; lng: number }
  ): Promise<LocationDocument> {
    const existing = await Location.findOne({ workspaceId, placeId, deletedAt: null });
    if (existing) {
      const err: any = new Error('LOCATION_ALREADY_ADDED');
      err.statusCode = 409;
      throw err;
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      const err: any = new Error('WORKSPACE_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    const member = actorUserId ? await WorkspaceMember.findOne({ workspaceId, userId: actorUserId }) : null;
    const isExempt = member && (member.role === 'owner' || member.role === 'admin');

    if (!isExempt) {
      const activeCount = await Location.countDocuments({ workspaceId, deletedAt: null });
      const maxLocations = workspace.limits?.locations || 1;
      if (maxLocations !== -1 && activeCount >= maxLocations) {
        const err: any = new Error('LOCATION_LIMIT_EXCEEDED');
        err.statusCode = 402;
        throw err;
      }
    }

    const details = await placesAutocompleteProvider.getPlaceDetails(placeId, workspaceId);

    const finalCoordinates = confirmedCoordinates || details.coordinates;
    const coordinatesSource = confirmedCoordinates
      ? 'USER_CONFIRMED'
      : details.coordinatesSource || 'PLACES_API';

    const softDeleted = await Location.findOne({
      workspaceId,
      placeId,
      deletedAt: { $ne: null },
    });

    let savedLocation: LocationDocument;
    if (softDeleted) {
      softDeleted.deletedAt = null;
      softDeleted.name = details.name;
      softDeleted.address = details.address;
      softDeleted.city = details.city;
      softDeleted.state = details.state;
      softDeleted.country = details.country;
      softDeleted.postalCode = details.postalCode || softDeleted.postalCode;
      softDeleted.coordinates = finalCoordinates || softDeleted.coordinates;
      softDeleted.placesCoordinates = details.coordinates || softDeleted.placesCoordinates;
      if (details.mapsCid && !softDeleted.mapsCid) {
        softDeleted.mapsCid = details.mapsCid;
      }
      softDeleted.coordinatesSource = coordinatesSource;
      softDeleted.coordinatesVerifiedAt = new Date();
      softDeleted.averageRating = details.rating ?? null;
      softDeleted.totalReviewCount = details.userRatingCount ?? null;
      softDeleted.placesDetailsFetchedAt = new Date();
      softDeleted.primaryCategory = details.primaryCategory || softDeleted.primaryCategory;
      softDeleted.secondaryCategories = details.secondaryCategories || softDeleted.secondaryCategories;
      softDeleted.phone = details.phone || softDeleted.phone;
      softDeleted.website = details.website || softDeleted.website;
      softDeleted.coverPhotoUrl = details.coverPhotoUrl || details.photoUrl || softDeleted.coverPhotoUrl;
      softDeleted.logoUrl = details.logoUrl || details.photoUrl || softDeleted.logoUrl;
      softDeleted.regularHours = details.regularHours || softDeleted.regularHours;
      softDeleted.ownershipVerified = false;
      softDeleted.addedVia = 'places_search';
      softDeleted.status = 'active';
      softDeleted.syncStatus = 'STANDALONE';

      savedLocation = await softDeleted.save();
    } else {
      savedLocation = await Location.create({
        workspaceId,
        placeId,
        mapsCid: details.mapsCid || undefined,
        name: details.name,
        address: details.address,
        city: details.city,
        state: details.state,
        country: details.country,
        postalCode: details.postalCode,
        coordinates: finalCoordinates,
        placesCoordinates: details.coordinates,
        coordinatesSource,
        coordinatesVerifiedAt: new Date(),
        primaryCategory: details.primaryCategory,
        secondaryCategories: details.secondaryCategories || [],
        phone: details.phone,
        website: details.website,
        coverPhotoUrl: details.coverPhotoUrl || details.photoUrl,
        logoUrl: details.logoUrl || details.photoUrl,
        regularHours: details.regularHours || {},
        averageRating: details.rating ?? null,
        totalReviewCount: details.userRatingCount ?? null,
        attributes: details.attributes || [],
        placesDetailsFetchedAt: new Date(),
        ownershipVerified: false,
        addedVia: 'places_search',
        status: 'active',
        syncStatus: 'STANDALONE',
      });
    }

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'LOCATION_ADDED_MANUAL_SEARCH',
      resourceType: 'Location',
      resourceId: savedLocation._id.toString(),
      ip,
      after: { name: savedLocation.name, placeId: savedLocation.placeId },
    });

    await onLocationConnected(savedLocation._id.toString(), workspaceId, actorUserId);

    // Track only genuine autocomplete results, using the same discovery as the preview.
    try {
      const { keywordsService } = await import('../keywords/keywords.service');
      const { CategoryResolver } = await import('../keywords/keyword-engine/category-resolver');
      const { businessKeywordSuggestionsService } = await import('../keywords/business-keyword-suggestions.service');
      const category = CategoryResolver.resolve({
        businessName: savedLocation.name,
        placesPrimaryTypeDisplayName: typeof savedLocation.primaryCategory === 'object' ? (savedLocation.primaryCategory as any)?.displayName : savedLocation.primaryCategory,
        placesTypes: savedLocation.secondaryCategories?.map((secondary) => secondary.displayName),
      });
      const suggestions = await businessKeywordSuggestionsService.suggest({
        category,
        city: savedLocation.city || undefined,
        countryCode: savedLocation.country || 'in',
        limit: 3,
      });
      const chosenKeywords = suggestions.keywords.map((suggestion) => suggestion.keyword);

      if (chosenKeywords.length === 0) {
        console.warn(`[LocationService] No Google keyword suggestions for ${savedLocation._id}: ${suggestions.status}`);
        return savedLocation;
      }

      const addResult = await keywordsService.bulkAddKeywords(
        workspaceId,
        savedLocation._id.toString(),
        chosenKeywords,
        actorUserId,
        ip,
        'GOOGLE_AUTOCOMPLETE'
      );

      // Run one real regional baseline for top discovered keyword
      const { scanService } = await import('../rankings/scan.service');
      const baselineKeyword = addResult.baselineKeywords[0];
      if (baselineKeyword) {
        baselineKeyword.radiusKm = DEFAULT_SUNFLOWER_RADIUS_KM;
        baselineKeyword.scanFrequency = 'weekly';
        baselineKeyword.nextScheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await baselineKeyword.save();
        try {
          await scanService.triggerScan({
            workspaceId,
            locationId: savedLocation._id.toString(),
            keyword: baselineKeyword.keyword,
            scanShape: 'SUNFLOWER',
            gridSize: baselineKeyword.gridSize,
            radiusKm: baselineKeyword.radiusKm,
            idempotencyKey: `profile-sunflower-v1:${savedLocation._id.toString()}:${baselineKeyword._id.toString()}`,
          });
          baselineKeyword.lastScanError = null;
          await baselineKeyword.save();
        } catch (scanErr: any) {
          baselineKeyword.lastScanError = scanErr?.message || 'The live rank scan could not be queued.';
          await baselineKeyword.save();
          console.warn(`[LocationService] Baseline rank scan could not be queued for ${savedLocation._id}:`, scanErr);
        }
      }
    } catch (seedErr) {
      console.warn(`[LocationService] Live keyword discovery/scanning setup failed for ${savedLocation._id}:`, seedErr);
    }

    try {
      const { notificationService } = await import('../notifications/notification.service');
      await notificationService.createNotification({
        workspaceId,
        userId: actorUserId,
        type: 'SYSTEM',
        severity: 'INFO',
        title: `Business Added: ${savedLocation.name}`,
        message: `${savedLocation.name}${savedLocation.city ? ` in ${savedLocation.city}` : ''} has been added to your workspace. Initial keywords and audit are active.`,
        link: `/locations/${savedLocation._id}/profile`,
        metadata: {
          locationId: savedLocation._id.toString(),
          businessName: savedLocation.name,
          city: savedLocation.city,
        },
      });
    } catch (notifErr: any) {
      console.warn(`[LocationService] Places business added notification failed:`, notifErr?.message || notifErr);
    }

    return savedLocation;
  }

  /**
   * Paginated list with optional search query and status filter — excludes soft-deleted locations.
   */
  public async listLocations(
    workspaceId: string,
    page: number = 1,
    limit: number = PAGE_SIZE,
    search?: string,
    status?: string
  ): Promise<{ locations: LocationDocument[]; total: number; page: number; pages: number }> {
    const filter: any = { workspaceId, deletedAt: null };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { city: searchRegex }, { address: searchRegex }];
    }

    if (status && ['active', 'paused', 'archived'].includes(status)) {
      filter.status = status;
    }

    const [locations, total] = await Promise.all([
      Location.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Location.countDocuments(filter),
    ]);

    return {
      locations: locations as unknown as LocationDocument[],
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fetch a single location.
   */
  public async getLocation(
    id: string,
    workspaceId: string
  ): Promise<LocationDocument | null> {
    return Location.findOne({ _id: id, workspaceId, deletedAt: null });
  }

  /**
   * Partial update with before/after AuditLog entry, GBP write-through, and debounced audit queueing.
   */
  public async updateLocation(
    id: string,
    workspaceId: string,
    patch: UpdateLocationInput,
    actorUserId: string,
    ip?: string
  ): Promise<LocationDocument | null> {
    const existing = await this.getLocation(id, workspaceId);
    if (!existing) return null;

    const before = {
      name: existing.name,
      address: existing.address,
      description: (existing as any).description,
      status: existing.status,
      website: existing.website,
    };

    // 1. If connected to Google Business Profile, execute write-through to Google API
    let gbpWriteSuccess = false;
    let gbpWriteError: string | null = null;
    let approvedAiDescriptionDraft: any = null;

    if (existing.googleConnectionId && existing.gbpLocationId) {
      if (patch.description !== undefined) {
        const matchingDraft = await AiDraftLog.findOne({
          workspaceId,
          locationId: id,
          kind: 'DESCRIPTION',
          draftText: patch.description.trim(),
          status: { $nin: ['APPROVED', 'PUBLISHED'] },
        }).select('_id status');
        if (matchingDraft) {
          throw Object.assign(new Error('This AI-generated description must be approved in Drafts before it can be written to Google.'), {
            statusCode: 409,
            code: 'AI_DRAFT_APPROVAL_REQUIRED',
          });
        }
        approvedAiDescriptionDraft = await AiDraftLog.findOne({
          workspaceId,
          locationId: id,
          kind: 'DESCRIPTION',
          draftText: patch.description.trim(),
          generationVersion: 2,
          status: 'APPROVED',
        }).sort({ createdAt: -1 });
      }
      try {
        const { GoogleConnection } = await import('../../models/GoogleConnection');
        const { googleVaultService } = await import('../google/google-vault.service');
        const { gbpClientService } = await import('../google/gbp-client.service');

        const connection = await GoogleConnection.findOne({
          _id: existing.googleConnectionId,
          workspaceId,
          status: 'CONNECTED',
        });

        if (connection) {
          const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
          const updateMask: string[] = [];
          const patchData: any = {};

          if (patch.description !== undefined) {
            updateMask.push('profile.description');
            patchData.description = patch.description;
          }
          if (patch.regularHours !== undefined) {
            updateMask.push('regularHours');
            patchData.regularHours = patch.regularHours;
          }
          if (patch.website !== undefined) {
            updateMask.push('websiteUri');
            patchData.websiteUri = patch.website;
          }
          if (patch.primaryCategory !== undefined || patch.secondaryCategories !== undefined) {
            updateMask.push('categories');
            if (patch.primaryCategory) {
              patchData.primaryCategory = {
                name: patch.primaryCategory.id || `categories/${patch.primaryCategory.displayName}`,
                displayName: patch.primaryCategory.displayName,
              };
            }
            if (patch.secondaryCategories) {
              patchData.additionalCategories = patch.secondaryCategories.map((c) => ({
                name: c.id || `categories/${c.displayName}`,
                displayName: c.displayName,
              }));
            }
          }

          if (updateMask.length > 0) {
            await gbpClientService.patchLocation(
              accessToken,
              existing.gbpLocationId,
              updateMask,
              patchData,
              workspaceId
            );

            // Confirm by read-back snapshot from Google Business Profile API (§Confirmed Read-Back)
            const snapshot = await gbpClientService.getLocationSnapshot(
              accessToken,
              existing.gbpAccountId || 'accounts/current',
              existing.gbpLocationId,
              workspaceId
            );

            if (patchData.description !== undefined) {
              existing.description = snapshot.description !== undefined ? (snapshot.description || patchData.description) : patchData.description;
            }
            if (patchData.regularHours !== undefined && snapshot.regularHours) {
              existing.regularHours = snapshot.regularHours;
            }
            if (patchData.websiteUri !== undefined) {
              existing.website = snapshot.website !== undefined ? snapshot.website : patchData.websiteUri;
            }

            gbpWriteSuccess = true;
            existing.lastSyncedAt = new Date();
            existing.syncStatus = 'SYNCED';
            existing.syncError = null;
          }
        }
      } catch (gbpErr: any) {
        console.warn(`[LocationService] GBP write-through error for location ${id}:`, gbpErr?.message);
        gbpWriteError = gbpErr?.message || 'Failed to sync update to Google Business Profile';
        existing.syncStatus = 'ERROR';
        existing.syncError = gbpWriteError;
        await existing.save();

        const err: any = new Error(`GBP_WRITE_FAILED: ${gbpWriteError}`);
        err.statusCode = gbpErr?.statusCode || 400;
        err.details = { gbpWriteError, locationId: id };
        throw err;
      }
    }

    Object.assign(existing, patch);

    // If website URL was updated or cleared, update schema crawler verification metadata
    if (patch.website !== undefined) {
      if (patch.website && patch.website.trim()) {
        try {
          const { schemaCrawlerService } = await import('../crawler/schema-crawler.service');
          const verification = await schemaCrawlerService.verifyLocalBusinessSchema(patch.website.trim());
          existing.schemaVerification = {
            verified: verification.verified,
            verifiedAt: verification.verifiedAt,
            detectedTypes: verification.detectedTypes,
            verificationMethod: 'automated_crawler',
            rawSnippet: verification.rawSnippet,
            error: verification.error,
          };
          existing.hasLocalBusinessSchema = verification.verified;
        } catch (crawlerErr) {
          console.warn(`[LocationService] Schema crawler warning for ${patch.website}:`, crawlerErr);
        }
      } else {
        existing.schemaVerification = undefined;
        existing.hasLocalBusinessSchema = false;
      }
    }

    await existing.save();

    if (gbpWriteSuccess && approvedAiDescriptionDraft) {
      await AiDraftLog.updateOne(
        { _id: approvedAiDescriptionDraft._id, workspaceId, status: 'APPROVED' },
        { $set: { status: 'PUBLISHED', publishedAt: new Date() }, $push: { stateHistory: { state: 'PUBLISHED', actorUserId: new mongoose.Types.ObjectId(actorUserId), at: new Date(), note: 'Description confirmed by GBP read-back.' } } }
      );
    }

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'LOCATION_UPDATED',
      resourceType: 'Location',
      resourceId: id,
      ip,
      before,
      after: {
        name: existing.name,
        address: existing.address,
        status: existing.status,
        gbpWriteSuccess,
        gbpWriteError,
      },
    });

    // Queue debounced background audit so the 17-point score and tasks update cleanly without race conditions
    try {
      const { queueAuditExecution } = await import('../../jobs/audit.queue');
      await queueAuditExecution({
        workspaceId: existing.workspaceId.toString(),
        locationId: existing._id.toString(),
        triggerSource: 'remediation_patch',
        debounceMs: 1500,
      });
    } catch (queueErr) {
      console.warn(`[LocationService] Audit debounce queue warning:`, queueErr);
    }

    invalidateLocationChatCache(id).catch(() => {});

    return existing;
  }

  /**
   * Soft delete — sets deletedAt, never hard-deletes.
   */
  public async deleteLocation(
    id: string,
    workspaceId: string,
    actorUserId: string,
    ip?: string
  ): Promise<boolean> {
    const location = await this.getLocation(id, workspaceId);
    if (!location) return false;

    location.deletedAt = new Date();
    await location.save();

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'LOCATION_DELETED',
      resourceType: 'Location',
      resourceId: id,
      ip,
      before: { name: location.name, status: location.status },
    });

    invalidateLocationChatCache(id).catch(() => {});

    return true;
  }

  /**
   * My Business Profiles Overview: Aggregates plan counters and multi-location cards with inline top keywords
   */
  public async getOverview(
    workspaceId: string,
    page: number = 1,
    limit: number = PAGE_SIZE,
    search?: string,
    status?: string,
    googleAccountId?: string,
    tag?: string,
    sortBy?: string
  ): Promise<{
    counters: {
      activeProfiles: number;
      activeProfilesLimit: number;
      optimizationSlotsUsed: number;
      optimizationSlotsLimit: number;
      pinnedCount: number;
      inactiveCount: number;
    };
    locations: any[];
    total: number;
    page: number;
    pages: number;
  }> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      const err: any = new Error('WORKSPACE_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    const activeProfilesLimit = workspace.limits?.activeProfilesLimit || workspace.limits?.locations || 30;
    const optimizationSlotsLimit = workspace.limits?.optimizationSlots || 15;

    // 1. Compute Plan Counters
    const [activeCount, optimizationSlotsUsed, pinnedCount, inactiveCount] = await Promise.all([
      Location.countDocuments({ workspaceId, deletedAt: null, status: 'active' }),
      Location.countDocuments({ workspaceId, deletedAt: null, 'optimization.enabled': true }),
      Location.countDocuments({ workspaceId, deletedAt: null, isPinned: true }),
      Location.countDocuments({ workspaceId, deletedAt: null, status: { $in: ['paused', 'archived'] } }),
    ]);

    // 2. Build Filter
    const filter: any = { workspaceId, deletedAt: null };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { city: searchRegex }, { address: searchRegex }];
    }

    if (status && ['active', 'paused', 'archived'].includes(status)) {
      filter.status = status;
    }

    if (googleAccountId && googleAccountId.trim()) {
      filter.gbpAccountId = googleAccountId.trim();
    }

    if (tag && tag.trim()) {
      filter.tags = tag.trim();
    }

    // 3. Sorting
    let sortObj: any = { isPinned: -1, lastOpenedAt: -1, createdAt: -1 };
    if (sortBy === 'rank_asc') {
      sortObj = { isPinned: -1, 'cachedKpis.averagePosition': 1, createdAt: -1 };
    } else if (sortBy === 'visibility_desc') {
      sortObj = { isPinned: -1, 'cachedKpis.visibilityScore': -1, createdAt: -1 };
    } else if (sortBy === 'name_asc') {
      sortObj = { isPinned: -1, name: 1 };
    } else if (sortBy === 'newReviews') {
      sortObj = { isPinned: -1, 'cachedKpis.newReviewsCount': -1, createdAt: -1 };
    }

    // 4. Fetch Locations
    const [locations, total] = await Promise.all([
      Location.find(filter)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Location.countDocuments(filter),
    ]);

    // 5. Embed top 5 keywords for each location
    const locationIds = locations.map((loc) => loc._id);
    const [keywords, audits, scans] = await Promise.all([
      TrackedKeyword.find({ locationId: { $in: locationIds }, source: { $in: ['GOOGLE_AUTOCOMPLETE', 'MANUAL', 'LEGACY'] } }).sort({ visibilityScore: -1 }).lean(),
      Audit.find({ workspaceId, locationId: { $in: locationIds } })
        .sort({ createdAt: -1 })
        .select('locationId score summary createdAt rulesVersion')
        .lean(),
      Scan.find({ workspaceId, locationId: { $in: locationIds } })
        .select('locationId keyword status error gridPoints.provider completedAt createdAt')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const providerByKeyword = new Map<string, string | null>();
    const scanStatusByKeyword = new Map<string, { status: string; error?: string | null }>();
    for (const scan of scans) {
      if ((scan.gridPoints || []).some((point: any) => point.provider?.toUpperCase() === 'MOCK')) continue;
      const key = `${scan.locationId.toString()}:${scan.keyword.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      if (!scanStatusByKeyword.has(key)) scanStatusByKeyword.set(key, { status: scan.status, error: scan.error });
      if (providerByKeyword.has(key) || !['COMPLETED', 'PARTIAL'].includes(scan.status)) continue;
      const providers = [...new Set((scan.gridPoints || []).map((point) => point.provider?.trim()).filter((provider): provider is string => Boolean(provider)))];
      providerByKeyword.set(key, providers.length === 0 ? null : providers.length === 1 ? providers[0] : 'MIXED');
    }

    const keywordsByLocation = new Map<string, any[]>();
    for (const kw of keywords) {
      const locIdStr = kw.locationId.toString();
      if (!keywordsByLocation.has(locIdStr)) {
        keywordsByLocation.set(locIdStr, []);
      }
      const list = keywordsByLocation.get(locIdStr)!;
      if (list.length < 5) {
        const keywordKey = `${locIdStr}:${kw.normalizedKeyword}`;
        list.push({
          ...kw,
          lastProvider: providerByKeyword.has(keywordKey) ? providerByKeyword.get(keywordKey) : kw.lastProvider === 'MOCK' ? null : kw.lastProvider ?? null,
          lastScanStatus: scanStatusByKeyword.get(keywordKey)?.status ?? null,
          lastScanError: scanStatusByKeyword.get(keywordKey)?.error ?? kw.lastScanError ?? null,
          lastScannedAt: kw.lastScannedAt ?? null,
        });
      }
    }

    const latestAuditByLocation = new Map<string, any>();
    for (const audit of audits) {
      const locationId = audit.locationId.toString();
      if (!latestAuditByLocation.has(locationId)) latestAuditByLocation.set(locationId, audit);
    }

    const enrichedLocations = locations.map((loc) => {
      const topKeywords = keywordsByLocation.get(loc._id.toString()) || [];
      const latestAudit = latestAuditByLocation.get(loc._id.toString());
      return {
        ...loc,
        auditScore: latestAudit?.score ?? null,
        auditUnknownCount: latestAudit?.summary?.unknownCount ?? null,
        auditUpdatedAt: latestAudit?.createdAt ?? null,
        auditRulesVersion: latestAudit?.rulesVersion ?? null,
        requiresGoogleConnection: loc.addedVia === 'places_search' && !loc.googleConnectionId,
        topKeywords,
      };
    });

    return {
      counters: {
        activeProfiles: activeCount,
        activeProfilesLimit,
        optimizationSlotsUsed,
        optimizationSlotsLimit,
        pinnedCount,
        inactiveCount,
      },
      locations: enrichedLocations,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Atomic Optimization Toggle with Plan Quota Check
   */
  public async toggleOptimization(
    id: string,
    workspaceId: string,
    enabled: boolean,
    actorUserId: string,
    ip?: string
  ): Promise<LocationDocument> {
    const location = await Location.findOne({ _id: id, workspaceId, deletedAt: null });
    if (!location) {
      const err: any = new Error('LOCATION_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      const err: any = new Error('WORKSPACE_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    if (enabled && !location.optimization?.enabled) {
      // Check optimization quota
      const usedSlots = await Location.countDocuments({
        workspaceId,
        deletedAt: null,
        'optimization.enabled': true,
      });

      const maxSlots = workspace.limits?.optimizationSlots || 15;
      if (usedSlots >= maxSlots) {
        const err: any = new Error('OPTIMIZATION_SLOTS_EXHAUSTED');
        err.statusCode = 402;
        err.details = {
          used: usedSlots,
          limit: maxSlots,
          message: `You have reached the maximum optimization slots (${maxSlots}) on your plan.`,
        };
        throw err;
      }
    }

    location.optimization = {
      enabled,
      enabledAt: enabled ? new Date() : null,
      enabledBy: enabled ? (new mongoose.Types.ObjectId(actorUserId) as any) : null,
      protectionWatchdog: enabled,
      lastProtectedCheckAt: enabled ? new Date() : null,
    };

    await location.save();

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: enabled ? 'OPTIMIZATION_ENABLED' : 'OPTIMIZATION_DISABLED',
      resourceType: 'Location',
      resourceId: id,
      ip,
      after: { optimization: location.optimization },
    });

    return location;
  }

  /**
   * Toggle Pin Status for Location
   */
  public async togglePin(
    id: string,
    workspaceId: string,
    actorUserId: string,
    ip?: string
  ): Promise<LocationDocument> {
    const location = await Location.findOne({ _id: id, workspaceId, deletedAt: null });
    if (!location) {
      const err: any = new Error('LOCATION_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    location.isPinned = !location.isPinned;
    await location.save();

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: location.isPinned ? 'LOCATION_PINNED' : 'LOCATION_UNPINNED',
      resourceType: 'Location',
      resourceId: id,
      ip,
      after: { isPinned: location.isPinned },
    });

    return location;
  }

  /**
   * Aggregates single business profile dashboard (KPIs, keywords preview, optimization & protection)
   */
  public async getSingleLocationDashboard(
    id: string,
    workspaceId: string
  ): Promise<any> {
    const location = await Location.findOne({ _id: id, workspaceId, deletedAt: null });
    if (!location) {
      const err: any = new Error('LOCATION_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    // Touch lastOpenedAt asynchronously
    Location.updateOne({ _id: id }, { $set: { lastOpenedAt: new Date() } }).exec();

    // Auto-populate attributes from Google Places if empty
    if ((!location.attributes || location.attributes.length === 0) && location.placeId) {
      try {
        const details = await placesAutocompleteProvider.getPlaceDetails(location.placeId, workspaceId);
        if (details.attributes && details.attributes.length > 0) {
          location.attributes = details.attributes;
          if (details.regularHours) location.regularHours = details.regularHours;
          if (details.phone) location.phone = details.phone;
          if (details.website) location.website = details.website;
          await Location.updateOne(
            { _id: id },
            {
              $set: {
                attributes: details.attributes,
                regularHours: location.regularHours,
                phone: location.phone,
                website: location.website,
              },
            }
          );
        }
      } catch (attrErr) {
        console.warn('[LocationService] Could not auto-sync place attributes:', attrErr);
      }
    }

    // Fetch top 10 tracked keywords
    const [keywordsPreview, recentScans] = await Promise.all([
      TrackedKeyword.find({ locationId: id, workspaceId, source: { $in: ['GOOGLE_AUTOCOMPLETE', 'MANUAL', 'LEGACY'] } }).sort({ visibilityScore: -1 }).limit(10).lean(),
      Scan.find({ locationId: id, workspaceId, status: 'COMPLETED' })
        .select('keyword gridPoints.provider completedAt createdAt')
        .sort({ completedAt: -1, createdAt: -1 })
        .lean(),
    ]);
    const providerByKeyword = new Map<string, string | null>();
    for (const scan of recentScans) {
      if ((scan.gridPoints || []).some((point: any) => point.provider?.toUpperCase() === 'MOCK')) continue;
      const key = scan.keyword.trim().toLowerCase().replace(/\s+/g, ' ');
      if (providerByKeyword.has(key)) continue;
      const providers = [...new Set((scan.gridPoints || []).map((point) => point.provider?.trim()).filter((provider): provider is string => Boolean(provider)))];
      providerByKeyword.set(key, providers.length === 0 ? null : providers.length === 1 ? providers[0] : 'MIXED');
    }
    const keywordsWithProvider = keywordsPreview.map((keyword) => ({
      ...keyword,
      lastProvider: providerByKeyword.has(keyword.normalizedKeyword)
        ? providerByKeyword.get(keyword.normalizedKeyword)
        : keyword.lastProvider === 'MOCK' ? null : keyword.lastProvider ?? null,
    }));

    // Dynamically calculate KPIs across all tracked keywords
    const scannedKeywords = keywordsWithProvider.filter(
      (k) => k.lastScannedAt != null || (typeof k.currentRank === 'number' && k.currentRank > 0)
    );
    const rankedKeywords = scannedKeywords.filter(
      (k) => typeof k.currentRank === 'number' && k.currentRank > 0 && k.currentRank <= 20
    );

    let calculatedVisibility = location.cachedKpis?.visibilityScore ?? 0;
    let calculatedAvgPosition = location.cachedKpis?.averagePosition ?? 0;

    if (scannedKeywords.length > 0) {
      const totalVis = scannedKeywords.reduce((acc, k) => acc + (k.visibilityScore || 0), 0);
      calculatedVisibility = Math.round(totalVis / scannedKeywords.length);

      if (rankedKeywords.length > 0) {
        const totalRank = rankedKeywords.reduce((acc, k) => acc + k.currentRank!, 0);
        calculatedAvgPosition = Math.round((totalRank / rankedKeywords.length) * 10) / 10;
      } else {
        calculatedAvgPosition = 21;
      }
    }

    // Never return sample analytics as if they were observed data. Values become
    // available only after a live GBP sync or completed rank scan.
    const kpis = {
      visibilityScore: calculatedVisibility,
      averagePosition: calculatedAvgPosition,
      profileViewsThisMonth: location.cachedKpis?.profileViewsThisMonth ?? null,
      profileViewsLastMonth: location.cachedKpis?.profileViewsLastMonth ?? null,
      profileViewsDelta: location.cachedKpis?.profileViewsDelta ?? null,
      totalReviews: location.totalReviewCount || location.cachedKpis?.totalReviews || 0,
      averageRating: location.averageRating || location.cachedKpis?.averageRating || 0,
      newReviewsCount: location.cachedKpis?.newReviewsCount ?? 0,
      areaDifficulty: location.cachedKpis?.areaDifficulty || 'LOW',
      lastCalculatedAt: location.cachedKpis?.lastCalculatedAt || location.updatedAt,
    };

    return {
      location,
      kpis,
      keywordsPreview: keywordsWithProvider,
      tasksSummary: {
        pending: 16,
        highImpact: 3,
      },
      optimization: {
        enabled: Boolean(location.optimization?.enabled),
        enabledAt: location.optimization?.enabledAt || null,
        protectionWatchdog: Boolean(location.optimization?.protectionWatchdog),
      },
      requiresGoogleConnection: location.addedVia === 'places_search' && !location.googleConnectionId,
    };
  }

  /**
   * Aggregates workspace-level dashboard metrics using 2-tier equal-weight per location math,
   * partial-completion coverage metadata, 90-day audit freshness guards, and sparse time-series points.
   */
  public async getWorkspaceDashboardMetrics(
    workspaceId: string,
    timeframe: '7d' | '30d' | '90d' = '30d'
  ): Promise<IWorkspaceDashboardMetrics> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      const err: any = new Error('WORKSPACE_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    const cacheKey = `cache:workspace_metrics:${workspaceId}:${timeframe}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    const locations = await Location.find({ workspaceId, deletedAt: null, status: 'active' })
      .select('_id name cachedKpis')
      .lean();
    const totalLocations = locations.length;

    if (totalLocations === 0) {
      return {
        avgLocalRank: null,
        avgVisibilityScore: null,
        gbpHealthIndex: null,
        coverage: {
          totalLocations: 0,
          scannedLocations: 0,
          auditedLocations: 0,
        },
        auditPillars: {
          profileCompleteness: 0,
          keywords: 0,
          media: 0,
          reviews: 0,
          citations: 0,
        },
        auditFreshness: {
          newestAuditAt: null,
          oldestAuditAt: null,
          hasStaleAudits: false,
        },
        rankMomentum: [],
      };
    }

    const locationIds = locations.map((loc) => loc._id);
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;

    // 1. Fetch Tracked Keywords & Latest Scans for all locations
    const [keywords, audits, scans] = await Promise.all([
      TrackedKeyword.find({ locationId: { $in: locationIds }, status: 'ACTIVE', source: { $in: ['GOOGLE_AUTOCOMPLETE', 'MANUAL'] } })
        .select('locationId latestRank atrp visibilityScore cachedKpis')
        .lean(),
      Audit.find({ workspaceId, locationId: { $in: locationIds } })
        .sort({ createdAt: -1 })
        .lean(),
      Scan.find({
        workspaceId,
        locationId: { $in: locationIds },
        status: 'COMPLETED',
        completedAt: {
          $gte: new Date(Date.now() - days * 86400 * 1000),
        },
      })
        .select('locationId metrics completedAt createdAt')
        .sort({ completedAt: 1, createdAt: 1 })
        .lean(),
    ]);

    // 2. Compute 2-Tier Equal-Weight Per Location Rank & Visibility
    const keywordsByLocation = new Map<string, any[]>();
    for (const kw of keywords) {
      const lid = kw.locationId.toString();
      if (!keywordsByLocation.has(lid)) keywordsByLocation.set(lid, []);
      keywordsByLocation.get(lid)!.push(kw);
    }

    let scannedLocationsCount = 0;
    let sumLocationAvgRanks = 0;
    let sumLocationVisibility = 0;

    for (const loc of locations) {
      const lid = loc._id.toString();
      const locKeywords = keywordsByLocation.get(lid) || [];

      const validRankKws = locKeywords.filter(
        (k) =>
          typeof k.atrp === 'number' ||
          typeof k.latestRank === 'number' ||
          typeof k.cachedKpis?.averagePosition === 'number'
      );

      if (validRankKws.length > 0) {
        scannedLocationsCount++;
        const locRankSum = validRankKws.reduce(
          (acc, k) => acc + (k.atrp ?? k.latestRank ?? k.cachedKpis?.averagePosition ?? 21),
          0
        );
        const locVisSum = validRankKws.reduce(
          (acc, k) => acc + (k.visibilityScore ?? k.cachedKpis?.visibilityScore ?? 0),
          0
        );

        sumLocationAvgRanks += locRankSum / validRankKws.length;
        sumLocationVisibility += locVisSum / validRankKws.length;
      } else if (loc.cachedKpis?.averagePosition && loc.cachedKpis.averagePosition > 0) {
        scannedLocationsCount++;
        sumLocationAvgRanks += loc.cachedKpis.averagePosition;
        sumLocationVisibility += loc.cachedKpis.visibilityScore || 0;
      }
    }

    const avgLocalRank =
      scannedLocationsCount > 0 ? parseFloat((sumLocationAvgRanks / scannedLocationsCount).toFixed(1)) : null;
    const avgVisibilityScore =
      scannedLocationsCount > 0 ? parseFloat((sumLocationVisibility / scannedLocationsCount).toFixed(1)) : null;

    // 3. Compute Audit Health Index & Category Pillars
    const latestAuditByLocation = new Map<string, any>();
    for (const audit of audits) {
      const lid = audit.locationId.toString();
      if (!latestAuditByLocation.has(lid)) {
        latestAuditByLocation.set(lid, audit);
      }
    }

    const auditedLocationsCount = latestAuditByLocation.size;
    let sumAuditScores = 0;
    let newestAuditAt: Date | null = null;
    let oldestAuditAt: Date | null = null;
    let hasStaleAudits = false;
    const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

    let sumProfileComp = 0;
    let sumKeywordsPillar = 0;
    let sumMedia = 0;
    let sumReviews = 0;
    let sumCitations = 0;

    for (const audit of latestAuditByLocation.values()) {
      sumAuditScores += audit.score || 0;
      const auditDate = new Date(audit.createdAt);

      if (!newestAuditAt || auditDate > newestAuditAt) newestAuditAt = auditDate;
      if (!oldestAuditAt || auditDate < oldestAuditAt) oldestAuditAt = auditDate;

      if (Date.now() - auditDate.getTime() > STALE_THRESHOLD_MS) {
        hasStaleAudits = true;
      }

      for (const cat of audit.categoryScores || []) {
        const pillar = (cat.pillar || '').toUpperCase();
        const pct =
          cat.percentage ?? (cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0);
        if (pillar.includes('PROFILE') || pillar.includes('COMPLETENESS')) sumProfileComp += pct;
        else if (pillar.includes('KEYWORD') || pillar.includes('RELEVANCE')) sumKeywordsPillar += pct;
        else if (pillar.includes('MEDIA') || pillar.includes('PHOTO')) sumMedia += pct;
        else if (pillar.includes('REVIEW') || pillar.includes('REPUTATION')) sumReviews += pct;
        else if (pillar.includes('CITATION') || pillar.includes('NAP')) sumCitations += pct;
      }
    }

    const gbpHealthIndex =
      auditedLocationsCount > 0 ? Math.round(sumAuditScores / auditedLocationsCount) : null;
    const auditPillars = {
      profileCompleteness:
        auditedLocationsCount > 0 ? Math.round(sumProfileComp / auditedLocationsCount) : 0,
      keywords: auditedLocationsCount > 0 ? Math.round(sumKeywordsPillar / auditedLocationsCount) : 0,
      media: auditedLocationsCount > 0 ? Math.round(sumMedia / auditedLocationsCount) : 0,
      reviews: auditedLocationsCount > 0 ? Math.round(sumReviews / auditedLocationsCount) : 0,
      citations: auditedLocationsCount > 0 ? Math.round(sumCitations / auditedLocationsCount) : 0,
    };

    // 4. Sparse & Honest Rank Momentum (Group by actual scan date)
    const scanDateGroups = new Map<string, { rankSum: number; visSum: number; count: number }>();
    for (const s of scans) {
      const completedAt = s.completedAt || s.createdAt;
      if (!completedAt) continue;
      const dateKey = new Date(completedAt).toISOString().split('T')[0];
      const metrics = s.metrics;
      if (!metrics) continue;

      const rank = metrics.atrp || metrics.arp || 21;
      const vis = metrics.visibilityIndex || 0;

      let group = scanDateGroups.get(dateKey);
      if (!group) {
        group = { rankSum: 0, visSum: 0, count: 0 };
        scanDateGroups.set(dateKey, group);
      }
      group.rankSum += rank;
      group.visSum += vis;
      group.count++;
    }

    const rankMomentum = Array.from(scanDateGroups.entries())
      .map(([date, data]) => ({
        date,
        avgRank: parseFloat((data.rankSum / data.count).toFixed(1)),
        visibilityScore: parseFloat((data.visSum / data.count).toFixed(1)),
        scanCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result: IWorkspaceDashboardMetrics = {
      avgLocalRank,
      avgVisibilityScore,
      gbpHealthIndex,
      coverage: {
        totalLocations,
        scannedLocations: scannedLocationsCount,
        auditedLocations: auditedLocationsCount,
      },
      auditPillars,
      auditFreshness: {
        newestAuditAt,
        oldestAuditAt,
        hasStaleAudits,
      },
      rankMomentum,
    };

    try {
      await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 60);
    } catch {}

    return result;
  }
}

export const locationService = new LocationService();

import mongoose from 'mongoose';
import { IGbpDiscoveredLocation } from '@localo/types';
import { Location, LocationDocument } from '../../models/Location';
import { GoogleConnection } from '../../models/GoogleConnection';
import { Workspace } from '../../models/Workspace';
import { AuditLog } from '../../models/AuditLog';
import { googleVaultService } from './google-vault.service';
import { gbpClientService } from './gbp-client.service';
import { onLocationConnected } from '../../events/location-connected.hook';

export interface BatchImportResult {
  imported: LocationDocument[];
  skipped: Array<{
    placeId?: string | null;
    locationName: string;
    reason: 'QUOTA_EXCEEDED' | 'ALREADY_EXISTS' | string;
  }>;
}

export class GbpImportService {
  /**
   * Discovers all Google Business Profile locations for a workspace's connected account(s)
   */
  public async getDiscoveredLocations(workspaceId: string): Promise<IGbpDiscoveredLocation[]> {
    const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
    const connections = await GoogleConnection.find({ workspaceId: wsObjectId, status: 'CONNECTED' });
    if (connections.length === 0) {
      return [];
    }

    const allDiscovered: IGbpDiscoveredLocation[] = [];

    // Fan-out discovery across connected accounts (all bound by GoogleLimiter in gbpClientService)
    for (const conn of connections) {
      try {
        const accessToken = await googleVaultService.getValidAccessToken(workspaceId, conn.googleEmail);
        const accounts = await gbpClientService.listAccounts(accessToken, workspaceId);

        for (const acc of accounts) {
          const locations = await gbpClientService.listLocations(accessToken, acc.name, workspaceId);
          allDiscovered.push(
            ...locations.map((loc) => ({
              ...loc,
              accountEmail: conn.googleEmail,
            }))
          );
        }
      } catch (err: any) {
        const discoveryError: any = new Error(
          `Could not discover Google Business Profile locations. ${err?.message || 'Google returned an unexpected error.'}`
        );
        discoveryError.statusCode = err?.statusCode || 502;
        discoveryError.code = err?.code || 'GBP_DISCOVERY_FAILED';
        throw discoveryError;
      }
    }

    // Check which ones are already active in the workspace
    const existingActiveLocations = await Location.find({
      workspaceId: wsObjectId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    const activePlaceIds = new Set(existingActiveLocations.map((l) => l.placeId).filter(Boolean));
    const activeGbpIds = new Set(existingActiveLocations.map((l) => l.gbpLocationId).filter(Boolean));

    return allDiscovered.map((loc) => {
      const isImported =
        (loc.placeId && activePlaceIds.has(loc.placeId)) ||
        (loc.gbpLocationId && activeGbpIds.has(loc.gbpLocationId));

      const matchedLoc = existingActiveLocations.find(
        (l) => (loc.placeId && l.placeId === loc.placeId) || (loc.gbpLocationId && l.gbpLocationId === loc.gbpLocationId)
      );

      return {
        ...loc,
        isImported: !!isImported && matchedLoc?.ownershipVerified === true,
        importedLocationId: matchedLoc?._id?.toString() || null,
        needsUpgrade: !!matchedLoc && matchedLoc.ownershipVerified === false,
      };
    });
  }

  /**
   * Imports a discovered Google location into the workspace with quota checks & soft-delete undelete support (§0 #12)
   * If an unverified location (from Places search) exists, it upgrades it in-place to ownershipVerified: true!
   */
  public async importLocation(
    workspaceId: string,
    userId: string,
    locationData: IGbpDiscoveredLocation
  ): Promise<LocationDocument> {
    const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
    const workspace = await Workspace.findById(wsObjectId);
    if (!workspace) {
      const err: any = new Error('WORKSPACE_NOT_FOUND');
      err.statusCode = 404;
      throw err;
    }

    const connection = locationData.accountEmail
      ? await GoogleConnection.findOne({ workspaceId: wsObjectId, googleEmail: locationData.accountEmail, status: 'CONNECTED' })
      : await GoogleConnection.findOne({ workspaceId: wsObjectId, status: 'CONNECTED' });

    if (!connection) {
      const err: any = new Error('GOOGLE_CONNECTION_INACTIVE');
      err.statusCode = 409;
      throw err;
    }

    // Re-read selected profile data from Google before trusting the browser payload.
    let profileData = locationData;
    const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
    if (!accessToken.startsWith('mock_')) {
      const accountName = locationData.gbpAccountId;
      const locationName = locationData.gbpLocationId;
      if (!accountName || !locationName || !/^accounts\/[A-Za-z0-9_-]+$/.test(accountName) || !/^locations\/[A-Za-z0-9_-]+$/.test(locationName)) {
        const err: any = new Error('Google returned an invalid account or location identifier. Refresh the listings and try again.');
        err.statusCode = 400;
        err.code = 'INVALID_GBP_LOCATION';
        throw err;
      }

      const accounts = await gbpClientService.listAccounts(accessToken, workspaceId);
      if (!accounts.some((account) => account.name === accountName)) {
        const err: any = new Error('The connected Google account does not have access to this Business Profile. Reconnect the managing Google account and refresh the list.');
        err.statusCode = 403;
        err.code = 'GBP_ACCOUNT_NOT_ACCESSIBLE';
        throw err;
      }

      const liveSnapshot = await gbpClientService.getLocationSnapshot(
        accessToken,
        accountName,
        locationName,
        workspaceId
      );
      profileData = { ...liveSnapshot, accountEmail: connection.googleEmail };
    }

    // 1. Check if location is already actively present in workspace
    const existingActive = await Location.findOne({
      workspaceId: wsObjectId,
      $or: [
        { placeId: profileData.placeId, deletedAt: null },
        { gbpLocationId: profileData.gbpLocationId, deletedAt: null },
      ].filter((clause) => Object.values(clause)[0] !== undefined),
    });

    if (existingActive) {
      // UPGRADE PATH: If already present but unverified (added via Places search/manual entry), upgrade in-place!
      if (!existingActive.ownershipVerified) {
        existingActive.ownershipVerified = true;
        existingActive.addedVia = 'gbp_import';
        existingActive.gbpAccountId = profileData.gbpAccountId || existingActive.gbpAccountId;
        existingActive.gbpLocationId = profileData.gbpLocationId || existingActive.gbpLocationId;
        existingActive.googleConnectionId = connection._id as mongoose.Types.ObjectId;
        existingActive.syncStatus = profileData.mediaSyncError ? 'ERROR' : 'SYNCED';
        existingActive.syncError = profileData.mediaSyncError || null;
        existingActive.lastSyncedAt = new Date();
        existingActive.deletedAt = null;

        if (profileData.name) existingActive.name = profileData.name;
        if (profileData.address) existingActive.address = profileData.address;
        if (profileData.city) existingActive.city = profileData.city;
        if (profileData.state) existingActive.state = profileData.state;
        if (profileData.country) existingActive.country = profileData.country;
        if (profileData.postalCode) existingActive.postalCode = profileData.postalCode;
        if (profileData.coordinates) existingActive.coordinates = profileData.coordinates;
        if (profileData.primaryCategory) existingActive.primaryCategory = profileData.primaryCategory;
        if (profileData.secondaryCategories) existingActive.secondaryCategories = profileData.secondaryCategories;
        existingActive.categories = [profileData.primaryCategory?.displayName, ...(profileData.secondaryCategories || []).map((category) => category.displayName)].filter((value): value is string => Boolean(value));
        if (profileData.phone) existingActive.phone = profileData.phone;
        if (profileData.website) existingActive.website = profileData.website;
        if (profileData.description !== undefined) existingActive.description = profileData.description;
        if (profileData.regularHours) existingActive.regularHours = profileData.regularHours;
        if (profileData.photosCount !== undefined) existingActive.photosCount = profileData.photosCount;
        if (profileData.coverPhotoUrl) existingActive.coverPhotoUrl = profileData.coverPhotoUrl;
        if (profileData.logoUrl) existingActive.logoUrl = profileData.logoUrl;
        if (profileData.mediaSyncedAt) existingActive.mediaSyncedAt = new Date(profileData.mediaSyncedAt);

        const upgraded = await existingActive.save();

        await AuditLog.create({
          workspaceId: wsObjectId,
          actorUserId: userId,
          action: 'LOCATION_UPGRADED_GBP',
          resourceType: 'Location',
          resourceId: upgraded._id.toString(),
          metadata: {
            locationName: upgraded.name,
            placeId: upgraded.placeId,
            gbpLocationId: upgraded.gbpLocationId,
          },
        });

        await onLocationConnected(upgraded._id.toString(), workspaceId, userId);
        return upgraded;
      }

      // If already verified, reject duplicate
      const err: any = new Error('LOCATION_ALREADY_IMPORTED');
      err.statusCode = 409;
      throw err;
    }

    // 2. Check workspace location quotas (§4.3)
    const activeCount = await Location.countDocuments({
      workspaceId: wsObjectId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });
    const maxLocations = workspace.limits?.locations ?? 1;

    if (activeCount >= maxLocations) {
      const err: any = new Error('LOCATION_LIMIT_EXCEEDED');
      err.statusCode = 402;
      throw err;
    }

    // 3. Check if there is a soft-deleted location to undelete & update (§0 #12)
    const softDeleted = await Location.findOne({
      workspaceId: wsObjectId,
      deletedAt: { $ne: null },
      $or: [
        ...(profileData.placeId ? [{ placeId: profileData.placeId }] : []),
        ...(profileData.gbpLocationId ? [{ gbpLocationId: profileData.gbpLocationId }] : []),
      ],
    });

    let savedLocation: LocationDocument;

    if (softDeleted) {
      // Re-import after soft-delete: Undelete and update in place (§0 #12)
      softDeleted.deletedAt = null;
      softDeleted.name = profileData.name;
      softDeleted.address = profileData.address;
      softDeleted.city = profileData.city;
      softDeleted.state = profileData.state;
      softDeleted.country = profileData.country;
      softDeleted.postalCode = profileData.postalCode || softDeleted.postalCode;
      softDeleted.coordinates = profileData.coordinates || softDeleted.coordinates;
      softDeleted.primaryCategory = profileData.primaryCategory || softDeleted.primaryCategory;
      softDeleted.secondaryCategories = profileData.secondaryCategories || softDeleted.secondaryCategories;
      softDeleted.phone = profileData.phone || softDeleted.phone;
      softDeleted.website = profileData.website || softDeleted.website;
      softDeleted.description = profileData.description || softDeleted.description;
      softDeleted.regularHours = profileData.regularHours || softDeleted.regularHours;
      softDeleted.photosCount = profileData.photosCount ?? softDeleted.photosCount;
      softDeleted.coverPhotoUrl = profileData.coverPhotoUrl || softDeleted.coverPhotoUrl;
      softDeleted.logoUrl = profileData.logoUrl || softDeleted.logoUrl;
      softDeleted.mediaSyncedAt = profileData.mediaSyncedAt ? new Date(profileData.mediaSyncedAt) : softDeleted.mediaSyncedAt;
      softDeleted.googleConnectionId = connection._id as mongoose.Types.ObjectId;
      softDeleted.ownershipVerified = true;
      softDeleted.addedVia = 'gbp_import';
      softDeleted.syncStatus = profileData.mediaSyncError ? 'ERROR' : 'SYNCED';
      softDeleted.syncError = profileData.mediaSyncError || null;
      softDeleted.lastSyncedAt = new Date();

      savedLocation = await softDeleted.save();
    } else {
      // Fresh new import
      savedLocation = await Location.create({
        workspaceId: wsObjectId,
        name: profileData.name,
        address: profileData.address,
        city: profileData.city,
        state: profileData.state,
        country: profileData.country,
        postalCode: profileData.postalCode,
        coordinates: profileData.coordinates,
        placeId: profileData.placeId,
        gbpAccountId: profileData.gbpAccountId,
        gbpLocationId: profileData.gbpLocationId,
        googleConnectionId: connection._id,
        ownershipVerified: true,
        addedVia: 'gbp_import',
        primaryCategory: profileData.primaryCategory,
        secondaryCategories: profileData.secondaryCategories || [],
        categories: [profileData.primaryCategory?.displayName, ...(profileData.secondaryCategories || []).map((category) => category.displayName)].filter((value): value is string => Boolean(value)),
        regularHours: profileData.regularHours || {},
        description: profileData.description || '',
        photosCount: profileData.photosCount || 0,
        coverPhotoUrl: profileData.coverPhotoUrl || null,
        logoUrl: profileData.logoUrl || null,
        mediaSyncedAt: profileData.mediaSyncedAt ? new Date(profileData.mediaSyncedAt) : null,
        syncStatus: profileData.mediaSyncError ? 'ERROR' : 'SYNCED',
        syncError: profileData.mediaSyncError || null,
        lastSyncedAt: new Date(),
        deletedAt: null,
        status: 'active',
      });
    }

    // 4. Audit Log
    await AuditLog.create({
      workspaceId: wsObjectId,
      actorUserId: userId,
      action: 'LOCATION_IMPORTED_GBP',
      resourceType: 'Location',
      resourceId: savedLocation._id.toString(),
      metadata: {
        locationName: savedLocation.name,
        placeId: savedLocation.placeId,
        gbpLocationId: savedLocation.gbpLocationId,
      },
    });

    // 5. Auto-trigger 17-point audit hook (§Auto-Audit on Connect)
    await onLocationConnected(savedLocation._id.toString(), workspaceId, userId);

    return savedLocation;
  }

  /**
   * Batch imports multiple discovered locations with per-item atomic quota checks (§Batch Import Hardened)
   * Non-throwing partial success: returns imported and skipped arrays.
   */
  public async batchImportLocations(
    workspaceId: string,
    userId: string,
    locations: IGbpDiscoveredLocation[]
  ): Promise<BatchImportResult> {
    const imported: LocationDocument[] = [];
    const skipped: Array<{
      placeId?: string | null;
      locationName: string;
      reason: 'QUOTA_EXCEEDED' | 'ALREADY_EXISTS' | string;
    }> = [];

    for (const loc of locations) {
      try {
        const result = await this.importLocation(workspaceId, userId, loc);
        imported.push(result);
      } catch (err: any) {
        if (err.message === 'LOCATION_LIMIT_EXCEEDED' || err.statusCode === 402) {
          skipped.push({
            placeId: loc.placeId,
            locationName: loc.name || 'Unknown Location',
            reason: 'QUOTA_EXCEEDED',
          });
        } else if (err.message === 'LOCATION_ALREADY_IMPORTED' || err.statusCode === 409) {
          skipped.push({
            placeId: loc.placeId,
            locationName: loc.name || 'Unknown Location',
            reason: 'ALREADY_EXISTS',
          });
        } else {
          skipped.push({
            placeId: loc.placeId,
            locationName: loc.name || 'Unknown Location',
            reason: err.message || 'Import failed',
          });
        }
      }
    }

    return { imported, skipped };
  }
}

export const gbpImportService = new GbpImportService();

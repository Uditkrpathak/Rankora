import mongoose from 'mongoose';
import { Location } from '../../models/Location';
import { ListingProtectionSnapshot, IProtectionSnapshotDocument, IProtectionIncident } from '../../models/ListingProtectionSnapshot';
import { ENV } from '../../config/env';
import { notificationService } from '../notifications/notification.service';

export class ProtectionService {
  /**
   * Retrieves or initializes the 24/7 Listing Protection snapshot for a location
   */
  public async getProtectionStatus(workspaceId: string, locationId: string): Promise<IProtectionSnapshotDocument> {
    const location = await Location.findOne({
      _id: locationId,
      workspaceId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!location) {
      throw Object.assign(new Error('Location not found in workspace.'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });
    }

    let snapshot = await ListingProtectionSnapshot.findOne({ locationId, workspaceId });
    if (!snapshot && location.placeId) {
      snapshot = await ListingProtectionSnapshot.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        locationId: new mongoose.Types.ObjectId(locationId),
        placeId: location.placeId,
        status: 'SECURE',
        lastCheckedAt: new Date(),
        baseline: {
          name: location.name,
          phone: location.phone,
          address: location.address,
          website: location.website,
          businessStatus: 'OPERATIONAL',
          rating: location.averageRating || undefined,
          userRatingCount: location.totalReviewCount || undefined,
        },
        current: {
          name: location.name,
          phone: location.phone,
          address: location.address,
          website: location.website,
          businessStatus: 'OPERATIONAL',
          rating: location.averageRating || undefined,
          userRatingCount: location.totalReviewCount || undefined,
        },
        incidents: [],
      });
    }

    if (!snapshot) {
      throw Object.assign(new Error('Location does not have a Google Place ID configured for live protection.'), {
        statusCode: 400,
        code: 'PLACE_ID_REQUIRED',
      });
    }

    return snapshot;
  }

  /**
   * Performs an on-demand or scheduled live Google Maps check to detect sabotage or malicious edits
   */
  public async checkProtection(workspaceId: string, locationId: string): Promise<IProtectionSnapshotDocument> {
    const location = await Location.findOne({
      _id: locationId,
      workspaceId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!location || !location.placeId) {
      throw Object.assign(new Error('Location has no active Place ID for Google Maps inspection.'), {
        statusCode: 400,
        code: 'PLACE_ID_REQUIRED',
      });
    }

    const snapshot = await this.getProtectionStatus(workspaceId, locationId);

    // Query live Google Places Details API
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ENV.GOOGLE_PLACES_API_KEY;
    let liveName = snapshot.baseline?.name || location.name;
    let livePhone = snapshot.baseline?.phone || location.phone;
    let liveAddress = snapshot.baseline?.address || location.address;
    let liveWebsite = snapshot.baseline?.website || location.website;
    let liveStatus = 'OPERATIONAL';
    let liveRating = snapshot.baseline?.rating;
    let liveReviews = snapshot.baseline?.userRatingCount;

    if (apiKey) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          location.placeId
        )}&fields=name,formatted_phone_number,formatted_address,website,business_status,rating,user_ratings_total&key=${apiKey}`;

        const res = await fetch(detailsUrl);
        if (res.ok) {
          const data: any = await res.json();
          if (data.status === 'OK' && data.result) {
            const p = data.result;
            liveName = p.name || liveName;
            livePhone = p.formatted_phone_number || livePhone;
            liveAddress = p.formatted_address || liveAddress;
            liveWebsite = p.website || liveWebsite;
            liveStatus = p.business_status || 'OPERATIONAL';
            liveRating = p.rating ?? liveRating;
            liveReviews = p.user_ratings_total ?? liveReviews;
          }
        }
      } catch (err) {
        console.warn('[ProtectionService] Google Places check warning:', err);
      }
    }

    // Compare live values with baseline
    const newIncidents: IProtectionIncident[] = [];

    // 1. Check Operating Status (Critical)
    if (liveStatus !== 'OPERATIONAL' && snapshot.baseline?.businessStatus === 'OPERATIONAL') {
      newIncidents.push({
        type: 'STATUS_CLOSED',
        field: 'businessStatus',
        previousValue: snapshot.baseline.businessStatus || 'OPERATIONAL',
        currentValue: liveStatus,
        severity: 'CRITICAL',
        message: `🚨 Critical Alert: Your Google Maps listing was marked as "${liveStatus.replace(/_/g, ' ')}" externally!`,
        detectedAt: new Date(),
        isResolved: false,
      });
    }

    // 2. Check Phone Number Hijacking (Critical)
    const normalizePhone = (num?: string) => (num || '').replace(/[^0-9]/g, '');
    if (
      snapshot.baseline?.phone &&
      livePhone &&
      normalizePhone(snapshot.baseline.phone) !== normalizePhone(livePhone)
    ) {
      newIncidents.push({
        type: 'PHONE_CHANGED',
        field: 'phone',
        previousValue: snapshot.baseline.phone,
        currentValue: livePhone,
        severity: 'CRITICAL',
        message: `🚨 Warning: Primary phone number on Google Maps changed from ${snapshot.baseline.phone} to ${livePhone}.`,
        detectedAt: new Date(),
        isResolved: false,
      });
    }

    // 3. Check Business Name Tampering (Warning)
    if (
      snapshot.baseline?.name &&
      liveName &&
      snapshot.baseline.name.trim().toLowerCase() !== liveName.trim().toLowerCase()
    ) {
      newIncidents.push({
        type: 'NAME_TAMPERED',
        field: 'name',
        previousValue: snapshot.baseline.name,
        currentValue: liveName,
        severity: 'WARNING',
        message: `⚠️ Business name modified on Google Maps: "${liveName}" (Expected: "${snapshot.baseline.name}").`,
        detectedAt: new Date(),
        isResolved: false,
      });
    }

    // 4. Check Address Drift (Warning)
    if (
      snapshot.baseline?.address &&
      liveAddress &&
      snapshot.baseline.address.length > 5 &&
      !liveAddress.toLowerCase().includes(snapshot.baseline.address.toLowerCase().slice(0, 10))
    ) {
      newIncidents.push({
        type: 'ADDRESS_MOVED',
        field: 'address',
        previousValue: snapshot.baseline.address,
        currentValue: liveAddress,
        severity: 'WARNING',
        message: `⚠️ Street address modified on Google Maps.`,
        detectedAt: new Date(),
        isResolved: false,
      });
    }

    // Append newly detected incidents without duplicates
    const incidentsList = snapshot.incidents || [];
    for (const inc of newIncidents) {
      const alreadyLogged = incidentsList.some(
        (existing) => existing.type === inc.type && !existing.isResolved
      );
      if (!alreadyLogged) {
        incidentsList.unshift(inc);

        // Dispatch in-app and email alert via Notification Center
        notificationService.createNotification({
          workspaceId,
          type: 'LISTING_PROTECTION',
          severity: inc.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          title: `🛡️ Google Maps Alert: ${inc.message}`,
          message: `Field "${inc.field}" changed on Google Maps. Baseline: "${inc.previousValue || '(None)'}" → Live: "${inc.currentValue || '(Missing)'}".`,
          link: `/dashboard`,
          metadata: {
            locationId,
            locationName: location.name,
            businessName: location.name,
            incidentType: inc.type,
            field: inc.field,
            previousValue: inc.previousValue,
            currentValue: inc.currentValue,
          },
        }).catch((err) => console.warn('[ProtectionService] Failed to dispatch protection alert:', err?.message));
      }
    }
    snapshot.incidents = incidentsList;

    // Determine aggregate protection status
    const hasUnresolvedCritical = incidentsList.some((i) => !i.isResolved && i.severity === 'CRITICAL');
    const hasUnresolvedWarning = incidentsList.some((i) => !i.isResolved && i.severity === 'WARNING');

    snapshot.status = hasUnresolvedCritical ? 'CRITICAL_SABOTAGE' : hasUnresolvedWarning ? 'DRIFT_DETECTED' : 'SECURE';
    snapshot.lastCheckedAt = new Date();
    snapshot.current = {
      name: liveName,
      phone: livePhone,
      address: liveAddress,
      website: liveWebsite,
      businessStatus: liveStatus,
      rating: liveRating,
      userRatingCount: liveReviews,
    };

    await snapshot.save();

    // Update location timestamp
    await Location.updateOne(
      { _id: locationId },
      { $set: { 'optimization.lastProtectedCheckAt': new Date(), 'optimization.protectionWatchdog': true } }
    );

    return snapshot;
  }

  /**
   * Resolves a protection incident and restores status to SECURE
   */
  public async resolveIncident(workspaceId: string, locationId: string, incidentId: string): Promise<IProtectionSnapshotDocument> {
    const snapshot = await ListingProtectionSnapshot.findOne({ workspaceId, locationId });
    if (!snapshot) {
      throw Object.assign(new Error('Protection snapshot not found.'), { statusCode: 404 });
    }

    const incidentsList = snapshot.incidents || [];
    const incident = incidentsList.find((i: any) => i._id?.toString() === incidentId || (i as any).id === incidentId);
    if (incident) {
      incident.isResolved = true;
      incident.resolvedAt = new Date();
    }

    const hasUnresolvedCritical = incidentsList.some((i) => !i.isResolved && i.severity === 'CRITICAL');
    const hasUnresolvedWarning = incidentsList.some((i) => !i.isResolved && i.severity === 'WARNING');

    snapshot.status = hasUnresolvedCritical ? 'CRITICAL_SABOTAGE' : hasUnresolvedWarning ? 'DRIFT_DETECTED' : 'SECURE';
    await snapshot.save();
    return snapshot;
  }
}

export const protectionService = new ProtectionService();

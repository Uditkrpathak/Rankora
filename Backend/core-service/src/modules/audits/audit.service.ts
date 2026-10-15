import mongoose from 'mongoose';
import { Audit, AuditDocument } from '../../models/Audit';
import { Location } from '../../models/Location';
import { AuditTask } from '../../models/AuditTask';
import { IAuditSignal, IAuditCategoryScore, AuditPillar, SignalSeverity, AuditTaskStatus } from '@localo/types';
import { AuditTaskStateMachine } from './audit-task-state-machine';
import { invalidateLocationChatCache } from '../chat/chat.cache';

export const CURRENT_AUDIT_VERSION = '1.1';
export const CURRENT_RULES_VERSION = '2026.3';

export class AuditService {
  /**
   * Runs the 17-point Local SEO audit against a location record
   */
  public async runAudit(locationId: string, workspaceId: string): Promise<AuditDocument> {
    if (!mongoose.Types.ObjectId.isValid(locationId) || !mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error(`Invalid locationId (${locationId}) or workspaceId (${workspaceId}) provided to runAudit`);
    }

    const location = await Location.findOne({
      _id: new mongoose.Types.ObjectId(locationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!location) {
      throw new Error(`Location ${locationId} not found in workspace ${workspaceId}`);
    }

    const { signals, categoryScores, totalScore, summary } = this.evaluateRules(location);

    const audit = await Audit.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      locationId: new mongoose.Types.ObjectId(locationId),
      auditVersion: CURRENT_AUDIT_VERSION,
      rulesVersion: CURRENT_RULES_VERSION,
      score: totalScore,
      categoryScores,
      signals,
      summary,
    });

    await this.syncTasksForAudit(audit);
    location.nextAuditAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await location.save();

    invalidateLocationChatCache(locationId).catch(() => {});

    return audit;
  }

  /**
   * Recalculates an existing historical audit explicitly with the current ruleset
   */
  public async recalculateAudit(auditId: string, workspaceId: string): Promise<AuditDocument> {
    const audit = await Audit.findOne({ _id: auditId, workspaceId });
    if (!audit) {
      throw new Error('Audit record not found');
    }

    const location = await Location.findOne({
      _id: new mongoose.Types.ObjectId(audit.locationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!location) {
      throw new Error('Associated location not found');
    }

    const { signals, categoryScores, totalScore, summary } = this.evaluateRules(location);
    const recalculatedSnapshot = await Audit.create({
      workspaceId: audit.workspaceId,
      locationId: audit.locationId,
      auditVersion: CURRENT_AUDIT_VERSION,
      rulesVersion: CURRENT_RULES_VERSION,
      score: totalScore,
      categoryScores,
      signals,
      summary,
      recalculatedAt: new Date(),
    });
    await this.syncTasksForAudit(recalculatedSnapshot);

    return recalculatedSnapshot;
  }

  public async getAuditById(auditId: string, workspaceId: string): Promise<AuditDocument | null> {
    return Audit.findOne({ _id: auditId, workspaceId });
  }

  public async getLocationAudits(locationId: string, workspaceId: string, limit: number = 20): Promise<AuditDocument[]> {
    return Audit.find({ locationId, workspaceId }).sort({ createdAt: -1 }).limit(limit);
  }

  public async getLocationTasks(locationId: string, workspaceId: string) {
    return AuditTask.find({
      locationId: new mongoose.Types.ObjectId(locationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      status: { $in: ['OPEN', 'PENDING_VERIFICATION', 'DONE', 'VERIFIED'] },
    }).sort({ status: 1, impact: -1, updatedAt: -1 });
  }

  public async updateTaskStatus(
    taskId: string,
    workspaceId: string,
    status: Extract<AuditTaskStatus, 'OPEN' | 'PENDING_VERIFICATION' | 'DONE' | 'VERIFIED' | 'DISMISSED'>
  ) {
    const normalized = status === 'DONE' ? 'PENDING_VERIFICATION' : status;
    return AuditTask.findOneAndUpdate(
      { _id: taskId, workspaceId },
      {
        $set: {
          status: normalized,
          completedAt: normalized === 'VERIFIED' ? new Date() : null,
        },
      },
      { new: true, runValidators: true }
    );
  }

  public async setAuditSchedule(locationId: string, workspaceId: string, enabled: boolean) {
    return Location.findOneAndUpdate(
      { _id: locationId, workspaceId, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
      { $set: { auditScheduleEnabled: enabled, nextAuditAt: enabled ? new Date() : null } },
      { new: true, runValidators: true }
    );
  }

  public async processDueAudits(now = new Date(), batchSize = 25): Promise<void> {
    const dueLocations = await Location.find({
      status: 'active',
      auditScheduleEnabled: { $ne: false },
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
      ],
      $and: [{ $or: [{ nextAuditAt: null }, { nextAuditAt: { $lte: now } }] }],
    }).sort({ nextAuditAt: 1 }).limit(batchSize);

    for (const location of dueLocations) {
      const claim = await Location.findOneAndUpdate(
        { _id: location._id, auditScheduleEnabled: { $ne: false }, nextAuditAt: location.nextAuditAt ?? null },
        { $set: { nextAuditAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
        { new: true }
      );
      if (!claim) continue;
      try {
        await this.runAudit(location._id.toString(), location.workspaceId.toString());
      } catch (error) {
        console.error(`[Audit Scheduler] Audit failed for location ${location._id}:`, error);
        await Location.updateOne(
          { _id: location._id, auditScheduleEnabled: { $ne: false } },
          { $set: { nextAuditAt: new Date(now.getTime() + 6 * 60 * 60 * 1000) } }
        );
      }
    }
  }

  private async syncTasksForAudit(audit: AuditDocument): Promise<void> {
    const failedSignals = audit.signals.filter((signal) => !signal.passed && signal.severity !== 'UNKNOWN');
    const passedSignals = audit.signals.filter((signal) => signal.passed && signal.severity === 'PASS');
    const passedCodes = passedSignals.map((s) => s.code);

    // 1. Process failed / actionable signals through AuditTaskStateMachine (handles regressions & resurrects dismissed)
    for (const signal of failedSignals) {
      const severityFactor = signal.severity === 'CRITICAL' ? 1.5 : signal.severity === 'WARNING' ? 1 : 0.7;
      const existingTask = await AuditTask.findOne({
        workspaceId: audit.workspaceId,
        locationId: audit.locationId,
        signalCode: signal.code,
      });

      const currentStatus = existingTask?.status || 'OPEN';
      const transition = AuditTaskStateMachine.getNextStatus(currentStatus, 'AUDIT_SIGNAL_FAILED');

      await AuditTask.findOneAndUpdate(
        { workspaceId: audit.workspaceId, locationId: audit.locationId, signalCode: signal.code },
        {
          $set: {
            auditId: audit._id,
            title: signal.name,
            pillar: signal.pillar,
            whyItMatters: signal.explanation || `${signal.name} is below the recommended standard.`,
            recommendedAction: signal.remediationTip,
            destination: 'https://business.google.com/locations',
            impact: Math.round(signal.weight * severityFactor * 100) / 100,
            potentialGain: signal.weight,
            baselineAuditScore: existingTask?.baselineAuditScore ?? audit.score,
            status: transition.newStatus,
            completedAt: transition.isVerified ? new Date() : null,
          },
          $setOnInsert: { workspaceId: audit.workspaceId, locationId: audit.locationId, signalCode: signal.code },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    // 2. Process passing signals through AuditTaskStateMachine ONLY for explicitly passing codes
    if (passedCodes.length > 0) {
      const passingTasks = await AuditTask.find({
        workspaceId: audit.workspaceId,
        locationId: audit.locationId,
        signalCode: { $in: passedCodes },
      });

      for (const task of passingTasks) {
        const transition = AuditTaskStateMachine.getNextStatus(task.status, 'AUDIT_SIGNAL_PASSED');
        if (transition.newStatus !== task.status) {
          task.status = transition.newStatus;
          if (transition.isVerified) {
            task.completedAt = new Date();
            task.completedAuditScore = audit.score;
            task.auditId = audit._id;
          }
          await task.save();
        }
      }
    }
  }

  /**
   * Evaluates the 17 criteria across all Local SEO dimensions
   */
  public evaluateRules(loc: any): {
    signals: IAuditSignal[];
    categoryScores: IAuditCategoryScore[];
    totalScore: number;
    summary: { criticalCount: number; warningCount: number; optimizationCount: number; passedCount: number; unknownCount: number };
  } {
    const signals: IAuditSignal[] = [];
    const now = Date.now();
    const freshnessWindowMs = 30 * 24 * 60 * 60 * 1000;
    const placesFetchedAt = loc.placesDetailsFetchedAt || (loc.addedVia === 'places_search' ? loc.createdAt : null);
    const placesDataAgeMs = placesFetchedAt ? now - new Date(placesFetchedAt).getTime() : Number.POSITIVE_INFINITY;
    const hasFreshPlacesData = loc.addedVia === 'places_search' && placesDataAgeMs >= 0 && placesDataAgeMs <= freshnessWindowMs;
    const gbpSyncAgeMs = loc.lastSyncedAt ? now - new Date(loc.lastSyncedAt).getTime() : Number.POSITIVE_INFINITY;
    const hasFreshGbpSnapshot = loc.syncStatus === 'SYNCED' && Boolean(loc.gbpLocationId) && gbpSyncAgeMs >= 0 && gbpSyncAgeMs <= freshnessWindowMs;

    // 1. CAT-01: Primary Category Configured (Weight: 8)
    const hasPrimaryCat = Boolean(loc.primaryCategory?.displayName || loc.primaryCategory?.id);
    signals.push({
      code: 'CAT-01',
      name: 'Primary GBP Category Configured',
      pillar: 'CATEGORIES',
      weight: 8,
      score: hasPrimaryCat ? 8 : 0,
      severity: hasPrimaryCat ? 'PASS' : 'CRITICAL',
      passed: hasPrimaryCat,
      actualValue: loc.primaryCategory?.displayName || 'None',
      recommendedValue: 'Primary Category matching core business service',
      remediationTip: 'Select a precise primary category that accurately defines your main service offering.',
    });

    // 2. CAT-02: Secondary Categories Added (Weight: 5)
    const secCatCount = Array.isArray(loc.secondaryCategories) ? loc.secondaryCategories.length : 0;
    const passedSecCat = secCatCount >= 2;
    signals.push({
      code: 'CAT-02',
      name: 'Secondary Categories Volume',
      pillar: 'CATEGORIES',
      weight: 5,
      score: secCatCount >= 2 ? 5 : secCatCount === 1 ? 3 : 0,
      severity: passedSecCat ? 'PASS' : secCatCount === 1 ? 'OPTIMIZATION' : 'WARNING',
      passed: passedSecCat,
      actualValue: `${secCatCount} secondary categories`,
      recommendedValue: 'At least 2-5 relevant secondary categories',
      remediationTip: 'Add 2 to 5 relevant secondary categories to capture broader local discovery queries.',
    });

    // 3. NAP-01: Business Name Formatting & Keyword Stuffing Check (Weight: 6)
    const name = (loc.name || '').trim();
    const hasSpamPattern = /(best|cheap|#1|top)\s+(near me|in\s+[a-z]+)/i.test(name);
    const validName = name.length >= 2 && !hasSpamPattern;
    signals.push({
      code: 'NAP-01',
      name: 'Business Name Compliance',
      pillar: 'NAP_CORE',
      weight: 6,
      score: validName ? 6 : 2,
      severity: validName ? 'PASS' : 'WARNING',
      passed: validName,
      actualValue: name || 'Missing',
      recommendedValue: 'Official registered business name without extraneous keywords',
      remediationTip: 'Ensure business name matches signage and official branding without artificial keyword stuffing.',
    });

    // 4. NAP-02: Address Completeness & Map Coordinates (Weight: 6)
    const hasAddress = Boolean(loc.address && loc.city && loc.country);
    const hasCoords = Boolean(loc.coordinates?.lat && loc.coordinates?.lng);
    const addressPassed = hasAddress && hasCoords;
    signals.push({
      code: 'NAP-02',
      name: 'Physical Address & Pin Verification',
      pillar: 'NAP_CORE',
      weight: 6,
      score: addressPassed ? 6 : hasAddress ? 3 : 0,
      severity: addressPassed ? 'PASS' : 'CRITICAL',
      passed: addressPassed,
      actualValue: hasAddress ? `${loc.address}, ${loc.city}` : 'Incomplete Address',
      recommendedValue: 'Complete physical street address with exact map coordinates',
      remediationTip: 'Provide full street address, city, postal code, and verified map pin coordinates.',
    });

    // 5. NAP-03: Primary Telephone Configured (Weight: 5)
    const hasPhone = Boolean(loc.phone && loc.phone.length >= 7);
    signals.push({
      code: 'NAP-03',
      name: 'Direct Phone Number',
      pillar: 'NAP_CORE',
      weight: 5,
      score: hasPhone ? 5 : 0,
      severity: hasPhone ? 'PASS' : 'CRITICAL',
      passed: hasPhone,
      actualValue: loc.phone || 'Missing',
      recommendedValue: 'Direct local phone number formatted in E.164 standard',
      remediationTip: 'Configure a primary local phone number so prospective customers can connect directly.',
    });

    // 6. HRS-01: Regular Operating Hours Configured (Weight: 6)
    const regularHours = loc.regularHours || {};
    const openDaysCount = Object.keys(regularHours).filter((day) => !regularHours[day]?.isClosed).length;
    const hoursPassed = openDaysCount >= 5;
    signals.push({
      code: 'HRS-01',
      name: 'Regular Weekly Operating Hours',
      pillar: 'HOURS',
      weight: 6,
      score: hoursPassed ? 6 : openDaysCount > 0 ? 3 : 0,
      severity: hoursPassed ? 'PASS' : openDaysCount > 0 ? 'WARNING' : 'CRITICAL',
      passed: hoursPassed,
      actualValue: `${openDaysCount} open days configured`,
      recommendedValue: 'Complete operating schedule for all days of the week',
      remediationTip: 'Specify complete opening and closing hours for each day of the week.',
    });

    // 7. HRS-02: Special / Holiday Hours (Weight: 4)
    const specialHours = Array.isArray(loc.specialHours) ? loc.specialHours : [];
    const specialPassed = specialHours.length > 0;
    signals.push({
      code: 'HRS-02',
      name: 'Holiday & Special Hours',
      pillar: 'HOURS',
      weight: 4,
      score: specialPassed ? 4 : 0,
      severity: specialPassed ? 'PASS' : 'OPTIMIZATION',
      passed: specialPassed,
      actualValue: `${specialHours.length} special dates`,
      recommendedValue: 'Upcoming holiday exceptions configured',
      remediationTip: 'Add special hours for upcoming public holidays and seasonal schedule changes.',
    });

    // 8. DES-01: Business Description Richness (>250 chars) (Weight: 6)
    const desc = (loc.description || '').trim();
    const descPassed = desc.length >= 250;
    signals.push({
      code: 'DES-01',
      name: 'Business Description Richness',
      pillar: 'CONTENT',
      weight: 6,
      score: descPassed ? 6 : desc.length >= 100 ? 3 : 0,
      severity: descPassed ? 'PASS' : desc.length >= 100 ? 'OPTIMIZATION' : 'WARNING',
      passed: descPassed,
      actualValue: `${desc.length} characters`,
      recommendedValue: 'Rich description (> 250 characters) detailing unique value propositions',
      remediationTip: 'Write a comprehensive business description covering services, history, and unique selling points.',
    });

    // 9. PHT-01: Photo Volume & Variety (>= 10 photos) (Weight: 6)
    const photoCount = loc.photosCount ?? (loc.media?.length || 0);
    const photosPassed = photoCount >= 10;
    signals.push({
      code: 'PHT-01',
      name: 'Visual Photo Assets Volume',
      pillar: 'VISUALS',
      weight: 6,
      score: photosPassed ? 6 : photoCount >= 5 ? 3 : 0,
      severity: photosPassed ? 'PASS' : photoCount >= 5 ? 'OPTIMIZATION' : 'WARNING',
      passed: photosPassed,
      actualValue: `${photoCount} photos`,
      recommendedValue: 'At least 10 high-resolution interior, exterior, and team photos',
      remediationTip: 'Upload at least 10 high-quality photos showing your storefront, team, and work.',
    });

    // 10. PHT-02: Cover Photo & Logo Configured (Weight: 4)
    const hasCover = Boolean(loc.coverPhotoUrl || loc.hasCoverPhoto);
    const hasLogo = Boolean(loc.logoUrl || loc.hasLogo);
    const brandingPassed = hasCover && hasLogo;
    signals.push({
      code: 'PHT-02',
      name: 'Logo & Cover Photo Branding',
      pillar: 'VISUALS',
      weight: 4,
      score: brandingPassed ? 4 : hasCover || hasLogo ? 2 : 0,
      severity: brandingPassed ? 'PASS' : 'OPTIMIZATION',
      passed: brandingPassed,
      actualValue: `Cover: ${hasCover ? 'Yes' : 'No'}, Logo: ${hasLogo ? 'Yes' : 'No'}`,
      recommendedValue: 'Both official Logo and Cover Photo configured',
      remediationTip: 'Upload high-resolution Logo and Cover images to enhance brand recognition in search results.',
    });

    // 11. REV-01: Average Review Rating Threshold (>= 4.2) (Weight: 8)
    const rating = loc.averageRating ?? loc.rating ?? 0;
    const ratingPassed = rating >= 4.2;
    signals.push({
      code: 'REV-01',
      name: 'Customer Review Rating Benchmark',
      pillar: 'REPUTATION',
      weight: 8,
      score: rating >= 4.5 ? 8 : rating >= 4.2 ? 6 : rating >= 3.8 ? 3 : 0,
      severity: ratingPassed ? 'PASS' : rating >= 3.8 ? 'WARNING' : 'CRITICAL',
      passed: ratingPassed,
      actualValue: `${rating > 0 ? rating.toFixed(1) : 'No rating'} ★`,
      recommendedValue: 'Average rating of 4.2 stars or higher',
      remediationTip: 'Deliver exceptional customer experiences and actively encourage satisfied customers to leave feedback.',
    });

    // 12. REV-02: Total Review Volume Threshold (>= 20 reviews) (Weight: 7)
    const reviewCount = loc.totalReviewCount ?? loc.reviewsCount ?? 0;
    const reviewVolPassed = reviewCount >= 20;
    signals.push({
      code: 'REV-02',
      name: 'Total Review Count Threshold',
      pillar: 'REPUTATION',
      weight: 7,
      score: reviewCount >= 50 ? 7 : reviewCount >= 20 ? 5 : reviewCount >= 5 ? 2 : 0,
      severity: reviewVolPassed ? 'PASS' : reviewCount >= 5 ? 'OPTIMIZATION' : 'WARNING',
      passed: reviewVolPassed,
      actualValue: `${reviewCount} reviews`,
      recommendedValue: 'At least 20+ verified customer reviews',
      remediationTip: 'Implement an automated review generation campaign to increase total customer review volume.',
    });

    // 13. REV-03: Review Response Rate (>= 85%) (Weight: 6)
    const responseRate = loc.reviewResponseRate ?? (reviewCount > 0 ? 80 : 100);
    const responsePassed = responseRate >= 85;
    signals.push({
      code: 'REV-03',
      name: 'Review Owner Response Rate',
      pillar: 'REPUTATION',
      weight: 6,
      score: responsePassed ? 6 : responseRate >= 50 ? 3 : 0,
      severity: responsePassed ? 'PASS' : 'OPTIMIZATION',
      passed: responsePassed,
      actualValue: `${responseRate}% response rate`,
      recommendedValue: 'Respond to at least 85% of all customer reviews',
      remediationTip: 'Reply promptly to all reviews to demonstrate active owner engagement and improve trust signals.',
    });

    // 14. REV-04: Review Recency (at least 1 review in past 30 days) (Weight: 5)
    const hasRecentReview = loc.hasRecentReview ?? (reviewCount > 0);
    signals.push({
      code: 'REV-04',
      name: 'Review Velocity & Recency',
      pillar: 'REPUTATION',
      weight: 5,
      score: hasRecentReview ? 5 : 0,
      severity: hasRecentReview ? 'PASS' : 'WARNING',
      passed: Boolean(hasRecentReview),
      actualValue: hasRecentReview ? 'Recent activity detected' : 'No recent reviews in last 30 days',
      recommendedValue: 'Consistent flow of new reviews within the past 30 days',
      remediationTip: 'Keep a consistent velocity of fresh reviews by prompting recent customers post-service.',
    });

    // 15. PST-01: Google Posts Frequency (at least 1 post in past 14 days) (Weight: 5)
    const hasRecentPost = loc.hasRecentPost ?? false;
    signals.push({
      code: 'PST-01',
      name: 'Google Business Posts Activity',
      pillar: 'ENGAGEMENT',
      weight: 5,
      score: hasRecentPost ? 5 : 0,
      severity: hasRecentPost ? 'PASS' : 'OPTIMIZATION',
      passed: Boolean(hasRecentPost),
      actualValue: hasRecentPost ? 'Active (<= 14 days)' : 'No recent posts published',
      recommendedValue: 'Publish at least 1 update, offer, or announcement every 14 days',
      remediationTip: 'Publish weekly Google Business Posts featuring promotions, news, and service highlights.',
    });

    // 16. ATR-01: Business Attributes & Amenities (Weight: 5)
    const attrCount = Array.isArray(loc.attributes) ? loc.attributes.length : (loc.attributesCount ?? 0);
    const attrPassed = attrCount >= 3;
    signals.push({
      code: 'ATR-01',
      name: 'Profile Attributes & Highlights',
      pillar: 'ATTRIBUTES',
      weight: 5,
      score: attrPassed ? 5 : attrCount > 0 ? 2 : 0,
      severity: attrPassed ? 'PASS' : 'OPTIMIZATION',
      passed: attrPassed,
      actualValue: `${attrCount} attributes configured`,
      recommendedValue: 'At least 3-5 verified accessibility, payment, and amenity attributes',
      remediationTip: 'Complete all relevant profile attributes including payment options, accessibility, and amenities.',
    });

    // 17. WEB-04: Website URL & LocalBusiness JSON-LD Schema (Weight: 8)
    const hasWebsite = Boolean(
      loc.website &&
      (loc.website.startsWith('http://') || loc.website.startsWith('https://') || loc.website.includes('.'))
    );
    const schemaVerified = loc.schemaVerification?.verified === true || loc.hasLocalBusinessSchema === true;
    const schemaChecked = Boolean(loc.schemaVerification);

    let webScore = 0;
    let webSeverity: SignalSeverity = 'CRITICAL';
    let webPassed = false;
    let webActual = 'Missing URL';

    if (!hasWebsite) {
      webScore = 0;
      webSeverity = 'CRITICAL';
      webPassed = false;
      webActual = 'Missing website URL';
    } else if (schemaVerified) {
      webScore = 8;
      webSeverity = 'PASS';
      webPassed = true;
      const types = loc.schemaVerification?.detectedTypes?.length
        ? loc.schemaVerification.detectedTypes.join(', ')
        : 'LocalBusiness';
      webActual = `${loc.website} (Schema: ${types})`;
    } else if (schemaChecked && !schemaVerified) {
      webScore = 4;
      webSeverity = 'OPTIMIZATION';
      webPassed = false;
      webActual = `${loc.website} (No LocalBusiness schema found)`;
    } else {
      webScore = 4;
      webSeverity = 'OPTIMIZATION';
      webPassed = false;
      webActual = `${loc.website} (Schema unmeasured — crawl pending)`;
    }

    signals.push({
      code: 'WEB-04',
      name: 'Website & LocalBusiness JSON-LD Schema',
      pillar: 'TECHNICAL',
      weight: 8,
      score: webScore,
      severity: webSeverity,
      passed: webPassed,
      actualValue: webActual,
      recommendedValue: 'Verified website URL with LocalBusiness structured JSON-LD schema',
      remediationTip: 'Link an active landing page and deploy schema.org/LocalBusiness JSON-LD markup.',
      evidenceSource: schemaChecked ? 'Automated LocalBusiness schema crawler' : 'Profile website URL',
      confidence: schemaChecked ? 'HIGH' : 'MEDIUM',
    });

    for (const signal of signals) {
      let hasData = true;

      if (signal.code === 'REV-01') {
        hasData = hasFreshPlacesData && typeof loc.averageRating === 'number' && loc.averageRating > 0;
      } else if (signal.code === 'REV-02') {
        hasData = hasFreshPlacesData && typeof loc.totalReviewCount === 'number';
      } else if (['REV-03', 'REV-04', 'PST-01', 'ATR-01'].includes(signal.code)) {
        // Owner reply rate, review recency, recent posts and attributes are not
        // collected by the current GBP sync. Stored schema defaults are not evidence.
        hasData = false;
      } else if (['PHT-01', 'PHT-02'].includes(signal.code)) {
        const mediaAgeMs = loc.mediaSyncedAt ? now - new Date(loc.mediaSyncedAt).getTime() : Number.POSITIVE_INFINITY;
        const hasFreshMedia = mediaAgeMs >= 0 && mediaAgeMs <= freshnessWindowMs;
        hasData = hasFreshMedia && (signal.code === 'PHT-02' || typeof loc.photosCount === 'number');
      } else if (
        loc.addedVia === 'places_search' &&
        !hasFreshPlacesData &&
        !hasFreshGbpSnapshot &&
        !(signal.code === 'WEB-04' && loc.schemaVerification)
      ) {
        hasData = false;
      }

      if (!hasData) {
        signal.severity = 'UNKNOWN';
        signal.passed = false;
        signal.score = 0;
        signal.actualValue = 'Not measured';
        signal.evidenceSource = 'No connected data source';
        signal.confidence = 'UNKNOWN';
        signal.explanation = ['REV-03', 'REV-04', 'PST-01', 'ATR-01'].includes(signal.code)
          ? 'This signal is not collected yet; it is excluded from the score until a verified data source is connected.'
          : 'This check needs a fresh source measurement. It is excluded from the score until that evidence is collected.';
      } else {
        if (signal.code === 'WEB-04' && loc.schemaVerification) {
          // Keep the actual crawler evidence instead of replacing it with profile provenance.
        } else if (hasFreshPlacesData && ['REV-01', 'REV-02'].includes(signal.code)) {
          signal.evidenceSource = `Google Maps public rating data · fetched ${new Date(placesFetchedAt).toISOString().slice(0, 10)} · ownership not verified`;
          signal.confidence = 'MEDIUM';
        } else if (hasFreshGbpSnapshot) {
          signal.evidenceSource = `Connected Google Business Profile snapshot · synced ${new Date(loc.lastSyncedAt).toISOString().slice(0, 10)}`;
          signal.confidence = gbpSyncAgeMs <= 7 * 24 * 60 * 60 * 1000 ? 'HIGH' : 'MEDIUM';
        } else if (hasFreshPlacesData) {
          signal.evidenceSource = `Google Maps public listing · fetched ${new Date(placesFetchedAt).toISOString().slice(0, 10)} · ownership not verified`;
          signal.confidence = 'MEDIUM';
        } else {
          signal.evidenceSource = 'User-entered profile data · not independently verified';
          signal.confidence = 'LOW';
        }
        signal.explanation = `Observed ${String(signal.actualValue ?? 'no value')}; recommended ${String(signal.recommendedValue ?? 'review this field')}.`;
      }
    }

    // Compute Category Aggregates using only checks with evidence.
    const pillarMap: Record<AuditPillar, { name: string; score: number; maxScore: number }> = {
      CATEGORIES: { name: 'Categories', score: 0, maxScore: 0 },
      NAP_CORE: { name: 'NAP & Core Info', score: 0, maxScore: 0 },
      HOURS: { name: 'Operating Hours', score: 0, maxScore: 0 },
      CONTENT: { name: 'Content & Description', score: 0, maxScore: 0 },
      VISUALS: { name: 'Visual Media & Assets', score: 0, maxScore: 0 },
      REPUTATION: { name: 'Reputation & Reviews', score: 0, maxScore: 0 },
      ENGAGEMENT: { name: 'Engagement & Posts', score: 0, maxScore: 0 },
      ATTRIBUTES: { name: 'Attributes & Features', score: 0, maxScore: 0 },
      TECHNICAL: { name: 'Technical & Website Schema', score: 0, maxScore: 0 },
    };

    let totalScore = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let optimizationCount = 0;
    let passedCount = 0;
    let unknownCount = 0;
    let knownWeight = 0;

    for (const sig of signals) {
      if (sig.severity === 'UNKNOWN') {
        unknownCount++;
        continue;
      }
      knownWeight += sig.weight;
      totalScore += sig.score;
      if (pillarMap[sig.pillar]) {
        pillarMap[sig.pillar].score += sig.score;
        pillarMap[sig.pillar].maxScore += sig.weight;
      }
      if (sig.severity === 'CRITICAL') criticalCount++;
      else if (sig.severity === 'WARNING') warningCount++;
      else if (sig.severity === 'OPTIMIZATION') optimizationCount++;
      else if (sig.severity === 'PASS') passedCount++;
    }

    const categoryScores: IAuditCategoryScore[] = Object.keys(pillarMap).map((k) => {
      const p = k as AuditPillar;
      const data = pillarMap[p];
      const percentage = data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
      return {
        pillar: p,
        name: data.name,
        score: data.score,
        maxScore: data.maxScore,
        percentage,
      };
    });

    return {
      signals,
      categoryScores,
      totalScore: knownWeight ? Math.min(100, Math.max(0, Math.round((totalScore / knownWeight) * 100))) : 0,
      summary: {
        criticalCount,
        warningCount,
        optimizationCount,
        passedCount,
        unknownCount,
      },
    };
  }
}

export const auditService = new AuditService();

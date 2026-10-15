import { TrackedKeyword } from '../models/TrackedKeyword';
import { ScanDocument } from '../models/Scan';
import { Location } from '../models/Location';
import { CompetitorService } from '../modules/competitors/competitor.service';
import { notificationService } from '../modules/notifications/notification.service';
import { invalidateLocationChatCache } from '../modules/chat/chat.cache';

type ScanWithMaterializableResults = ScanDocument & {
  status: 'COMPLETED' | 'PARTIAL';
  metrics: NonNullable<ScanDocument['metrics']>;
};

export function shouldSyncTrackedKeyword(
  scan: ScanDocument | null | undefined
): scan is ScanWithMaterializableResults {
  return Boolean(
    scan &&
    (scan.status === 'COMPLETED' || scan.status === 'PARTIAL') &&
    scan.keyword &&
    scan.locationId &&
    scan.metrics
  );
}

/**
 * Hook fired upon Scan completion to sync TrackedKeyword documents
 * Atomically updates currentRank, previousRank, visibilityScore, visibilityDelta, and pushes to sparkline (capped at 30)
 */
export async function onScanCompleted(scan: ScanDocument): Promise<void> {
  if (!shouldSyncTrackedKeyword(scan)) return;

  const normalized = scan.keyword.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  
  // Center pin (ring 0 / pinIndex 0) defines the headline center rank
  const centerPin = (scan.gridPoints || []).find((p: any) => p.pinIndex === 0 || p.ring === 0) || scan.gridPoints?.[0];
  const centerRank = typeof centerPin?.targetRank === 'number' && centerPin.targetRank > 0 && centerPin.targetRank <= 20
    ? centerPin.targetRank
    : null;
  const newRank = centerRank ?? (scan.metrics.arp ? Math.round(scan.metrics.arp) : null);
  const rankState = newRank && newRank >= 1 && newRank <= 20 ? 'RANKED' : (scan.status === 'COMPLETED' ? 'NOT_IN_TOP_20' : 'UNKNOWN');
  const newVisibility = Math.round(scan.metrics.visibilityIndex ?? 0);
  const now = scan.completedAt || new Date();
  const scanIdStr = String(scan._id);
  const providers = [...new Set((scan.gridPoints || []).map((point) => point.provider?.trim()).filter((provider): provider is string => Boolean(provider)))];
  const lastProvider = providers.length === 0 ? null : providers.length === 1 ? providers[0] : 'MIXED';

  // Calculate Overall Standing across the entire market
  let overallRank: number | null = null;
  let totalCompetitors: number | null = null;
  try {
    const locDoc = await Location.findById(scan.locationId).select('name address placeId mapsCid primaryCategory categories').lean();
    if (locDoc) {
      const compService = new CompetitorService();
      const primaryCategoryStr = typeof locDoc.primaryCategory === 'string'
        ? locDoc.primaryCategory
        : (locDoc.primaryCategory as any)?.displayName || undefined;
      const targetLocationObj = {
        name: locDoc.name,
        address: locDoc.address,
        placeId: locDoc.placeId || undefined,
        cid: locDoc.mapsCid || (locDoc as any).cid || undefined,
        primaryCategory: primaryCategoryStr,
        categories: locDoc.categories,
      };
      const leaderboard = compService.calculateScanLeaderboard(scan.gridPoints || [], targetLocationObj, scan.completedAt);
      overallRank = leaderboard.targetStanding ?? null;
      totalCompetitors = leaderboard.totalMarketCount ?? null;
    }
  } catch {}

  // Find existing tracked keyword document to compute previousRank and delta
  const existing = await TrackedKeyword.findOne({
    locationId: scan.locationId,
    normalizedKeyword: normalized,
  });

  if (!existing) {
    return; // Keyword is not in tracked list
  }

  const previousRank = existing.currentRank ?? null;
  const previousVisibility = typeof existing.visibilityScore === 'number' ? existing.visibilityScore : 0;
  const visibilityDelta = newVisibility - previousVisibility;

  const sparklinePoint = {
    date: now,
    rank: newRank,
    visibility: newVisibility,
    scanId: scanIdStr,
  };

  // Atomic update with 30-point ring buffer slice
  await TrackedKeyword.findOneAndUpdate(
    { _id: existing._id },
    {
      $set: {
        previousRank,
        currentRank: newRank,
        overallRank,
        totalCompetitors,
        rankState,
        visibilityScore: newVisibility,
        visibilityDelta,
        lastScannedAt: now,
        lastSuccessfulScanAt: now,
        lastProvider,
        lastScanId: scanIdStr,
        scanStatus: 'SCANNED',
        lastScanError: null,
      },
      $push: {
        sparkline: {
          $each: [sparklinePoint],
          $slice: -30,
        },
      },
    }
  );

  invalidateLocationChatCache(scan.locationId.toString()).catch(() => {});

  // Trigger Rank Drop Notification & Email Alert if ranking dropped
  if (previousRank !== null) {
    let dropCount = 0;
    if (newRank !== null && newRank > previousRank) {
      dropCount = newRank - previousRank;
    } else if (newRank === null && previousRank <= 20) {
      // Dropped completely out of local pack / top 20
      dropCount = 21 - previousRank;
    }

    if (dropCount > 0) {
      try {
        const location = await Location.findById(scan.locationId).select('name workspaceId city');
        const wsId = scan.workspaceId?.toString() || location?.workspaceId?.toString();

        if (wsId) {
          await notificationService.createNotification({
            workspaceId: wsId,
            type: 'RANK_DROP',
            severity: dropCount >= 5 ? 'CRITICAL' : 'WARNING',
            title: `📉 Local Rank Drop: "${existing.keyword}" fell ${dropCount} spot${dropCount > 1 ? 's' : ''}`,
            message: `Position shifted from #${previousRank} to #${newRank ?? 'Unranked (>20)'} for ${location?.name || 'your business'}.`,
            link: '/rank-tracking',
            metadata: {
              businessName: location?.name || 'Your Business',
              keyword: existing.keyword,
              previousRank,
              currentRank: newRank ?? 21,
              dropCount,
              searchCity: location?.city,
            },
          });
        }
      } catch (alertErr: any) {
        console.warn('[onScanCompleted] Failed to fire rank drop alert:', alertErr?.message);
      }
    }
  }
}

/**
 * Hook fired upon Scan failure to update scanStatus and error on TrackedKeyword
 */
export async function onScanFailed(
  scan: { locationId?: any; keyword?: string },
  error?: string
): Promise<void> {
  if (!scan?.locationId || !scan?.keyword) return;
  const normalized = scan.keyword.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  await TrackedKeyword.findOneAndUpdate(
    { locationId: scan.locationId, normalizedKeyword: normalized },
    {
      $set: {
        scanStatus: 'FAILED',
        lastScanError: error || 'Scan failed',
      },
    }
  );
}

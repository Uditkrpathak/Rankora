import mongoose from 'mongoose';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { Location } from '../models/Location';
import { TrackedKeyword } from '../models/TrackedKeyword';
import { TrialClaim } from '../models/TrialClaim';

export interface TrialFreezeResult {
  expiredUsersCount: number;
  frozenWorkspacesCount: number;
  frozenKeywordsCount: number;
  frozenClaimsCount: number;
}

/**
 * Daily Background Job:
 * Identifies expired trials (trialEndsAt < now) and freezes active keyword scraping
 * while preserving all historical SERP snapshots and ranking charts as read-only.
 * Completely idempotent: running repeatedly does not alter already-frozen records.
 */
export async function processExpiredTrials(now: Date = new Date()): Promise<TrialFreezeResult> {
  // 1. Find users whose trial has expired
  const expiredUsers = await User.find({
    trialEndsAt: { $lt: now, $exists: true },
    hasClaimedTrial: true,
  }).select('_id trialEndsAt');

  const expiredUserIds = expiredUsers.map((u) => u._id);

  // 2. Find associated trial workspaces that haven't been frozen/converted yet
  const expiredWorkspaces = await Workspace.find({
    ownerId: { $in: expiredUserIds },
    'plan.status': { $in: ['trialing', 'active'] },
    'plan.key': 'free_trial',
  });

  const workspaceIds = expiredWorkspaces.map((w) => w._id);

  let frozenKeywordsCount = 0;

  if (workspaceIds.length > 0) {
    // 3. Find locations for these workspaces
    const locations = await Location.find({ workspaceId: { $in: workspaceIds } }).select('_id');
    const locationIds = locations.map((l) => l._id);

    if (locationIds.length > 0) {
      // 4. Freeze active keywords: set status = 'paused', freeze tracking, preserve historical data
      const kwResult = await TrackedKeyword.updateMany(
        {
          locationId: { $in: locationIds },
          status: 'active',
        },
        {
          $set: {
            status: 'paused',
          },
        }
      );
      frozenKeywordsCount = kwResult.modifiedCount || 0;
    }

    // 5. Update Workspace status to expired/free
    await Workspace.updateMany(
      { _id: { $in: workspaceIds } },
      {
        $set: {
          'plan.key': 'free',
          'plan.status': 'canceled',
          'limits.scanCredits': 0,
        },
      }
    );
  }

  // 6. Mark TrialClaims as EXPIRED
  const claimResult = await TrialClaim.updateMany(
    {
      userId: { $in: expiredUserIds },
      trialExpiresAt: { $lt: now },
      status: 'ACTIVE',
    },
    {
      $set: { status: 'EXPIRED' },
    }
  );

  return {
    expiredUsersCount: expiredUsers.length,
    frozenWorkspacesCount: expiredWorkspaces.length,
    frozenKeywordsCount,
    frozenClaimsCount: claimResult.modifiedCount || 0,
  };
}

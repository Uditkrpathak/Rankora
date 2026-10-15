import mongoose from 'mongoose';
import { User, UserDocument } from '../../models/User';
import { Workspace } from '../../models/Workspace';
import { TrialClaim } from '../../models/TrialClaim';
import { SCRAPER_CONFIG } from '../../config/scraper-config';

export interface TrialActivationParams {
  userId: string;
  workspaceId: string;
  placeId: string;
  businessName?: string;
  ipAddress?: string;
}

export interface TrialActivationResult {
  success: boolean;
  trialExpiresAt?: Date;
  placeId?: string;
  error?: string;
  code?: 'NOT_VERIFIED' | 'DUPLICATE_PLACE_ID' | 'USER_ALREADY_TRIALED' | 'INVALID_PARAMS';
}

export class TrialManagerService {
  /**
   * Activates a 14-day trial for a user and workspace.
   * Enforces:
   * 1. Verified email or phone requirement.
   * 2. Exactly ONE trial per Google Place ID (unique constraint).
   * 3. Allocates 5 keywords and 1 atomic 3x3 (9-pin) grid scan credit.
   */
  public async activateTrial(params: TrialActivationParams): Promise<TrialActivationResult> {
    const { userId, workspaceId, placeId, businessName, ipAddress } = params;

    if (!userId || !workspaceId || !placeId) {
      return { success: false, error: 'Missing required trial activation parameters', code: 'INVALID_PARAMS' };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, error: 'User not found', code: 'INVALID_PARAMS' };
    }

    // Must have verified email or phone
    const hasVerifiedContact = Boolean(user.emailVerifiedAt || user.phoneVerifiedAt);
    if (!hasVerifiedContact) {
      return {
        success: false,
        error: 'Trial requires a verified email address or verified phone number.',
        code: 'NOT_VERIFIED',
      };
    }

    const trialDays = SCRAPER_CONFIG.trialDurationDays || 14;
    const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 3600 * 1000);

    // Atomically create TrialClaim with unique placeId constraint
    try {
      await TrialClaim.create({
        placeId,
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        businessName,
        trialExpiresAt,
        ipAddress,
        gridQuotaGranted: SCRAPER_CONFIG.trialGridScanLimit || 1,
        gridQuotaUsed: 0,
        status: 'ACTIVE',
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        return {
          success: false,
          error: `A free trial has already been claimed for this Google Business Profile (Place ID: ${placeId}).`,
          code: 'DUPLICATE_PLACE_ID',
        };
      }
      throw err;
    }

    // Update user record
    await User.findByIdAndUpdate(userId, {
      $set: {
        trialEndsAt: trialExpiresAt,
        hasClaimedTrial: true,
      },
    });

    // Update workspace limits (5 keywords, 1 grid scan of 9 pins)
    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: {
        'plan.key': 'free_trial',
        'plan.status': 'trialing',
        trialEndsAt: trialExpiresAt,
        'limits.scanCredits': SCRAPER_CONFIG.trialGridPins || 9, // 1 scan = 9 credits
        'limits.optimizationSlots': SCRAPER_CONFIG.trialKeywordLimit || 5,
        'limits.locations': 1,
      },
    });

    return {
      success: true,
      trialExpiresAt,
      placeId,
    };
  }

  /**
   * Atomically consumes the single trial grid scan quota.
   * Returns true if quota was successfully reserved, false if already used.
   */
  public async consumeTrialGridScan(placeId: string): Promise<boolean> {
    const claim = await TrialClaim.findOneAndUpdate(
      {
        placeId,
        status: 'ACTIVE',
        gridQuotaUsed: { $lt: 1 },
      },
      {
        $inc: { gridQuotaUsed: 1 },
      },
      { new: true }
    );

    return Boolean(claim);
  }

  /**
   * Returns whether a user / place ID has an active, unexpired trial.
   */
  public async isTrialActive(userId: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user || !user.trialEndsAt) return false;
    return new Date() < new Date(user.trialEndsAt);
  }
}

export const trialManagerService = new TrialManagerService();

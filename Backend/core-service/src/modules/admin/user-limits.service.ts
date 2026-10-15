import { getEffectiveLimits, normalizePlanName, PLAN_DEFAULTS, EXPIRED_PLAN_BEHAVIOR } from '@localo/shared';
import { User, UserDocument } from '../../models/User';
import { Location } from '../../models/Location';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';

export class UserLimitsService {
  /**
   * Performs lazy rollover of monthly counters if >= 30 days have passed since usageResetAt.
   * Also performs lazy downgrade if planExpiresAt has passed per EXPIRED_PLAN_BEHAVIOR.
   * Synchronizes locationsCount with actual locations in database.
   */
  public async checkAndResetMonthlyUsage(user: UserDocument): Promise<UserDocument> {
    let modified = false;
    const now = new Date();

    // Lazy plan expiration check
    if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() < now.getTime()) {
      if (EXPIRED_PLAN_BEHAVIOR === 'FALLBACK_TO_TRIAL' && user.planName !== 'Trial') {
        user.planName = 'Trial';
        user.limitOverrides = {
          keywordScanLimit: null,
          scanCreditsPerMonth: null,
          locationLimit: null,
          chatbotQuotaPerMonth: null,
          teamSeatLimit: null
        };
        user.permissions = { ...PLAN_DEFAULTS['Trial'].permissions };
        modified = true;
      }
    }

    if (!user.usage) {
      user.usage = {
        keywordsScannedThisMonth: 0,
        scanCreditsUsed: 0,
        chatbotUsed: 0,
        locationsCount: 0,
        usageResetAt: now
      };
      modified = true;
    }

    const resetAt = user.usage.usageResetAt ? new Date(user.usage.usageResetAt) : new Date(0);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    if (now.getTime() - resetAt.getTime() >= thirtyDaysMs) {
      user.usage.keywordsScannedThisMonth = 0;
      user.usage.scanCreditsUsed = 0;
      user.usage.chatbotUsed = 0;
      user.usage.usageResetAt = now;
      modified = true;
    }

    if (modified) {
      await user.save();
    }

    return user;
  }

  /**
   * Retrieves effective limits and permissions along with usage counters.
   */
  public async getUserEffectiveLimits(user: UserDocument) {
    await this.checkAndResetMonthlyUsage(user);

    const { limits, permissions, plan, isExpired } = getEffectiveLimits({
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      limitOverrides: user.limitOverrides,
      permissions: user.permissions
    });

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        period: plan.period,
        startedAt: user.planStartedAt,
        expiresAt: user.planExpiresAt,
        assignedByUserId: user.assignedByUserId,
        isExpired
      },
      limits,
      permissions,
      usage: user.usage,
      limitOverrides: user.limitOverrides || {}
    };
  }

  /**
   * Validates and atomically increments keyword scan and credit usage.
   * Handles -1 (unlimited) without accidental lockout.
   * Uses conditional findOneAndUpdate to prevent race conditions.
   */
  public async assertAndIncrementKeywordScan(userId: string, count: number = 1, creditCost: number = 1): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    await this.checkAndResetMonthlyUsage(user);
    const { limits, permissions } = getEffectiveLimits({
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      limitOverrides: user.limitOverrides,
      permissions: user.permissions
    });

    if (!permissions.canScan) {
      const err: any = new Error('Limit reached: set by your administrator (Keyword scanning is disabled for your plan)');
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }

    const isKeywordUnlimited = limits.keywordScanLimit === -1;
    const isCreditsUnlimited = limits.scanCreditsPerMonth === -1;

    // Build atomic conditional filter
    const condition: any = { _id: userId };
    if (!isKeywordUnlimited) {
      condition['usage.keywordsScannedThisMonth'] = { $lte: Math.max(0, limits.keywordScanLimit - count) };
    }
    if (!isCreditsUnlimited) {
      condition['usage.scanCreditsUsed'] = { $lte: Math.max(0, limits.scanCreditsPerMonth - creditCost) };
    }

    const updated = await User.findOneAndUpdate(
      condition,
      {
        $inc: {
          'usage.keywordsScannedThisMonth': count,
          'usage.scanCreditsUsed': creditCost
        }
      },
      { new: true }
    );

    if (!updated) {
      const current = await User.findById(userId);
      const kUsed = current?.usage?.keywordsScannedThisMonth || 0;
      const cUsed = current?.usage?.scanCreditsUsed || 0;

      let detail = `${kUsed}/${limits.keywordScanLimit} keywords scanned this month`;
      if (!isCreditsUnlimited && cUsed + creditCost > limits.scanCreditsPerMonth) {
        detail = `${cUsed}/${limits.scanCreditsPerMonth} monthly scan credits used`;
      }

      const err: any = new Error(`Limit reached: set by your administrator (${detail})`);
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }
  }

  /**
   * Refunds keyword scans and scan credits if execution fails.
   */
  public async refundKeywordScan(userId: string, count: number = 1, creditCost: number = 1): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: {
        'usage.keywordsScannedThisMonth': -count,
        'usage.scanCreditsUsed': -creditCost
      }
    });

    // Safeguard counters so they never go negative
    await User.updateOne(
      { _id: userId, 'usage.keywordsScannedThisMonth': { $lt: 0 } },
      { $set: { 'usage.keywordsScannedThisMonth': 0 } }
    );
    await User.updateOne(
      { _id: userId, 'usage.scanCreditsUsed': { $lt: 0 } },
      { $set: { 'usage.scanCreditsUsed': 0 } }
    );
  }

  /**
   * Validates chatbot usage and atomically increments counter.
   * Handles -1 (unlimited) without lockout.
   */
  public async assertAndIncrementChatbot(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    await this.checkAndResetMonthlyUsage(user);
    const { limits, permissions } = getEffectiveLimits({
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      limitOverrides: user.limitOverrides,
      permissions: user.permissions
    });

    if (!permissions.canUseChatbot) {
      const err: any = new Error('Limit reached: set by your administrator (AI Assistant is disabled for your plan)');
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }

    const isChatbotUnlimited = limits.chatbotQuotaPerMonth === -1;
    const condition: any = { _id: userId };
    if (!isChatbotUnlimited) {
      condition['usage.chatbotUsed'] = { $lt: limits.chatbotQuotaPerMonth };
    }

    const updated = await User.findOneAndUpdate(
      condition,
      {
        $inc: { 'usage.chatbotUsed': 1 }
      },
      { new: true }
    );

    if (!updated) {
      const current = await User.findById(userId);
      const used = current?.usage?.chatbotUsed || 0;
      const err: any = new Error(`Limit reached: set by your administrator (${used}/${limits.chatbotQuotaPerMonth} AI Assistant queries used this month)`);
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }
  }

  /**
   * Validates location creation limit and atomically increments locationsCount.
   * Handles -1 (unlimited) without lockout.
   */
  public async assertCanCreateLocation(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    await this.checkAndResetMonthlyUsage(user);
    const { limits } = getEffectiveLimits({
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      limitOverrides: user.limitOverrides,
      permissions: user.permissions
    });

    if (limits.locationLimit === -1) {
      await User.findByIdAndUpdate(userId, {
        $inc: { 'usage.locationsCount': 1 }
      });
      return;
    }

    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        'usage.locationsCount': { $lt: limits.locationLimit }
      },
      {
        $inc: { 'usage.locationsCount': 1 }
      },
      { new: true }
    );

    if (!updated) {
      const current = await User.findById(userId);
      const currentLocs = current?.usage?.locationsCount || 0;
      const err: any = new Error(`Limit reached: set by your administrator (Maximum of ${limits.locationLimit} locations reached; currently using ${currentLocs})`);
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }
  }

  /**
   * Decrements location count when a location is deleted.
   */
  public async decrementLocationsCount(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.locationsCount': -1 }
    });
    await User.updateOne(
      { _id: userId, 'usage.locationsCount': { $lt: 0 } },
      { $set: { 'usage.locationsCount': 0 } }
    );
  }

  /**
   * Validates workspace team seat limit on invites and membership acceptance.
   * Handles -1 (unlimited) without lockout.
   */
  public async assertCanInviteOrJoinTeam(workspaceId: string, inviterUserId?: string): Promise<void> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

    const ownerId = workspace.ownerId?.toString() || inviterUserId;
    if (!ownerId) return;

    const owner = await User.findById(ownerId);
    if (!owner) return;

    const { limits, permissions } = getEffectiveLimits({
      planName: owner.planName,
      planExpiresAt: owner.planExpiresAt,
      limitOverrides: owner.limitOverrides,
      permissions: owner.permissions
    });

    if (!permissions.canInviteTeam) {
      const err: any = new Error('Limit reached: set by your administrator (Team member invitations disabled)');
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }

    if (limits.teamSeatLimit === -1) {
      return; // Unlimited seats
    }

    const currentMembers = await WorkspaceMember.countDocuments({ workspaceId });
    if (currentMembers >= limits.teamSeatLimit) {
      const err: any = new Error(`Limit reached: set by your administrator (Maximum of ${limits.teamSeatLimit} team seats reached for this workspace)`);
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }
  }

  /**
   * Asserts specific permission flag among all 7 platform flags.
   */
  public async assertPermission(
    userId: string,
    flag: 'canScan' | 'canUseChatbot' | 'canUseGeoGrid' | 'canUseCompetitorMatrix' | 'canExportPdf' | 'canInviteTeam' | 'canUseApi'
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const { permissions } = getEffectiveLimits({
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      limitOverrides: user.limitOverrides,
      permissions: user.permissions
    });

    if (!permissions[flag]) {
      const friendlyNameMap: Record<string, string> = {
        canScan: 'Rank and Keyword Scanning',
        canUseChatbot: 'AI Assistant and Copilot',
        canUseGeoGrid: 'Geo-Grid Rank Tracking',
        canUseCompetitorMatrix: 'Competitor Benchmarking Matrix',
        canExportPdf: 'Export Reports and PDF Downloads',
        canInviteTeam: 'Team Member Management',
        canUseApi: 'API Integrations and MCP Access'
      };
      const featureName = friendlyNameMap[flag] || flag;
      const err: any = new Error(`Limit reached: set by your administrator (${featureName} is disabled for your account)`);
      err.statusCode = 403;
      err.code = 'LIMIT_EXCEEDED';
      throw err;
    }
  }
}

export const userLimitsService = new UserLimitsService();

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { User, UserDocument } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { getEffectiveLimits } from '@localo/shared';
import { PlatformPlanName } from '@localo/types';
import { userLimitsService } from './user-limits.service';
import { tokenService } from '../auth/token.service';

export class AdminController {
  /**
   * Helper: checks if actor is permitted to manage target user.
   * ADMIN cannot manage themselves or other administrators.
   * Last remaining SUPER_ADMIN cannot be suspended, demoted, or modified.
   */
  private async checkManagePermission(actor: UserDocument, target: UserDocument): Promise<void> {
    const actorId = actor._id.toString();
    const targetId = target._id.toString();

    // Guard 1: Admin cannot modify themselves via admin management APIs
    if (actorId === targetId) {
      const err: any = new Error('You cannot modify your own administrator account via admin APIs.');
      err.statusCode = 400;
      err.code = 'CANNOT_MANAGE_SELF';
      throw err;
    }

    const actorRole = actor.platformRole || 'USER';
    const targetRole = target.platformRole || 'USER';

    // Guard 2: ADMIN can only manage USERs
    if (actorRole !== 'SUPER_ADMIN' && (targetRole === 'ADMIN' || targetRole === 'SUPER_ADMIN')) {
      const err: any = new Error('You do not have permission to manage administrator accounts.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_ADMIN_ACCESS';
      throw err;
    }

    // Guard 3: Last remaining SUPER_ADMIN protection
    if (targetRole === 'SUPER_ADMIN') {
      const activeSuperAdminCount = await User.countDocuments({ platformRole: 'SUPER_ADMIN', status: 'ACTIVE' });
      if (activeSuperAdminCount <= 1) {
        const err: any = new Error('The last remaining SUPER_ADMIN cannot be suspended, deleted, or demoted.');
        err.statusCode = 400;
        err.code = 'LAST_SUPERADMIN_PROTECTED';
        throw err;
      }
    }
  }

  /**
   * GET /api/admin/users?search=&plan=&status=&page=&limit=
   */
  public async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string || '').trim();
    const plan = req.query.plan as string;
    const status = req.query.status as string;

    const filter: any = {};

    // Standard ADMIN only sees USERs; SUPER_ADMIN sees all or can filter
    const actorRole = req.user?.platformRole || 'USER';
    if (actorRole !== 'SUPER_ADMIN') {
      filter.platformRole = { $in: ['USER', null, undefined] };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (plan && plan !== 'ALL') {
      filter.planName = plan;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const items = users.map((u: any) => {
      const { limits, permissions, plan: planDef } = getEffectiveLimits({
        planName: u.planName,
        limitOverrides: u.limitOverrides,
        permissions: u.permissions
      });

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        platformRole: u.platformRole || 'USER',
        status: u.status,
        planName: u.planName || 'Trial',
        planExpiresAt: u.planExpiresAt,
        limits,
        permissions,
        usage: u.usage || {
          keywordsScannedThisMonth: 0,
          scanCreditsUsed: 0,
          chatbotUsed: 0,
          locationsCount: 0
        },
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  }

  /**
   * GET /api/admin/users/:id
   */
  public async getUserDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (req.user) {
      await this.checkManagePermission(req.user, user);
    }

    await userLimitsService.checkAndResetMonthlyUsage(user);

    const { limits, permissions, plan } = getEffectiveLimits({
      planName: user.planName,
      limitOverrides: user.limitOverrides,
      permissions: user.permissions
    });

    const auditHistory = await AuditLog.find({ targetUserId: user._id.toString() })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          platformRole: user.platformRole || 'USER',
          status: user.status,
          planName: user.planName || 'Trial',
          planStartedAt: user.planStartedAt,
          planExpiresAt: user.planExpiresAt,
          assignedByUserId: user.assignedByUserId,
          limitOverrides: user.limitOverrides || {},
          permissions: user.permissions || {},
          usage: user.usage,
          effectiveLimits: limits,
          effectivePermissions: permissions,
          planDetails: plan,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        },
        auditHistory
      }
    });
  }

  /**
   * PATCH /api/admin/users/:id/limits
   */
  public async updateLimits(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    await this.checkManagePermission(req.user, user);

    const before = user.limitOverrides ? JSON.parse(JSON.stringify(user.limitOverrides)) : {};
    const { keywordScanLimit, scanCreditsPerMonth, locationLimit, chatbotQuotaPerMonth, teamSeatLimit } = req.body;

    const validateLimit = (val: any, fieldName: string) => {
      if (val === undefined || val === null) return;
      if (typeof val !== 'number' || !Number.isInteger(val) || (val < 0 && val !== -1)) {
        throw new Error(`${fieldName} must be a non-negative integer or -1 for unlimited.`);
      }
    };

    try {
      validateLimit(keywordScanLimit, 'keywordScanLimit');
      validateLimit(scanCreditsPerMonth, 'scanCreditsPerMonth');
      validateLimit(locationLimit, 'locationLimit');
      validateLimit(chatbotQuotaPerMonth, 'chatbotQuotaPerMonth');
      validateLimit(teamSeatLimit, 'teamSeatLimit');
    } catch (valErr: any) {
      res.status(400).json({ success: false, error: { code: 'INVALID_LIMIT_VALUE', message: valErr.message } });
      return;
    }

    user.limitOverrides = {
      keywordScanLimit: keywordScanLimit !== undefined ? keywordScanLimit : user.limitOverrides?.keywordScanLimit,
      scanCreditsPerMonth: scanCreditsPerMonth !== undefined ? scanCreditsPerMonth : user.limitOverrides?.scanCreditsPerMonth,
      locationLimit: locationLimit !== undefined ? locationLimit : user.limitOverrides?.locationLimit,
      chatbotQuotaPerMonth: chatbotQuotaPerMonth !== undefined ? chatbotQuotaPerMonth : user.limitOverrides?.chatbotQuotaPerMonth,
      teamSeatLimit: teamSeatLimit !== undefined ? teamSeatLimit : user.limitOverrides?.teamSeatLimit
    };

    await user.save();

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: req.user.platformRole || 'ADMIN',
      targetUserId: user._id.toString(),
      action: 'ADMIN_UPDATE_LIMITS',
      before,
      after: user.limitOverrides,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'User limits updated successfully.',
        limitOverrides: user.limitOverrides
      }
    });
  }

  /**
   * PATCH /api/admin/users/:id/permissions
   */
  public async updatePermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    await this.checkManagePermission(req.user, user);

    const before = user.permissions ? JSON.parse(JSON.stringify(user.permissions)) : {};
    const { canScan, canUseChatbot, canUseGeoGrid, canUseCompetitorMatrix, canExportPdf, canInviteTeam, canUseApi } = req.body;

    user.permissions = {
      canScan: canScan !== undefined ? Boolean(canScan) : (user.permissions?.canScan ?? true),
      canUseChatbot: canUseChatbot !== undefined ? Boolean(canUseChatbot) : (user.permissions?.canUseChatbot ?? true),
      canUseGeoGrid: canUseGeoGrid !== undefined ? Boolean(canUseGeoGrid) : (user.permissions?.canUseGeoGrid ?? true),
      canUseCompetitorMatrix: canUseCompetitorMatrix !== undefined ? Boolean(canUseCompetitorMatrix) : (user.permissions?.canUseCompetitorMatrix ?? true),
      canExportPdf: canExportPdf !== undefined ? Boolean(canExportPdf) : (user.permissions?.canExportPdf ?? true),
      canInviteTeam: canInviteTeam !== undefined ? Boolean(canInviteTeam) : (user.permissions?.canInviteTeam ?? true),
      canUseApi: canUseApi !== undefined ? Boolean(canUseApi) : (user.permissions?.canUseApi ?? false)
    };

    await user.save();

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: req.user.platformRole || 'ADMIN',
      targetUserId: user._id.toString(),
      action: 'ADMIN_UPDATE_PERMISSIONS',
      before,
      after: user.permissions,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'User permissions updated successfully.',
        permissions: user.permissions
      }
    });
  }

  /**
   * PATCH /api/admin/users/:id/plan
   */
  public async updatePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    await this.checkManagePermission(req.user, user);

    const before = {
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      assignedByUserId: user.assignedByUserId
    };

    const { planName, planExpiresAt } = req.body;
    const VALID_PLANS: PlatformPlanName[] = ['Trial', 'Starter', 'Pro Growth', 'Agency Scale'];
    if (planName && !VALID_PLANS.includes(planName as PlatformPlanName)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PLAN_NAME', message: `Invalid plan name. Must be one of: ${VALID_PLANS.join(', ')}` }
      });
      return;
    }

    if (planName) {
      user.planName = planName as PlatformPlanName;
      user.planStartedAt = new Date();
    }
    user.planExpiresAt = planExpiresAt !== undefined ? (planExpiresAt ? new Date(planExpiresAt) : null) : user.planExpiresAt;
    user.assignedByUserId = req.user._id.toString();

    await user.save();

    const after = {
      planName: user.planName,
      planExpiresAt: user.planExpiresAt,
      assignedByUserId: user.assignedByUserId
    };

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: req.user.platformRole || 'ADMIN',
      targetUserId: user._id.toString(),
      action: 'ADMIN_UPDATE_PLAN',
      before,
      after,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Plan updated successfully.',
        planName: user.planName,
        planExpiresAt: user.planExpiresAt,
        assignedByUserId: user.assignedByUserId
      }
    });
  }

  /**
   * PATCH /api/admin/users/:id/status
   */
  public async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    await this.checkManagePermission(req.user, user);

    const before = { status: user.status };
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Status must be ACTIVE or SUSPENDED.' } });
      return;
    }

    user.status = status;
    await user.save();

    // Revoke all active sessions and refresh tokens immediately if suspended
    if (status === 'SUSPENDED') {
      await tokenService.incrementSessionVersion(user._id.toString(), 'ADMIN_SUSPENDED');
    }

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: req.user.platformRole || 'ADMIN',
      targetUserId: user._id.toString(),
      action: `ADMIN_SET_STATUS_${status}`,
      before,
      after: { status: user.status },
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: `User status changed to ${status}.`,
        status: user.status
      }
    });
  }

  /**
   * POST /api/admin/users/:id/reset-usage
   */
  public async resetUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    await this.checkManagePermission(req.user, user);

    const before = user.usage ? JSON.parse(JSON.stringify(user.usage)) : {};

    user.usage = {
      keywordsScannedThisMonth: 0,
      scanCreditsUsed: 0,
      chatbotUsed: 0,
      locationsCount: user.usage?.locationsCount || 0,
      usageResetAt: new Date()
    };

    await user.save();

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: req.user.platformRole || 'ADMIN',
      targetUserId: user._id.toString(),
      action: 'ADMIN_RESET_USAGE',
      before,
      after: user.usage,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Usage counters reset to 0.',
        usage: user.usage
      }
    });
  }

  /**
   * POST /api/admin/users/:id/verify-email
   * Manually verifies a user's email address, activates account, and starts workspace trial clock.
   */
  public async manuallyVerifyEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    await this.checkManagePermission(req.user, user);

    const before = {
      isEmailVerified: user.isEmailVerified,
      status: user.status
    };

    user.isEmailVerified = true;
    user.status = 'ACTIVE';
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    // Start 14-day trial clock for user's owned workspaces if not already set
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const { WorkspaceMember } = await import('../../models/WorkspaceMember');
    const { Workspace } = await import('../../models/Workspace');
    const ownedMemberships = await WorkspaceMember.find({ userId: user._id, role: 'owner' }).select('workspaceId');
    const workspaceIds = ownedMemberships.map((m: any) => m.workspaceId);

    if (workspaceIds.length > 0) {
      await Workspace.updateMany(
        { _id: { $in: workspaceIds }, trialEndsAt: { $exists: false } },
        { $set: { trialEndsAt, 'plan.periodEnd': trialEndsAt } }
      );
    }

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: req.user.platformRole || 'ADMIN',
      targetUserId: user._id.toString(),
      action: 'ADMIN_MANUALLY_VERIFY_EMAIL',
      before,
      after: { isEmailVerified: true, status: 'ACTIVE' },
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: `Email for ${user.email} has been manually verified and account activated.`,
        isEmailVerified: true,
        status: user.status
      }
    });
  }

  /**
   * GET /api/admin/stats
   */
  public async getStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      trialUsers,
      starterUsers,
      proUsers,
      agencyUsers,
      usageAggregation
    ] = await Promise.all([
      User.countDocuments({ platformRole: { $ne: 'SUPER_ADMIN' } }),
      User.countDocuments({ status: 'ACTIVE', platformRole: { $ne: 'SUPER_ADMIN' } }),
      User.countDocuments({ status: 'SUSPENDED' }),
      User.countDocuments({ planName: 'Trial', platformRole: 'USER' }),
      User.countDocuments({ planName: 'Starter' }),
      User.countDocuments({ planName: 'Pro Growth' }),
      User.countDocuments({ planName: 'Agency Scale' }),
      User.aggregate([
        {
          $group: {
            _id: null,
            totalKeywordsScanned: { $sum: '$usage.keywordsScannedThisMonth' },
            totalScanCredits: { $sum: '$usage.scanCreditsUsed' },
            totalChatbotUsed: { $sum: '$usage.chatbotUsed' }
          }
        }
      ])
    ]);

    const agg = usageAggregation[0] || { totalKeywordsScanned: 0, totalScanCredits: 0, totalChatbotUsed: 0 };

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        usersPerPlan: {
          'Trial': trialUsers,
          'Starter': starterUsers,
          'Pro Growth': proUsers,
          'Agency Scale': agencyUsers
        },
        keywordsScannedThisMonth: agg.totalKeywordsScanned,
        scanCreditsUsedThisMonth: agg.totalScanCredits,
        chatbotUsedThisMonth: agg.totalChatbotUsed
      }
    });
  }
}

export const adminController = new AdminController();

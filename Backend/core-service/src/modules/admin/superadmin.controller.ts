import { Response } from 'express';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { ARGON2_CONFIG, PLAN_DEFAULTS } from '@localo/shared';
import { PlatformPlanName } from '@localo/types';
import { tokenService } from '../auth/token.service';

export class SuperAdminController {
  /**
   * POST /api/superadmin/admins
   * Create an ADMIN user with a temporary password and mustChangePassword = true.
   */
  public async createAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { name, email, tempPassword, permissions } = req.body;

    if (!name || !email) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and email are required.' } });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.' } });
      return;
    }

    const generatedPassword = tempPassword?.trim() || `TempAdmin!${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = await argon2.hash(generatedPassword, {
      memoryCost: ARGON2_CONFIG.memoryCost,
      timeCost: ARGON2_CONFIG.timeCost,
      parallelism: ARGON2_CONFIG.parallelism,
      type: argon2.argon2id
    });

    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      platformRole: 'ADMIN',
      mustChangePassword: true,
      status: 'ACTIVE',
      isEmailVerified: true,
      createdByUserId: req.user._id.toString(),
      planName: 'Agency Scale', // Admins default to top tier platform features
      permissions: permissions || {
        canScan: true,
        canUseChatbot: true,
        canUseGeoGrid: true,
        canUseCompetitorMatrix: true,
        canExportPdf: true,
        canInviteTeam: true,
        canUseApi: true
      }
    });

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: 'SUPER_ADMIN',
      targetUserId: newAdmin._id.toString(),
      action: 'SUPER_ADMIN_CREATE_ADMIN',
      after: { email: newAdmin.email, name: newAdmin.name, platformRole: newAdmin.platformRole },
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Admin account created successfully.',
        admin: {
          id: newAdmin._id,
          name: newAdmin.name,
          email: newAdmin.email,
          platformRole: newAdmin.platformRole,
          mustChangePassword: newAdmin.mustChangePassword,
          status: newAdmin.status,
          createdAt: newAdmin.createdAt
        },
        temporaryPassword: generatedPassword
      }
    });
  }

  /**
   * GET /api/superadmin/admins
   * List all ADMINs with last activity and count of users modified.
   */
  public async listAdmins(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const admins = await User.find({ platformRole: 'ADMIN' }).sort({ createdAt: -1 }).lean();

    const enrichedAdmins = await Promise.all(
      admins.map(async (admin: any) => {
        const [modifiedCount, lastLog] = await Promise.all([
          AuditLog.countDocuments({ actorUserId: admin._id.toString() }),
          AuditLog.findOne({ actorUserId: admin._id.toString() }).sort({ createdAt: -1 }).lean()
        ]);

        return {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          platformRole: admin.platformRole,
          status: admin.status,
          mustChangePassword: admin.mustChangePassword,
          lastLoginAt: admin.lastLoginAt,
          createdAt: admin.createdAt,
          usersChangedCount: modifiedCount,
          lastActivityAt: lastLog?.createdAt || admin.lastLoginAt || admin.createdAt
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        items: enrichedAdmins
      }
    });
  }

  /**
   * PATCH /api/superadmin/admins/:id
   * Edit/suspend/activate an ADMIN.
   */
  public async updateAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      res.status(400).json({ success: false, error: { code: 'CANNOT_MANAGE_SELF', message: 'You cannot edit your own administrator account via this endpoint.' } });
      return;
    }

    const admin = await User.findOne({ _id: id, platformRole: 'ADMIN' });
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin not found.' } });
      return;
    }

    const before = {
      name: admin.name,
      status: admin.status,
      permissions: admin.permissions
    };

    const { name, status, permissions } = req.body;
    if (name) admin.name = name.trim();
    if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) {
      admin.status = status;
    }
    if (permissions) {
      admin.permissions = { ...admin.permissions, ...permissions };
    }

    await admin.save();

    if (status === 'SUSPENDED') {
      await tokenService.incrementSessionVersion(admin._id.toString(), 'SUPERADMIN_SUSPENDED');
    }

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: 'SUPER_ADMIN',
      targetUserId: admin._id.toString(),
      action: 'SUPER_ADMIN_UPDATE_ADMIN',
      before,
      after: { name: admin.name, status: admin.status, permissions: admin.permissions },
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Admin updated successfully.',
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          status: admin.status,
          platformRole: admin.platformRole,
          permissions: admin.permissions
        }
      }
    });
  }

  /**
   * DELETE /api/superadmin/admins/:id
   */
  public async deleteAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      res.status(400).json({ success: false, error: { code: 'CANNOT_MANAGE_SELF', message: 'You cannot delete your own account.' } });
      return;
    }

    const targetUser = await User.findById(id);
    if (targetUser?.platformRole === 'SUPER_ADMIN') {
      const activeSuperAdminCount = await User.countDocuments({ platformRole: 'SUPER_ADMIN', status: 'ACTIVE' });
      if (activeSuperAdminCount <= 1) {
        res.status(400).json({ success: false, error: { code: 'LAST_SUPERADMIN_PROTECTED', message: 'The last remaining SUPER_ADMIN cannot be deleted, suspended, or demoted.' } });
        return;
      }
    }

    const admin = await User.findOne({ _id: id, platformRole: 'ADMIN' });
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin not found.' } });
      return;
    }

    // Set status to DELETED
    admin.status = 'DELETED';
    await admin.save();

    await tokenService.incrementSessionVersion(admin._id.toString(), 'SUPERADMIN_DELETED');

    await AuditLog.create({
      actorUserId: req.user._id.toString(),
      actorRole: 'SUPER_ADMIN',
      targetUserId: admin._id.toString(),
      action: 'SUPER_ADMIN_DELETE_ADMIN',
      before: { email: admin.email, name: admin.name },
      after: { status: 'DELETED' },
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      data: { message: 'Admin account deleted successfully.' }
    });
  }

  /**
   * GET /api/superadmin/admins/:id/activity
   */
  public async getAdminActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const activities = await AuditLog.find({ actorUserId: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        activities
      }
    });
  }

  /**
   * GET /api/superadmin/overview
   * All plans, subscribers per plan, which admin assigned what.
   */
  public async getOverview(_req: AuthenticatedRequest, res: Response): Promise<void> {
    // 1. Group active users by plan
    const planCounts = await User.aggregate([
      { $match: { status: { $ne: 'DELETED' } } },
      { $group: { _id: '$planName', count: { $sum: 1 } } }
    ]);

    const countMap: Record<string, number> = {};
    for (const item of planCounts) {
      if (item._id) countMap[item._id] = item.count;
    }

    // All plan definitions with their current subscriber counts
    const plansWithCounts = Object.entries(PLAN_DEFAULTS).map(([key, def]) => ({
      key,
      id: def.id,
      name: def.name,
      price: def.price,
      period: def.period,
      limits: def.limits,
      subscriberCount: countMap[key] || 0
    }));

    // 2. Which admin assigned what plans
    const adminAssignments = await User.aggregate([
      {
        $match: {
          assignedByUserId: { $exists: true, $ne: null },
          status: { $ne: 'DELETED' }
        }
      },
      {
        $group: {
          _id: { adminId: '$assignedByUserId', planName: '$planName' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Fetch admin details for assignment mapping
    const adminIds = Array.from(new Set(adminAssignments.map(a => a._id.adminId)));
    const admins = await User.find({ _id: { $in: adminIds } }, 'name email platformRole').lean();
    const adminMap = new Map(admins.map((a: any) => [a._id.toString(), a]));

    const assignmentsByAdmin = adminAssignments.map(item => {
      const admin: any = adminMap.get(item._id.adminId);
      return {
        adminId: item._id.adminId,
        adminName: admin ? admin.name : 'System / Unknown',
        adminEmail: admin ? admin.email : '',
        planName: item._id.planName,
        assignedCount: item.count
      };
    });

    res.status(200).json({
      success: true,
      data: {
        plans: plansWithCounts,
        adminAssignments: assignmentsByAdmin
      }
    });
  }

  /**
   * GET /api/superadmin/audit-log?actor=&target=&action=&page=&limit=
   */
  public async getAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const actor = (req.query.actor as string || '').trim();
    const target = (req.query.target as string || '').trim();
    const action = (req.query.action as string || '').trim();

    const query: any = {};
    if (actor) query.actorUserId = actor;
    if (target) query.targetUserId = target;
    if (action) query.action = { $regex: action, $options: 'i' };

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
    ]);

    // Populate user emails for actors and targets if available
    const userIds = Array.from(
      new Set(
        logs
          .flatMap(l => [l.actorUserId, l.targetUserId])
          .filter(Boolean) as string[]
      )
    );
    const users = await User.find({ _id: { $in: userIds } }, 'name email platformRole').lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    const enrichedLogs = logs.map((l: any) => ({
      ...l,
      actor: userMap.get(l.actorUserId) || { name: 'Unknown', email: l.actorUserId },
      target: l.targetUserId ? (userMap.get(l.targetUserId) || { name: 'Unknown', email: l.targetUserId }) : undefined
    }));

    res.status(200).json({
      success: true,
      data: {
        items: enrichedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  }
}

export const superAdminController = new SuperAdminController();

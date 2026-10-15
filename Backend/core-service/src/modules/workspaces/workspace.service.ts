import { Workspace } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { UserRole } from '@localo/types';

export class WorkspaceService {
  public async createWorkspace(userId: string, name: string, ip?: string) {
    // Atomic trial eligibility guard (§Guard 1)
    const user = await User.findOneAndUpdate(
      { _id: userId, hasClaimedTrial: false },
      { $set: { hasClaimedTrial: true } },
      { new: true }
    );

    const isTrialEligible = !!user;
    const trialEndsAt = isTrialEligible ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined;

    const workspace = await Workspace.create({
      name: name.trim(),
      ownerId: userId,
      status: 'ACTIVE',
      trialEndsAt,
      plan: isTrialEligible
        ? {
            key: 'free_trial',
            status: 'trialing',
            periodEnd: trialEndsAt,
          }
        : {
            key: 'free',
            status: 'active',
            periodEnd: undefined,
          },
      limits: isTrialEligible
        ? {
            locations: 10,
            seats: 3,
            scanCredits: 100,
            aiCredits: 20,
          }
        : {
            locations: 1,
            seats: 1,
            scanCredits: 0,
            aiCredits: 0,
          },
      gbpConnectionStatus: 'not_started',
    });

    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId,
      role: 'owner',
    });

    await AuditLog.create({
      workspaceId: workspace._id.toString(),
      actorUserId: userId,
      action: isTrialEligible ? 'TRIAL_WORKSPACE_CREATED' : 'FREE_WORKSPACE_CREATED_TRIAL_ALREADY_CLAIMED',
      resourceType: 'Workspace',
      resourceId: workspace._id.toString(),
      ip,
      after: { name: workspace.name, isTrialEligible },
    });

    return workspace;
  }

  public async softDeleteWorkspace(workspaceId: string, actorUserId: string, ip?: string) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

    if (workspace.ownerId.toString() !== actorUserId) {
      throw new Error('ONLY_OWNER_CAN_DELETE_WORKSPACE');
    }

    workspace.status = 'PENDING_DELETION';
    workspace.deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await workspace.save();

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_DELETION_SCHEDULED',
      resourceType: 'Workspace',
      resourceId: workspaceId,
      ip,
      after: { deletionScheduledAt: workspace.deletionScheduledAt }
    });

    return workspace;
  }

  public async cancelWorkspaceDeletion(workspaceId: string, actorUserId: string, ip?: string) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

    if (workspace.ownerId.toString() !== actorUserId) {
      throw new Error('ONLY_OWNER_CAN_CANCEL_DELETION');
    }

    workspace.status = 'ACTIVE';
    workspace.deletionScheduledAt = undefined;
    await workspace.save();

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_DELETION_CANCELLED',
      resourceType: 'Workspace',
      resourceId: workspaceId,
      ip
    });

    return workspace;
  }

  public async changeMemberRole(
    workspaceId: string,
    actorUserId: string,
    targetUserId: string,
    newRole: UserRole,
    ip?: string
  ) {
    const targetMember = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });
    if (!targetMember) throw new Error('MEMBER_NOT_FOUND');

    // 🔒 Last-Owner Protection
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await WorkspaceMember.countDocuments({ workspaceId, role: 'owner' });
      if (ownerCount <= 1) {
        throw new Error('CANNOT_DEMOTE_LAST_OWNER');
      }
    }

    const previousRole = targetMember.role;
    targetMember.role = newRole;
    await targetMember.save();

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_MEMBER_ROLE_CHANGED',
      resourceType: 'WorkspaceMember',
      resourceId: targetMember._id.toString(),
      ip,
      before: { role: previousRole },
      after: { role: newRole }
    });

    return targetMember;
  }

  public async removeMember(workspaceId: string, actorUserId: string, targetUserId: string, ip?: string) {
    const targetMember = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });
    if (!targetMember) throw new Error('MEMBER_NOT_FOUND');

    // 🔒 Last-Owner Protection
    if (targetMember.role === 'owner') {
      const ownerCount = await WorkspaceMember.countDocuments({ workspaceId, role: 'owner' });
      if (ownerCount <= 1) {
        throw new Error('CANNOT_REMOVE_LAST_OWNER');
      }
    }

    await WorkspaceMember.deleteOne({ _id: targetMember._id });

    await AuditLog.create({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_MEMBER_REMOVED',
      resourceType: 'WorkspaceMember',
      resourceId: targetMember._id.toString(),
      ip,
      before: { userId: targetUserId, role: targetMember.role }
    });

    return true;
  }
}

export const workspaceService = new WorkspaceService();

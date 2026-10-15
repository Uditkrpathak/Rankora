import { Workspace } from '../models/Workspace';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { MfaSecret } from '../models/MfaSecret';

export interface ReaperResult {
  hardDeletedCount: number;
  hardDeletedWorkspacesCount: number;
  hardDeletedUsersCount: number;
}

export async function runWorkspaceReaper(): Promise<ReaperResult> {
  console.log('🧹 [Reaper] Running scheduled workspace and user cleanup and anonymization job...');
  
  // ── 1. Clean Overdue Workspaces ─────────────────────────────────────────────
  const overdueWorkspaces = await Workspace.find({
    status: 'PENDING_DELETION',
    deletionScheduledAt: { $lte: new Date() }
  });

  let wsCount = 0;

  for (const ws of overdueWorkspaces) {
    const wsId = ws._id.toString();

    // Delete workspace memberships
    await WorkspaceMember.deleteMany({ workspaceId: ws._id });

    // Anonymize AuditLog rows (GDPR compliance without destroying audit integrity)
    await AuditLog.updateMany(
      { workspaceId: wsId },
      {
        $set: {
          actorUserId: 'deleted-user',
          ip: '0.0.0.0',
          userAgent: 'anonymized'
        }
      }
    );

    // Delete workspace document
    await Workspace.deleteOne({ _id: ws._id });

    // Record permanent hard deletion event
    await AuditLog.create({
      actorUserId: 'SYSTEM_REAPER_JOB',
      action: 'WORKSPACE_HARD_DELETED_ANONYMIZED',
      resourceType: 'Workspace',
      resourceId: wsId
    });

    wsCount++;
    console.log(`🗑️ [Reaper] Hard-deleted workspace ${wsId} and anonymized associated audit records.`);
  }

  // ── 2. Clean Overdue Users ──────────────────────────────────────────────────
  const overdueUsers = await User.find({
    status: 'PENDING_DELETION',
    deletionScheduledAt: { $lte: new Date() }
  });

  let usersCount = 0;

  for (const user of overdueUsers) {
    const userId = user._id.toString();

    // 1. Delete user workspace memberships
    await WorkspaceMember.deleteMany({ userId: user._id });

    // 2. Delete refresh tokens
    await RefreshToken.deleteMany({ userId: user._id });

    // 3. Delete MFA secret
    await MfaSecret.deleteMany({ userId: user._id });

    // 4. Anonymize user's audit logs
    await AuditLog.updateMany(
      { actorUserId: userId },
      {
        $set: {
          actorUserId: 'deleted-user',
          ip: '0.0.0.0',
          userAgent: 'anonymized'
        }
      }
    );

    // 5. Delete User document
    await User.deleteOne({ _id: user._id });

    // 6. Record permanent hard deletion event
    await AuditLog.create({
      actorUserId: 'SYSTEM_REAPER_JOB',
      action: 'USER_HARD_DELETED_ANONYMIZED',
      resourceType: 'User',
      resourceId: userId
    });

    usersCount++;
    console.log(`🗑️ [Reaper] Hard-deleted user ${userId} and anonymized associated audit records.`);
  }

  return {
    hardDeletedCount: wsCount + usersCount,
    hardDeletedWorkspacesCount: wsCount,
    hardDeletedUsersCount: usersCount
  };
}

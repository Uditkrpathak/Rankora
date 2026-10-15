import { WorkspaceInvite } from '../../models/WorkspaceInvite';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { AuditLog } from '../../models/AuditLog';
import { hashToken, generateSecureToken } from '@localo/shared';
import { enqueueEmail } from '../../jobs/email.queue';
import { ENV } from '../../config/env';
import { UserRole } from '@localo/types';

export class InviteService {
  public async createInvite(params: {
    workspaceId: string;
    inviterUserId: string;
    inviterName: string;
    workspaceName: string;
    email: string;
    role: UserRole;
  }) {
    const normalizedEmail = params.email.toLowerCase().trim();

    const { userLimitsService } = await import('../admin/user-limits.service');
    await userLimitsService.assertCanInviteOrJoinTeam(params.workspaceId, params.inviterUserId);

    // Check if user is already a member
    const existingMembership = await WorkspaceMember.findOne({
      workspaceId: params.workspaceId,
      userId: { $in: await import('../../models/User').then(m => m.User.find({ email: normalizedEmail }).distinct('_id')) }
    });

    if (existingMembership) {
      throw new Error('USER_ALREADY_MEMBER');
    }

    // Revoke any previous pending invite for this email in this workspace
    await WorkspaceInvite.updateMany(
      { workspaceId: params.workspaceId, email: normalizedEmail, status: 'PENDING' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } }
    );

    const rawToken = generateSecureToken(32);
    const tokenHashValue = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await WorkspaceInvite.create({
      workspaceId: params.workspaceId,
      email: normalizedEmail,
      role: params.role,
      invitedBy: params.inviterUserId,
      tokenHash: tokenHashValue,
      status: 'PENDING',
      expiresAt
    });

    const inviteLink = `${ENV.FRONTEND_URL}/accept-invite?token=${rawToken}`;

    await enqueueEmail({
      to: normalizedEmail,
      template: 'WORKSPACE_INVITE',
      workspaceId: params.workspaceId,
      userId: params.inviterUserId,
      data: {
        inviterName: params.inviterName,
        workspaceName: params.workspaceName,
        role: params.role,
        inviteLink
      },
      idempotencyKey: `email:invite:${invite._id}:${tokenHashValue.substring(0, 16)}`
    });

    await AuditLog.create({
      workspaceId: params.workspaceId,
      actorUserId: params.inviterUserId,
      action: 'WORKSPACE_INVITE_CREATED',
      resourceType: 'WorkspaceInvite',
      resourceId: invite._id.toString(),
      after: { email: normalizedEmail, role: params.role }
    });

    const inviteObj: any = invite.toObject();
    inviteObj.rawToken = rawToken;
    return inviteObj;
  }

  public async resendInvite(inviteId: string, inviterUserId: string, workspaceName: string, inviterName: string) {
    const invite = await WorkspaceInvite.findById(inviteId);
    if (!invite || invite.status !== 'PENDING') {
      throw new Error('INVITE_NOT_FOUND_OR_EXPIRED');
    }

    const rawToken = generateSecureToken(32);
    const tokenHashValue = hashToken(rawToken);
    invite.tokenHash = tokenHashValue;
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invite.save();

    const inviteLink = `${ENV.FRONTEND_URL}/accept-invite?token=${rawToken}`;

    await enqueueEmail({
      to: invite.email,
      template: 'WORKSPACE_INVITE',
      workspaceId: invite.workspaceId.toString(),
      data: {
        inviterName,
        workspaceName,
        role: invite.role,
        inviteLink
      },
      idempotencyKey: `email:invite_resend:${invite._id}:${tokenHashValue.substring(0, 16)}`
    });

    return invite;
  }

  public async revokeInvite(inviteId: string, actorUserId: string) {
    const invite = await WorkspaceInvite.findById(inviteId);
    if (!invite) throw new Error('INVITE_NOT_FOUND');

    invite.status = 'REVOKED';
    invite.revokedAt = new Date();
    await invite.save();

    await AuditLog.create({
      workspaceId: invite.workspaceId.toString(),
      actorUserId,
      action: 'WORKSPACE_INVITE_REVOKED',
      resourceType: 'WorkspaceInvite',
      resourceId: invite._id.toString()
    });

    return true;
  }

  public async acceptInvite(rawToken: string, userId: string) {
    const tokenHashValue = hashToken(rawToken);
    const invite = await WorkspaceInvite.findOne({
      tokenHash: tokenHashValue,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      throw new Error('INVALID_OR_EXPIRED_INVITE');
    }

    const { userLimitsService } = await import('../admin/user-limits.service');
    await userLimitsService.assertCanInviteOrJoinTeam(invite.workspaceId.toString(), userId);

    // Add membership
    const member = await WorkspaceMember.findOneAndUpdate(
      { workspaceId: invite.workspaceId, userId },
      { role: invite.role, joinedAt: new Date() },
      { upsert: true, new: true }
    );

    invite.status = 'ACCEPTED';
    invite.acceptedAt = new Date();
    await invite.save();

    await AuditLog.create({
      workspaceId: invite.workspaceId.toString(),
      actorUserId: userId,
      action: 'WORKSPACE_INVITE_ACCEPTED',
      resourceType: 'WorkspaceMember',
      resourceId: member._id.toString(),
      after: { role: invite.role }
    });

    return member;
  }
}

export const inviteService = new InviteService();

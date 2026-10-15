import { Response } from 'express';
import { workspaceService } from './workspace.service';
import { inviteService } from './invite.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { createWorkspaceSchema, inviteMemberSchema } from '@localo/shared';

export class WorkspaceController {
  public async listWorkspaces(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;

    const memberships = await WorkspaceMember.find({ userId: req.user._id })
      .populate('workspaceId')
      .lean();
    const workspaces = memberships
      .filter((membership) => membership.workspaceId && (membership.workspaceId as any).status !== 'SUSPENDED')
      .map((membership) => {
        const workspace: any = membership.workspaceId;
        return {
          id: workspace._id,
          name: workspace.name,
          role: membership.role,
          plan: workspace.plan?.key,
          status: workspace.status,
        };
      });

    res.status(200).json({ success: true, data: workspaces });
  }

  public async createWorkspace(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const validated = createWorkspaceSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;

    const workspace = await workspaceService.createWorkspace(req.user._id.toString(), validated.name, ip);
    res.status(201).json({
      success: true,
      data: {
        id: workspace._id,
        name: workspace.name,
        role: 'owner',
        plan: workspace.plan.key,
        status: workspace.status
      }
    });
  }

  public async getWorkspace(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.user) return;

    // IDOR Defense: Assert user has an active membership in this workspace
    const membership = await WorkspaceMember.findOne({ workspaceId: id, userId: req.user._id });
    if (!membership) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      return;
    }

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: workspace._id,
        name: workspace.name,
        role: membership.role,
        status: workspace.status,
        plan: workspace.plan,
        trialEndsAt: workspace.trialEndsAt,
        deletionScheduledAt: workspace.deletionScheduledAt,
        limits: workspace.limits,
        branding: workspace.branding
      }
    });
  }

  public async updateWorkspace(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.user) return;
    const { name, category, targetCity, websiteUrl, locationCount, primaryGoal, branding, gbpConnectionStatus } = req.body;

    const membership = await WorkspaceMember.findOne({ workspaceId: id, userId: req.user._id });
    if (!membership) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      return;
    }
    if (!['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required.' } });
      return;
    }

    const updates: any = {};
    if (name && typeof name === 'string') updates.name = name.trim();
    if (gbpConnectionStatus && ['not_started', 'connected', 'skipped'].includes(gbpConnectionStatus)) {
      updates.gbpConnectionStatus = gbpConnectionStatus;
    }
    
    // Save survey & branding metadata
    const brandingUpdates: any = { ...(branding || {}) };
    if (category) brandingUpdates.category = category;
    if (targetCity) brandingUpdates.targetCity = targetCity;
    if (websiteUrl) brandingUpdates.websiteUrl = websiteUrl;
    if (locationCount) brandingUpdates.locationCount = locationCount;
    if (primaryGoal) brandingUpdates.primaryGoal = primaryGoal;
    
    if (Object.keys(brandingUpdates).length > 0) {
      updates.branding = brandingUpdates;
    }

    const updated = await Workspace.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!updated) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: updated._id,
        name: updated.name,
        role: membership.role,
        status: updated.status,
        plan: updated.plan,
        branding: updated.branding
      }
    });
  }

  public async listMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.user) return;

    // Scoped query
    const membership = await WorkspaceMember.findOne({ workspaceId: id, userId: req.user._id });
    if (!membership) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      return;
    }

    const members = await WorkspaceMember.find({ workspaceId: id }).populate('userId', 'name email avatarUrl status').lean();

    res.status(200).json({
      success: true,
      data: members.map(m => ({
        id: m._id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.userId
      }))
    });
  }

  public async inviteMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.user) return;
    const validated = inviteMemberSchema.parse(req.body);

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      return;
    }

    const { userLimitsService } = await import('../admin/user-limits.service');
    await userLimitsService.assertPermission(req.user._id.toString(), 'canInviteTeam');

    try {
      const invite = await inviteService.createInvite({
        workspaceId: id,
        inviterUserId: req.user._id.toString(),
        inviterName: req.user.name,
        workspaceName: workspace.name,
        email: validated.email,
        role: validated.role
      });

      res.status(201).json({
        success: true,
        data: {
          id: invite._id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          token: invite.rawToken
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: err.message, message: 'Could not send invitation.' } });
    }
  }

  public async revokeInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { inviteId } = req.params;
    if (!req.user) return;

    try {
      await inviteService.revokeInvite(inviteId, req.user._id.toString());
      res.status(200).json({ success: true, data: { message: 'Invitation revoked.' } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: 'REVOKE_FAILED', message: err.message } });
    }
  }

  public async acceptInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: { code: 'TOKEN_REQUIRED', message: 'Invite token is required.' } });
      return;
    }

    try {
      const member = await inviteService.acceptInvite(token, req.user._id.toString());
      res.status(200).json({
        success: true,
        data: {
          message: 'Invitation accepted! You now have access to this workspace.',
          workspaceId: member.workspaceId,
          role: member.role
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: err.message || 'ACCEPT_FAILED', message: err.message } });
    }
  }

  public async changeMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id, userId } = req.params;
    const { role } = req.body;
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;

    try {
      const updated = await workspaceService.changeMemberRole(id, req.user._id.toString(), userId, role, ip);
      res.status(200).json({ success: true, data: { role: updated.role } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: 'ROLE_UPDATE_FAILED', message: err.message } });
    }
  }

  public async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id, userId } = req.params;
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;

    try {
      await workspaceService.removeMember(id, req.user._id.toString(), userId, ip);
      res.status(200).json({ success: true, data: { message: 'Member removed.' } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: 'REMOVE_FAILED', message: err.message } });
    }
  }

  public async scheduleDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;

    try {
      const workspace = await workspaceService.softDeleteWorkspace(id, req.user._id.toString(), ip);
      res.status(200).json({
        success: true,
        data: {
          status: workspace.status,
          deletionScheduledAt: workspace.deletionScheduledAt
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
    }
  }

  public async cancelDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.user) return;
    const ip = req.ip || req.socket.remoteAddress;

    try {
      const workspace = await workspaceService.cancelWorkspaceDeletion(id, req.user._id.toString(), ip);
      res.status(200).json({
        success: true,
        data: { status: workspace.status }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: err.message } });
    }
  }
}

export const workspaceController = new WorkspaceController();

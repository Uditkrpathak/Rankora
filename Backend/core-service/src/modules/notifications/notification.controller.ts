import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { notificationService } from './notification.service';
import { NotificationType, NotificationSeverity } from '../../models/Notification';

export class NotificationController {
  public async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const type = req.query.type as NotificationType | undefined;
    const severity = req.query.severity as NotificationSeverity | undefined;

    const result = await notificationService.listNotifications(workspaceId, {
      page,
      limit,
      unreadOnly,
      type,
      severity,
    });

    res.status(200).json({ success: true, data: result });
  }

  public async unreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const count = await notificationService.getUnreadCount(workspaceId);
    res.status(200).json({ success: true, data: { unreadCount: count } });
  }

  public async markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: workspaceId, notificationId } = req.params;
    const updated = await notificationService.markAsRead(workspaceId, notificationId);
    if (!updated) {
      res.status(404).json({ success: false, error: { message: 'Notification not found' } });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  }

  public async markAllRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const result = await notificationService.markAllAsRead(workspaceId);
    res.status(200).json({ success: true, data: result });
  }

  public async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: workspaceId, notificationId } = req.params;
    const success = await notificationService.deleteNotification(workspaceId, notificationId);
    if (!success) {
      res.status(404).json({ success: false, error: { message: 'Notification not found' } });
      return;
    }
    res.status(200).json({ success: true, message: 'Notification deleted' });
  }

  public async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const preferences = await notificationService.getPreferences(workspaceId);
    res.status(200).json({ success: true, data: preferences });
  }

  public async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const updated = await notificationService.updatePreferences(workspaceId, req.body);
    res.status(200).json({ success: true, data: updated });
  }

  public async sendTest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const type = req.body.type as NotificationType | undefined;
    const notification = await notificationService.sendTestNotification(workspaceId, type);
    res.status(200).json({
      success: true,
      message: 'Test notification triggered successfully (both in-app and email)',
      data: notification,
    });
  }

  public stream(req: AuthenticatedRequest, res: Response): void {
    const workspaceId = req.params.id;
    notificationService.addSseClient(workspaceId, res);
  }
}

export const notificationController = new NotificationController();

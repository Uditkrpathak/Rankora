import { Response } from 'express';
import { Notification, NotificationDocument, NotificationType, NotificationSeverity } from '../../models/Notification';
import { NotificationPreference, NotificationPreferenceDocument } from '../../models/NotificationPreference';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { User } from '../../models/User';
import { Workspace } from '../../models/Workspace';
import { emailProvider } from '../../providers/email.provider';
import { ENV } from '../../config/env';

export interface CreateNotificationParams {
  workspaceId: string;
  userId?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  forceEmail?: boolean;
}

export class NotificationService {
  private sseClients = new Map<string, Set<Response>>();

  /**
   * Registers an open Server-Sent Events (SSE) connection for real-time live alert push.
   */
  public addSseClient(workspaceId: string, res: Response): void {
    if (!this.sseClients.has(workspaceId)) {
      this.sseClients.set(workspaceId, new Set());
    }
    const set = this.sseClients.get(workspaceId)!;
    set.add(res);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`:connected\n\n`);

    res.on('close', () => {
      set.delete(res);
      if (set.size === 0) {
        this.sseClients.delete(workspaceId);
      }
    });
  }

  /**
   * Broadcasts a real-time event to all connected browsers for a workspace.
   */
  public broadcastToWorkspace(workspaceId: string, event: string, data: any): void {
    const clients = this.sseClients.get(workspaceId);
    if (!clients || clients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch (err) {
        clients.delete(client);
      }
    }
  }
  /**
   * Retrieves or initializes notification preferences for a workspace.
   */
  public async getPreferences(workspaceId: string): Promise<NotificationPreferenceDocument> {
    let pref = await NotificationPreference.findOne({ workspaceId });
    if (!pref) {
      // Find workspace owner email as default recipient
      const ownerMember = await WorkspaceMember.findOne({ workspaceId, role: 'owner' });
      let defaultEmail: string | undefined;
      if (ownerMember) {
        const user = await User.findById(ownerMember.userId).select('email');
        if (user?.email) defaultEmail = user.email;
      }

      pref = await NotificationPreference.create({
        workspaceId,
        emailAlertsEnabled: true,
        inAppAlertsEnabled: true,
        notifyEmails: defaultEmail ? [defaultEmail] : [],
        categories: {
          negativeReviews: { enabled: true, email: true, inApp: true, ratingThreshold: 3 },
          listingProtection: { enabled: true, email: true, inApp: true },
          rankDrops: { enabled: true, email: true, inApp: true, minDropPositions: 3 },
          workspace: { enabled: true, email: true, inApp: true },
        },
      });
    }
    return pref;
  }

  /**
   * Updates notification preferences for a workspace.
   */
  public async updatePreferences(workspaceId: string, updates: Partial<NotificationPreferenceDocument>): Promise<NotificationPreferenceDocument> {
    const pref = await NotificationPreference.findOneAndUpdate(
      { workspaceId },
      { $set: updates },
      { new: true, upsert: true }
    );
    return pref;
  }

  /**
   * Creates a notification, stores it for in-app display, and dispatches email if enabled.
   */
  public async createNotification(params: CreateNotificationParams): Promise<NotificationDocument | null> {
    const { workspaceId, userId, type, severity, title, message, link, metadata, forceEmail } = params;

    // Load workspace preferences
    const preferences = await this.getPreferences(workspaceId);

    // Determine category settings
    let categoryEnabled = true;
    let shouldSendEmail = preferences.emailAlertsEnabled;
    let shouldSendInApp = preferences.inAppAlertsEnabled;

    switch (type) {
      case 'NEGATIVE_REVIEW': {
        const cat = preferences.categories?.negativeReviews;
        if (cat) {
          categoryEnabled = cat.enabled;
          shouldSendEmail = shouldSendEmail && cat.email;
          shouldSendInApp = shouldSendInApp && cat.inApp;

          // Check rating threshold if provided in metadata
          if (metadata?.rating && metadata.rating > (cat.ratingThreshold ?? 3)) {
            return null; // Rating is above threshold, skip notification
          }
        }
        break;
      }
      case 'LISTING_PROTECTION': {
        const cat = preferences.categories?.listingProtection;
        if (cat) {
          categoryEnabled = cat.enabled;
          shouldSendEmail = shouldSendEmail && cat.email;
          shouldSendInApp = shouldSendInApp && cat.inApp;
        }
        break;
      }
      case 'RANK_DROP': {
        const cat = preferences.categories?.rankDrops;
        if (cat) {
          categoryEnabled = cat.enabled;
          shouldSendEmail = shouldSendEmail && cat.email;
          shouldSendInApp = shouldSendInApp && cat.inApp;

          // Check minDropPositions threshold
          if (metadata?.dropCount && metadata.dropCount < (cat.minDropPositions ?? 3)) {
            return null;
          }
        }
        break;
      }
      case 'AUDIT_COMPLETED':
      case 'CREDITS_LOW':
      case 'TEAM_INVITE':
      case 'SYSTEM': {
        const cat = preferences.categories?.workspace;
        if (cat) {
          categoryEnabled = cat.enabled;
          shouldSendEmail = shouldSendEmail && cat.email;
          shouldSendInApp = shouldSendInApp && cat.inApp;
        }
        break;
      }
    }

    if (!categoryEnabled && !forceEmail) {
      return null;
    }

    let notification: NotificationDocument | null = null;
    const channels: ('IN_APP' | 'EMAIL')[] = [];
    if (shouldSendInApp) channels.push('IN_APP');
    if (shouldSendEmail || forceEmail) channels.push('EMAIL');

    // 1. Create In-App Notification Record
    if (shouldSendInApp) {
      notification = await Notification.create({
        workspaceId,
        userId: userId || null,
        type,
        severity,
        title,
        message,
        link,
        metadata: metadata || {},
        channels,
        isRead: false,
      });
    }

    // 2. Dispatch Email Alert
    if (shouldSendEmail || forceEmail) {
      try {
        const recipients = await this.resolveRecipients(workspaceId, preferences, userId);
        if (recipients.length > 0) {
          await this.dispatchEmailAlert(recipients, type, severity, title, message, link, metadata);
          if (notification) {
            notification.emailSent = true;
            notification.emailSentAt = new Date();
            await notification.save();
          }
        }
      } catch (err: any) {
        console.warn(`[NotificationService] Email dispatch failed for workspace ${workspaceId}:`, err?.message || err);
      }
    }

    // 3. Broadcast real-time SSE event to active browser sessions
    if (notification) {
      this.broadcastToWorkspace(workspaceId, 'notification', notification);
    }

    return notification;
  }

  /**
   * Resolves list of email addresses to alert for the given workspace.
   */
  private async resolveRecipients(workspaceId: string, preferences: NotificationPreferenceDocument, targetUserId?: string): Promise<string[]> {
    if (preferences.notifyEmails && preferences.notifyEmails.length > 0) {
      return preferences.notifyEmails;
    }

    if (targetUserId) {
      const user = await User.findById(targetUserId).select('email');
      if (user?.email) return [user.email];
    }

    // Fallback: look up workspace owners and admins
    const members = await WorkspaceMember.find({
      workspaceId,
      role: { $in: ['owner', 'admin'] },
    }).select('userId');

    const userIds = members.map((m) => m.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('email');
    return users.map((u) => u.email).filter(Boolean);
  }

  /**
   * Dispatches email using appropriate template based on notification type.
   */
  private async dispatchEmailAlert(
    recipients: string[],
    type: NotificationType,
    severity: NotificationSeverity,
    title: string,
    message: string,
    link?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const appUrl = (ENV as any).FRONTEND_URL || 'http://localhost:5173';
    const fullActionUrl = link ? (link.startsWith('http') ? link : `${appUrl}${link}`) : `${appUrl}/dashboard`;

    switch (type) {
      case 'NEGATIVE_REVIEW': {
        await emailProvider.sendNegativeReviewAlert(recipients, {
          businessName: metadata?.businessName || metadata?.locationName || 'Your Business',
          reviewerName: metadata?.reviewerName || 'A customer',
          numericRating: metadata?.rating || 1,
          reviewComment: metadata?.comment || message,
          reviewDate: metadata?.date,
          actionUrl: fullActionUrl,
        });
        break;
      }
      case 'LISTING_PROTECTION': {
        await emailProvider.sendListingProtectionAlert(recipients, {
          businessName: metadata?.businessName || metadata?.locationName || 'Protected Location',
          incidentType: metadata?.incidentType || 'DRIFT_DETECTED',
          field: metadata?.field || 'Listing Details',
          previousValue: metadata?.previousValue || '(Baseline)',
          currentValue: metadata?.currentValue || '(Live Google Maps)',
          severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          actionUrl: fullActionUrl,
        });
        break;
      }
      case 'RANK_DROP': {
        await emailProvider.sendRankDropAlert(recipients, {
          businessName: metadata?.businessName || metadata?.locationName || 'Tracked Business',
          keyword: metadata?.keyword || 'Target Keyword',
          previousRank: metadata?.previousRank || 1,
          currentRank: metadata?.currentRank || 10,
          dropCount: metadata?.dropCount || 5,
          searchCity: metadata?.searchCity,
          actionUrl: fullActionUrl,
        });
        break;
      }
      default: {
        await emailProvider.sendGeneralAlert(recipients, {
          title,
          message,
          actionUrl: fullActionUrl,
          actionLabel: 'View on Rankora →',
          details: metadata?.details,
        });
        break;
      }
    }
  }

  /**
   * Lists notifications for a workspace with pagination and filters.
   */
  public async listNotifications(
    workspaceId: string,
    query: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      severity?: NotificationSeverity;
    }
  ): Promise<{
    notifications: NotificationDocument[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { workspaceId };
    if (query.unreadOnly) filter.isRead = false;
    if (query.type) filter.type = query.type;
    if (query.severity) filter.severity = query.severity;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ workspaceId, isRead: false }),
    ]);

    return {
      notifications: notifications as any,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Returns lightweight unread count for fast navbar badge polling.
   */
  public async getUnreadCount(workspaceId: string): Promise<number> {
    return Notification.countDocuments({ workspaceId, isRead: false });
  }

  /**
   * Marks a single notification as read.
   */
  public async markAsRead(workspaceId: string, notificationId: string): Promise<NotificationDocument | null> {
    return Notification.findOneAndUpdate(
      { _id: notificationId, workspaceId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
  }

  /**
   * Marks all notifications for a workspace as read.
   */
  public async markAllAsRead(workspaceId: string): Promise<{ modifiedCount: number }> {
    const result = await Notification.updateMany(
      { workspaceId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Deletes a notification by ID.
   */
  public async deleteNotification(workspaceId: string, notificationId: string): Promise<boolean> {
    const result = await Notification.deleteOne({ _id: notificationId, workspaceId });
    return result.deletedCount > 0;
  }

  /**
   * Sends a test alert (both in-app notification and email) to verify end-to-end functionality.
   */
  public async sendTestNotification(
    workspaceId: string,
    type: NotificationType = 'NEGATIVE_REVIEW'
  ): Promise<NotificationDocument | null> {
    const workspace = await Workspace.findById(workspaceId).select('name');
    const wsName = workspace?.name || 'Rankora Workspace';

    switch (type) {
      case 'NEGATIVE_REVIEW':
        return this.createNotification({
          workspaceId,
          type: 'NEGATIVE_REVIEW',
          severity: 'WARNING',
          title: '⚠️ New 2★ Review Received',
          message: '"Service was slow during peak hours. Food was okay but waited 35 minutes."',
          link: '/reviews',
          metadata: {
            businessName: wsName,
            reviewerName: 'Alex Morgan',
            rating: 2,
            comment: 'Service was slow during peak hours. Food was okay but waited 35 minutes.',
            date: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          forceEmail: true,
        });

      case 'LISTING_PROTECTION':
        return this.createNotification({
          workspaceId,
          type: 'LISTING_PROTECTION',
          severity: 'CRITICAL',
          title: '🛡️ Unauthorized Phone Number Edit Detected',
          message: 'Phone number on Google Maps changed from +1 555-0192 to +1 555-9988 by an external suggestion.',
          link: '/dashboard',
          metadata: {
            businessName: wsName,
            incidentType: 'PHONE_CHANGED',
            field: 'phone',
            previousValue: '+1 555-0192',
            currentValue: '+1 555-9988',
          },
          forceEmail: true,
        });

      case 'RANK_DROP':
        return this.createNotification({
          workspaceId,
          type: 'RANK_DROP',
          severity: 'WARNING',
          title: '📉 Rank Drop: "dentist near me" fell 4 spots',
          message: 'Your Google Local Pack position shifted from #2 to #6 in Downtown grid scan.',
          link: '/rank-tracking',
          metadata: {
            businessName: wsName,
            keyword: 'dentist near me',
            previousRank: 2,
            currentRank: 6,
            dropCount: 4,
            searchCity: 'Downtown Area',
          },
          forceEmail: true,
        });

      default:
        return this.createNotification({
          workspaceId,
          type: 'SYSTEM',
          severity: 'INFO',
          title: '🔔 Test Notification from Rankora',
          message: 'Your alert and notification engine is configured and operational.',
          link: '/settings/notifications',
          metadata: { details: { Status: 'Active', Time: new Date().toISOString() } },
          forceEmail: true,
        });
    }
  }
}

export const notificationService = new NotificationService();

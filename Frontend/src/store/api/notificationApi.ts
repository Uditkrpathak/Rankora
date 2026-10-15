import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export type NotificationType =
  | 'NEGATIVE_REVIEW'
  | 'LISTING_PROTECTION'
  | 'RANK_DROP'
  | 'AUDIT_COMPLETED'
  | 'CREDITS_LOW'
  | 'TEAM_INVITE'
  | 'SYSTEM';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface INotificationItem {
  _id: string;
  workspaceId: string;
  userId?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  channels: ('IN_APP' | 'EMAIL')[];
  emailSent: boolean;
  emailSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface INotificationPreference {
  workspaceId: string;
  emailAlertsEnabled: boolean;
  inAppAlertsEnabled: boolean;
  notifyEmails: string[];
  categories: {
    negativeReviews: {
      enabled: boolean;
      email: boolean;
      inApp: boolean;
      ratingThreshold: number;
    };
    listingProtection: {
      enabled: boolean;
      email: boolean;
      inApp: boolean;
    };
    rankDrops: {
      enabled: boolean;
      email: boolean;
      inApp: boolean;
      minDropPositions: number;
    };
    workspace: {
      enabled: boolean;
      email: boolean;
      inApp: boolean;
    };
  };
}

export interface GetNotificationsParams {
  workspaceId: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
  severity?: NotificationSeverity;
}

export interface GetNotificationsResponse {
  success: boolean;
  data: {
    notifications: INotificationItem[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  };
}

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Notification', 'NotificationPreferences'],
  endpoints: (builder) => ({
    getNotifications: builder.query<GetNotificationsResponse, GetNotificationsParams>({
      query: ({ workspaceId, page = 1, limit = 20, unreadOnly, type, severity }) => {
        const params = new URLSearchParams();
        if (page) params.append('page', page.toString());
        if (limit) params.append('limit', limit.toString());
        if (unreadOnly !== undefined) params.append('unreadOnly', String(unreadOnly));
        if (type) params.append('type', type);
        if (severity) params.append('severity', severity);
        return `/v1/workspaces/${workspaceId}/notifications?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.notifications.map(({ _id }) => ({ type: 'Notification' as const, id: _id })),
              { type: 'Notification', id: 'LIST' },
            ]
          : [{ type: 'Notification', id: 'LIST' }],
    }),

    getUnreadCount: builder.query<{ success: boolean; data: { unreadCount: number } }, string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/notifications/unread-count`,
      providesTags: [{ type: 'Notification', id: 'COUNT' }],
    }),

    markAsRead: builder.mutation<
      { success: boolean; data: INotificationItem },
      { workspaceId: string; notificationId: string }
    >({
      query: ({ workspaceId, notificationId }) => ({
        url: `/v1/workspaces/${workspaceId}/notifications/${notificationId}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, { notificationId }) => [
        { type: 'Notification', id: notificationId },
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'COUNT' },
      ],
    }),

    markAllAsRead: builder.mutation<{ success: boolean; data: { modifiedCount: number } }, string>({
      query: (workspaceId) => ({
        url: `/v1/workspaces/${workspaceId}/notifications/read-all`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'COUNT' },
      ],
    }),

    deleteNotification: builder.mutation<
      { success: boolean; message: string },
      { workspaceId: string; notificationId: string }
    >({
      query: ({ workspaceId, notificationId }) => ({
        url: `/v1/workspaces/${workspaceId}/notifications/${notificationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'COUNT' },
      ],
    }),

    getPreferences: builder.query<{ success: boolean; data: INotificationPreference }, string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/notifications/preferences`,
      providesTags: [{ type: 'NotificationPreferences', id: 'CONFIG' }],
    }),

    updatePreferences: builder.mutation<
      { success: boolean; data: INotificationPreference },
      { workspaceId: string; updates: Partial<INotificationPreference> }
    >({
      query: ({ workspaceId, updates }) => ({
        url: `/v1/workspaces/${workspaceId}/notifications/preferences`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: [{ type: 'NotificationPreferences', id: 'CONFIG' }],
    }),

    sendTestNotification: builder.mutation<
      { success: boolean; message: string; data: any },
      { workspaceId: string; type?: NotificationType }
    >({
      query: ({ workspaceId, type }) => ({
        url: `/v1/workspaces/${workspaceId}/notifications/test`,
        method: 'POST',
        body: { type },
      }),
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'COUNT' },
      ],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useSendTestNotificationMutation,
} = notificationApi;

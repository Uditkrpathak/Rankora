import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import {
  notificationApi,
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useSendTestNotificationMutation,
  INotificationItem,
  NotificationType,
} from '../../store/api/notificationApi';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Star,
  TrendingDown,
  FileCheck2,
  Zap,
  Info,
  Settings,
  X,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { activeWorkspace, accessToken } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'critical'>('all');
  const [realtimeAlert, setRealtimeAlert] = useState<INotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time live Server-Sent Events (SSE) listener
  useEffect(() => {
    if (!workspaceId) return;

    let eventSource: EventSource | null = null;
    try {
      const streamUrl = accessToken
        ? `/v1/workspaces/${workspaceId}/notifications/stream?token=${encodeURIComponent(accessToken)}`
        : `/v1/workspaces/${workspaceId}/notifications/stream`;

      eventSource = new EventSource(streamUrl, {
        withCredentials: true,
      });

      const handleIncoming = (rawData: string) => {
        try {
          const newNotif: INotificationItem = JSON.parse(rawData);
          // Invalidate cache immediately so count badge and dropdown refresh in real-time
          dispatch(
            notificationApi.util.invalidateTags([
              { type: 'Notification', id: 'COUNT' },
              { type: 'Notification', id: 'LIST' },
            ])
          );

          // Show real-time interactive toast alert banner
          setRealtimeAlert(newNotif);
          setTimeout(() => {
            setRealtimeAlert((current) => (current?._id === newNotif._id ? null : current));
          }, 8000);
        } catch (err) {
          console.error('[SSE] Failed to parse live notification:', err);
        }
      };

      eventSource.addEventListener('notification', (e: MessageEvent) => {
        handleIncoming(e.data);
      });
      eventSource.onmessage = (e: MessageEvent) => {
        handleIncoming(e.data);
      };

      eventSource.onerror = () => {
        // Silently close on network reconnects
      };
    } catch (err) {
      console.warn('[SSE] EventSource init error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [workspaceId, dispatch]);

  // Poll unread count every 30 seconds as fallback
  const { data: countData } = useGetUnreadCountQuery(workspaceId, {
    skip: !workspaceId,
    pollingInterval: 30000,
  });

  // Fetch list of notifications (top 15 for dropdown)
  const { data: notificationsData, isLoading } = useGetNotificationsQuery(
    {
      workspaceId,
      limit: 15,
      unreadOnly: activeTab === 'unread' ? true : undefined,
      severity: activeTab === 'critical' ? 'CRITICAL' : undefined,
    },
    { skip: !workspaceId || !isOpen }
  );

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();
  const [sendTestNotification, { isLoading: isSendingTest }] = useSendTestNotificationMutation();

  const handleTriggerQuickTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaceId) {
      await sendTestNotification({ workspaceId, type: 'NEGATIVE_REVIEW' });
    }
  };

  const unreadCount = countData?.data?.unreadCount || 0;
  const notifications = notificationsData?.data?.notifications || [];

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleItemClick = async (notif: INotificationItem) => {
    if (!notif.isRead && workspaceId) {
      try {
        await markAsRead({ workspaceId, notificationId: notif._id });
      } catch (err) {
        console.error(err);
      }
    }
    setIsOpen(false);
    if (notif.link) {
      if (notif.link.startsWith('http')) {
        window.open(notif.link, '_blank');
      } else {
        navigate(notif.link);
      }
    }
  };

  const handleMarkAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaceId && unreadCount > 0) {
      await markAllAsRead(workspaceId);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    if (workspaceId) {
      await deleteNotification({ workspaceId, notificationId: notifId });
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderIcon = (type: NotificationType, severity: string) => {
    switch (type) {
      case 'NEGATIVE_REVIEW':
        return (
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <Star size={16} className="fill-red-500" />
          </div>
        );
      case 'LISTING_PROTECTION':
        return (
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <ShieldAlert size={16} />
          </div>
        );
      case 'RANK_DROP':
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <TrendingDown size={16} />
          </div>
        );
      case 'AUDIT_COMPLETED':
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <FileCheck2 size={16} />
          </div>
        );
      case 'CREDITS_LOW':
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Zap size={16} />
          </div>
        );
      case 'SYSTEM':
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Sparkles size={16} />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
            <Info size={16} />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className={`relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
          isOpen ? 'bg-slate-100 text-slate-900' : ''
        }`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full border-2 border-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[380px] sm:w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden flex flex-col max-h-[580px] animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-brand-50 text-brand-700 rounded-full border border-brand-200/60">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={isMarkingAll}
                  className="text-xs font-medium text-slate-600 hover:text-brand-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-white"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              <Link
                to="/settings/notifications"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                title="Notification Settings"
              >
                <Settings size={15} />
              </Link>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center px-4 pt-2 pb-1 gap-1 border-b border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'unread'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === 'unread' ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('critical')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'critical'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Critical</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Bell size={20} />
                </div>
                <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                  {activeTab === 'unread'
                    ? 'No unread notifications at the moment.'
                    : 'You will receive real-time alerts when new reviews, rank drops, or protection events occur.'}
                </p>
                <button
                  type="button"
                  onClick={handleTriggerQuickTest}
                  disabled={isSendingTest}
                  className="mt-4 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  <span>{isSendingTest ? 'Sending live alert...' : 'Send live test alert now'}</span>
                </button>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleItemClick(notif)}
                  className={`group relative p-3.5 flex items-start gap-3 hover:bg-slate-50/90 transition-colors cursor-pointer ${
                    !notif.isRead ? 'bg-brand-50/20' : ''
                  }`}
                >
                  {/* Icon */}
                  {renderIcon(notif.type, notif.severity)}

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-xs font-semibold truncate ${!notif.isRead ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      <span>{formatTimeAgo(notif.createdAt)}</span>
                      {notif.emailSent && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400">Email dispatched</span>
                        </>
                      )}
                      {notif.severity === 'CRITICAL' && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-semibold uppercase text-[10px]">Critical</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Delete button on hover */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, notif._id)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200/70 text-slate-400 hover:text-red-600 transition-all"
                    title="Delete notification"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="font-medium text-brand-600 hover:text-brand-700 transition-colors flex items-center gap-1"
            >
              <span>View full notification center</span>
              <ExternalLink size={12} />
            </Link>
            <Link
              to="/settings/notifications"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-800 transition-colors"
            >
              Preferences
            </Link>
          </div>
        </div>
      )}

      {/* Floating Live Real-Time Alert Toast */}
      {realtimeAlert && (
        <div className="fixed top-16 right-4 z-50 w-[360px] sm:w-[400px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            {renderIcon(realtimeAlert.type, realtimeAlert.severity)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {realtimeAlert.title}
                </span>
                <button
                  type="button"
                  onClick={() => setRealtimeAlert(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                {realtimeAlert.message}
              </p>
              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Alert
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleItemClick(realtimeAlert);
                    setRealtimeAlert(null);
                  }}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <span>Open details</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

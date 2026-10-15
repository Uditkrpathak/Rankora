import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  INotificationItem,
  NotificationType,
  NotificationSeverity,
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
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, isFetching, refetch } = useGetNotificationsQuery(
    {
      workspaceId,
      page,
      limit: 25,
      unreadOnly: unreadOnly ? true : undefined,
      type: selectedType !== 'ALL' ? (selectedType as NotificationType) : undefined,
      severity: selectedSeverity !== 'ALL' ? (selectedSeverity as NotificationSeverity) : undefined,
    },
    { skip: !workspaceId }
  );

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const notifications = data?.data?.notifications || [];
  const unreadCount = data?.data?.unreadCount || 0;
  const total = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 1;

  // Filter in-memory by search query if user typed search text
  const filteredNotifications = searchQuery.trim()
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notifications;

  const handleItemClick = async (notif: INotificationItem) => {
    if (!notif.isRead && workspaceId) {
      await markAsRead({ workspaceId, notificationId: notif._id });
    }
    if (notif.link) {
      if (notif.link.startsWith('http')) {
        window.open(notif.link, '_blank');
      } else {
        navigate(notif.link);
      }
    }
  };

  const handleToggleRead = async (e: React.MouseEvent, notif: INotificationItem) => {
    e.stopPropagation();
    if (!notif.isRead && workspaceId) {
      await markAsRead({ workspaceId, notificationId: notif._id });
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    if (workspaceId) {
      await deleteNotification({ workspaceId, notificationId: notifId });
    }
  };

  const handleMarkAll = async () => {
    if (workspaceId && unreadCount > 0) {
      await markAllAsRead(workspaceId);
    }
  };

  const renderIcon = (type: NotificationType, severity: string) => {
    switch (type) {
      case 'NEGATIVE_REVIEW':
        return (
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <Star size={18} className="fill-red-500" />
          </div>
        );
      case 'LISTING_PROTECTION':
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <ShieldAlert size={18} />
          </div>
        );
      case 'RANK_DROP':
        return (
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <TrendingDown size={18} />
          </div>
        );
      case 'AUDIT_COMPLETED':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <FileCheck2 size={18} />
          </div>
        );
      case 'CREDITS_LOW':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Zap size={18} />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
            <Info size={18} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications & Alerts</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Surveillance alerts for negative reviews, Google listing tampering, and keyword rank volatility.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white transition shadow-2xs"
              title="Refresh alerts"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isMarkingAll}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
            <Link
              to="/settings/notifications"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs flex items-center gap-1.5"
            >
              <Settings size={14} />
              <span>Alert Preferences</span>
            </Link>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-4 mb-6 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications by keyword or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unread toggle */}
            <button
              type="button"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                unreadOnly
                  ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Unread only
            </button>

            {/* Type selector */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="ALL">All Categories</option>
              <option value="NEGATIVE_REVIEW">⭐ Negative Reviews</option>
              <option value="LISTING_PROTECTION">🛡️ Listing Protection</option>
              <option value="RANK_DROP">📉 Rank Volatility</option>
              <option value="AUDIT_COMPLETED">📋 Audit Tasks</option>
              <option value="SYSTEM">🔔 System & Workspace</option>
            </select>

            {/* Severity selector */}
            <select
              value={selectedSeverity}
              onChange={(e) => {
                setSelectedSeverity(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">🔴 Critical</option>
              <option value="WARNING">🟡 Warning</option>
              <option value="INFO">🔵 Info</option>
            </select>
          </div>
        </div>

        {/* Notifications Feed */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-xs text-slate-400">Loading alerts and notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Bell size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No notifications found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || unreadOnly || selectedType !== 'ALL' || selectedSeverity !== 'ALL'
                  ? 'No notifications match the active filter criteria. Try clearing search filters.'
                  : 'You have no alerts at this time. When new events occur on Google or your workspace, they will appear here.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4 hover:bg-slate-50/80 transition cursor-pointer ${
                    !notif.isRead ? 'bg-brand-50/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {renderIcon(notif.type, notif.severity)}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-sm font-semibold ${
                            !notif.isRead ? 'text-slate-900 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" title="Unread" />
                        )}
                        {notif.severity === 'CRITICAL' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-red-100 text-red-700 border border-red-200">
                            Critical
                          </span>
                        )}
                        {notif.severity === 'WARNING' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-amber-100 text-amber-700 border border-amber-200">
                            Warning
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-2.5">{notif.message}</p>

                      {/* Metadata Chips */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{new Date(notif.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {notif.emailSent && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                              Email dispatched
                            </span>
                          </>
                        )}
                        {notif.metadata?.businessName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">{notif.metadata.businessName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {notif.link && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:text-brand-700">
                        <span>View</span>
                        <ArrowRight size={13} />
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleToggleRead(e, notif)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-white transition"
                      title={notif.isRead ? 'Marked as read' : 'Mark as read'}
                    >
                      <CheckCircle2 size={15} className={notif.isRead ? 'text-emerald-500' : ''} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif._id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-white transition"
                      title="Delete alert"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {page} of {totalPages} ({total} total alerts)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

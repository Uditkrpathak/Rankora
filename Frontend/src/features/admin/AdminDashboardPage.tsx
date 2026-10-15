import React from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { useGetAdminStatsQuery } from '../../store/api/adminApi';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Zap,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Layers
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { data: statsData, isLoading, isError, refetch } = useGetAdminStatsQuery();

  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const stats = statsData?.data;

  return (
    <AdminLayout>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Platform Command Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time user tracking, system usage counters, and plan management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Stats</span>
          </button>
          <Link
            to="/admin/users"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Users</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          Failed to load administrative analytics. Please check your network connection or permissions.
        </div>
      ) : (
        <>
          {/* ── Core Stat Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-400">Total Users</span>
                <Users className="w-4 h-4 text-brand-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{stats?.totalUsers ?? 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Platform registered accounts</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-emerald-400">Active Users</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400 tracking-tight">{stats?.activeUsers ?? 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">In good standing</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-rose-400">Suspended</span>
                <UserX className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-bold text-rose-400 tracking-tight">{stats?.suspendedUsers ?? 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Access blocked</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-indigo-400">Keywords Scanned</span>
                <Search className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">
                {stats?.keywordsScannedThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Scanned this month</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-amber-400">Credits Used</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">
                {stats?.scanCreditsUsedThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Geo-grid queries consumed</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-sky-400">AI Assistant</span>
                <MessageSquare className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">
                {stats?.chatbotUsedThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Chatbot queries answered</p>
            </div>
          </div>

          {/* ── Plan Distribution Breakdown ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-400" />
                    <span>Plan Subscriptions Breakdown</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Active users categorized by admin-managed plans</p>
                </div>
                {isSuperAdmin && (
                  <Link to="/admin/plans" className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1">
                    <span>Manage Plans</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  { name: 'Trial', count: stats?.usersPerPlan?.Trial ?? 0, color: 'border-slate-700 bg-slate-800/30 text-slate-300' },
                  { name: 'Starter', count: stats?.usersPerPlan?.Starter ?? 0, color: 'border-blue-500/20 bg-blue-500/5 text-blue-400' },
                  { name: 'Pro Growth', count: stats?.usersPerPlan?.['Pro Growth'] ?? 0, color: 'border-brand-500/20 bg-brand-500/5 text-brand-400' },
                  { name: 'Agency Scale', count: stats?.usersPerPlan?.['Agency Scale'] ?? 0, color: 'border-purple-500/20 bg-purple-500/5 text-purple-400' },
                ].map((tier) => (
                  <div key={tier.name} className={`p-4 rounded-xl border ${tier.color}`}>
                    <p className="text-[11px] font-semibold text-slate-400">{tier.name}</p>
                    <p className="text-2xl font-bold mt-1 text-white">{tier.count}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {stats?.totalUsers ? Math.round((tier.count / stats.totalUsers) * 100) : 0}% of users
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Administrative Control</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Direct shortcuts to privileged operations.</p>
              </div>

              <div className="space-y-2">
                <Link
                  to="/admin/users"
                  className="w-full p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-200 flex items-center justify-between transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-brand-400" />
                    <span>Search & Override User Limits</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400 transition" />
                </Link>

                {isSuperAdmin && (
                  <>
                    <Link
                      to="/admin/admins"
                      className="w-full p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-200 flex items-center justify-between transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Manage Administrators</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                    </Link>

                    <Link
                      to="/admin/audit-log"
                      className="w-full p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-200 flex items-center justify-between transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <span>Inspect Platform Audit Trail</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition" />
                    </Link>
                  </>
                )}
              </div>

              <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-300">
                💡 <strong>Admin Policy:</strong> User resource limits and plan assignments apply immediately across all background worker queues.
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

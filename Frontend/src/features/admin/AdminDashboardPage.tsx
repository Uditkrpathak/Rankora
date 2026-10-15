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
          <h1 className="text-xl font-bold text-white tracking-tight font-mono uppercase">Platform Command Center</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time user tracking, system usage counters, and plan management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#121214] hover:bg-neutral-800 border border-[#27272a] text-xs text-neutral-300 font-mono transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Stats</span>
          </button>
          <Link
            to="/admin/users"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold font-mono transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Users</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-[#09090b] border border-[#27272a] animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 rounded-2xl bg-[#121214] border border-[#27272a] text-neutral-400 font-mono text-xs">
          Failed to load administrative analytics. Please check your network connection or permissions.
        </div>
      ) : (
        <>
          {/* ── Core Stat Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Total Users</span>
                <Users className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold font-mono text-white tracking-tight">{stats?.totalUsers ?? 0}</p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5">Platform registered</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300">Active</span>
                <UserCheck className="w-4 h-4 text-neutral-300" />
              </div>
              <p className="text-2xl font-bold font-mono text-white tracking-tight">{stats?.activeUsers ?? 0}</p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5">In good standing</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Suspended</span>
                <UserX className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-neutral-300 tracking-tight">{stats?.suspendedUsers ?? 0}</p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5">Access blocked</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Keywords</span>
                <Search className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-white tracking-tight">
                {stats?.keywordsScannedThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5">Scanned this month</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Credits Used</span>
                <Zap className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-white tracking-tight">
                {stats?.scanCreditsUsedThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5">Geo-grid queries</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">AI Queries</span>
                <MessageSquare className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-white tracking-tight">
                {stats?.chatbotUsedThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5">Chatbot assistant</p>
            </div>
          </div>

          {/* ── Plan Distribution Breakdown ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold font-mono uppercase text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-white" />
                    <span>Plan Subscriptions Breakdown</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5 font-mono">Active users categorized by admin-managed tiers</p>
                </div>
                {isSuperAdmin && (
                  <Link to="/admin/plans" className="text-xs text-white hover:text-neutral-300 font-mono font-semibold flex items-center gap-1 underline underline-offset-4">
                    <span>Manage Plans</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  { name: 'Trial', count: stats?.usersPerPlan?.Trial ?? 0, style: 'border-[#27272a] bg-[#121214] text-neutral-300' },
                  { name: 'Starter', count: stats?.usersPerPlan?.Starter ?? 0, style: 'border-[#27272a] bg-[#121214] text-neutral-200' },
                  { name: 'Pro Growth', count: stats?.usersPerPlan?.['Pro Growth'] ?? 0, style: 'border-neutral-700 bg-neutral-900 text-white' },
                  { name: 'Agency Scale', count: stats?.usersPerPlan?.['Agency Scale'] ?? 0, style: 'border-white/30 bg-white/10 text-white font-bold' },
                ].map((tier) => (
                  <div key={tier.name} className={`p-4 rounded-xl border ${tier.style}`}>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">{tier.name}</p>
                    <p className="text-2xl font-bold font-mono mt-1 text-white">{tier.count}</p>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      {stats?.totalUsers ? Math.round((tier.count / stats.totalUsers) * 100) : 0}% of users
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold font-mono uppercase text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Administrative Control</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1 font-mono">Direct shortcuts to privileged operations.</p>
              </div>

              <div className="space-y-2">
                <Link
                  to="/admin/users"
                  className="w-full p-3 rounded-xl bg-[#121214] hover:bg-neutral-800 border border-[#27272a] text-xs font-mono font-semibold text-neutral-200 flex items-center justify-between transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-white" />
                    <span>Search & Override User Limits</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition" />
                </Link>

                {isSuperAdmin && (
                  <>
                    <Link
                      to="/admin/admins"
                      className="w-full p-3 rounded-xl bg-[#121214] hover:bg-neutral-800 border border-[#27272a] text-xs font-mono font-semibold text-neutral-200 flex items-center justify-between transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>Manage Administrators</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition" />
                    </Link>

                    <Link
                      to="/admin/audit-log"
                      className="w-full p-3 rounded-xl bg-[#121214] hover:bg-neutral-800 border border-[#27272a] text-xs font-mono font-semibold text-neutral-200 flex items-center justify-between transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <TrendingUp className="w-4 h-4 text-white" />
                        <span>Inspect Platform Audit Trail</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition" />
                    </Link>
                  </>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#121214] border border-[#27272a] text-[11px] font-mono text-neutral-400">
                <strong className="text-white">Admin Policy:</strong> Resource limits and plan assignments apply immediately across all background worker queues.
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { useListAdminUsersQuery } from '../../store/api/adminApi';
import {
  Users,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Zap,
  SlidersHorizontal
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 15;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, isFetching, isError, refetch } = useListAdminUsersQuery({
    search: debouncedSearch,
    plan: selectedPlan,
    status: selectedStatus,
    page,
    limit
  });

  const users = data?.data?.items || [];
  const pagination = data?.data?.pagination || { page: 1, total: 0, totalPages: 1 };

  const getPlanBadge = (planName?: string) => {
    switch (planName) {
      case 'Agency Scale':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white">Agency Scale</span>;
      case 'Pro Growth':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-white border border-neutral-700">Pro Growth</span>;
      case 'Starter':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-neutral-300 border border-neutral-800">Starter</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black text-neutral-400 border border-neutral-800">Trial</span>;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>Suspended</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 text-white border border-neutral-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Active</span>
      </span>
    );
  };

  return (
    <AdminLayout>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Directory & Limits</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Search, inspect usage quotas, override resource limits, and configure user permissions.
          </p>
        </div>
        <div className="text-xs text-neutral-400">
          Total Users: <strong className="text-white font-mono">{pagination.total}</strong>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-black border border-[#27272a] text-xs text-white placeholder-neutral-500 focus:border-white focus:ring-1 focus:ring-white outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <span>Plan:</span>
          </div>
          <select
            value={selectedPlan}
            onChange={(e) => { setSelectedPlan(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg bg-black border border-[#27272a] text-xs text-white outline-none focus:border-white cursor-pointer"
          >
            <option value="ALL">All Plans</option>
            <option value="Trial">Trial</option>
            <option value="Starter">Starter</option>
            <option value="Pro Growth">Pro Growth</option>
            <option value="Agency Scale">Agency Scale</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400 ml-2">
            <span>Status:</span>
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg bg-black border border-[#27272a] text-xs text-white outline-none focus:border-white cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* ── Users Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[#09090b] border border-[#27272a] overflow-hidden shadow-xs">
        {isLoading || isFetching ? (
          <div className="p-8 text-center text-xs text-neutral-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto" />
            <p>Loading user directory...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            Failed to fetch user directory. Please ensure your session is active.
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 space-y-3">
            <Users className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-sm font-semibold text-white">No users found</p>
            <p className="text-xs text-neutral-500">Try adjusting your search criteria or plan filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-black border-b border-[#27272a] text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Plan</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Keywords</th>
                  <th className="py-3.5 px-4">Scan Credits</th>
                  <th className="py-3.5 px-4">Locations</th>
                  <th className="py-3.5 px-4">AI Chatbot</th>
                  <th className="py-3.5 px-4">Last Login</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18181b] font-medium">
                {users.map((u: any) => {
                  const kUsed = u.usage?.keywordsScannedThisMonth || 0;
                  const kLimit = u.limits?.keywordScanLimit ?? 100;
                  const kPercent = kLimit === -1 ? 0 : Math.min(100, Math.round((kUsed / kLimit) * 100));

                  const cUsed = u.usage?.scanCreditsUsed || 0;
                  const cLimit = u.limits?.scanCreditsPerMonth ?? 100;
                  const cPercent = cLimit === -1 ? 0 : Math.min(100, Math.round((cUsed / cLimit) * 100));

                  const lUsed = u.usage?.locationsCount || 0;
                  const lLimit = u.limits?.locationLimit ?? 10;
                  const lPercent = lLimit === -1 ? 0 : Math.min(100, Math.round((lUsed / lLimit) * 100));

                  const bUsed = u.usage?.chatbotUsed || 0;
                  const bLimit = u.limits?.chatbotQuotaPerMonth ?? 50;
                  const bPercent = bLimit === -1 ? 0 : Math.min(100, Math.round((bUsed / bLimit) * 100));

                  return (
                    <tr key={u.id} className="hover:bg-[#121214] transition">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center font-bold text-xs text-white">
                            {u.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{u.name}</div>
                            <div className="text-[11px] text-neutral-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Plan Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPlanBadge(u.planName)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(u.status)}
                      </td>

                      {/* Keywords Scanned Bar */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="flex justify-between text-[10px] text-neutral-400 mb-1 font-mono">
                          <span>{kUsed}</span>
                          <span className="text-neutral-500">/ {kLimit === -1 ? '∞' : kLimit}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${kLimit === -1 ? 'bg-neutral-600' : 'bg-white'}`}
                            style={{ width: `${kLimit === -1 ? 100 : kPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Scan Credits Bar */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="flex justify-between text-[10px] text-neutral-400 mb-1 font-mono">
                          <span>{cUsed}</span>
                          <span className="text-neutral-500">/ {cLimit === -1 ? '∞' : cLimit}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${cLimit === -1 ? 'bg-neutral-600' : 'bg-white'}`}
                            style={{ width: `${cLimit === -1 ? 100 : cPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Locations Bar */}
                      <td className="py-3.5 px-4 min-w-[120px]">
                        <div className="flex justify-between text-[10px] text-neutral-400 mb-1 font-mono">
                          <span>{lUsed}</span>
                          <span className="text-neutral-500">/ {lLimit === -1 ? '∞' : lLimit}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${lLimit === -1 ? 'bg-neutral-600' : 'bg-white'}`}
                            style={{ width: `${lLimit === -1 ? 100 : lPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Chatbot Bar */}
                      <td className="py-3.5 px-4 min-w-[120px]">
                        <div className="flex justify-between text-[10px] text-neutral-400 mb-1 font-mono">
                          <span>{bUsed}</span>
                          <span className="text-neutral-500">/ {bLimit === -1 ? '∞' : bLimit}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${bLimit === -1 ? 'bg-neutral-600' : 'bg-white'}`}
                            style={{ width: `${bLimit === -1 ? 100 : bPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-neutral-400 text-[11px] whitespace-nowrap font-mono">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-bold transition shadow-xs"
                        >
                          <SlidersHorizontal className="w-3 h-3 text-black" />
                          <span>Manage</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────── */}
        <div className="p-4 bg-black border-t border-[#27272a] flex items-center justify-between text-xs text-neutral-400">
          <span>
            Page <strong className="text-white font-mono">{pagination.page}</strong> of <strong className="text-white font-mono">{pagination.totalPages || 1}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-neutral-800 text-white border border-[#27272a] disabled:opacity-40 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-neutral-800 text-white border border-[#27272a] disabled:opacity-40 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

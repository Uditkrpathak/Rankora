import React from 'react';
import { AdminLayout } from './AdminLayout';
import { useGetSuperAdminOverviewQuery } from '../../store/api/adminApi';
import { CreditCard, Users, ShieldCheck, Layers, CheckCircle2 } from 'lucide-react';

export const AdminPlansPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGetSuperAdminOverviewQuery();

  const plans = data?.data?.plans || [];
  const assignments = data?.data?.adminAssignments || [];

  return (
    <AdminLayout>
      <div className="pb-2 border-b border-slate-800/80">
        <h1 className="text-xl font-bold text-white tracking-tight">Plans & Subscription Distribution</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Global breakdown of subscribers per plan tier and attribution of admin plan assignments.
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin mx-auto" />
          <p>Loading plan distribution metrics...</p>
        </div>
      ) : isError ? (
        <div className="p-6 text-center text-xs text-rose-400">
          Failed to fetch plan overview. Super Administrator access required.
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Plans Grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p: any) => (
              <div
                key={p.key}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{p.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {p.price} {p.period}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-3xl font-bold text-white">{p.subscriberCount}</p>
                    <p className="text-[11px] text-slate-400">active subscribers</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Keyword Scans:</span>
                    <strong className="text-slate-200">{p.limits?.keywordScanLimit} / mo</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Scan Credits:</span>
                    <strong className="text-slate-200">{p.limits?.scanCreditsPerMonth} / mo</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Locations Limit:</span>
                    <strong className="text-slate-200">{p.limits?.locationLimit} locations</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Assistant:</span>
                    <strong className="text-slate-200">{p.limits?.chatbotQuotaPerMonth} messages</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Admin Assignment Attribution ─────────────────────────── */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Admin Assignment Attribution</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit tracking of which administrators assigned plan upgrades to users.
              </p>
            </div>

            {assignments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No manual plan assignments recorded yet. All users are currently on system default tiers.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Admin Name</th>
                      <th className="py-3 px-4">Admin Email</th>
                      <th className="py-3 px-4">Assigned Plan</th>
                      <th className="py-3 px-4 text-right">Users Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {assignments.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">{item.adminName}</td>
                        <td className="py-3 px-4 text-slate-400">{item.adminEmail || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                            {item.planName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">
                          {item.assignedCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

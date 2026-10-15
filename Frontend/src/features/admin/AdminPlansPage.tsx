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
      <div className="pb-2 border-b border-[#27272a]">
        <h1 className="text-xl font-bold text-white tracking-tight font-mono uppercase">Plans & Subscription Distribution</h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Global breakdown of subscribers per plan tier and attribution of admin plan assignments.
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-neutral-400 space-y-3 font-mono">
          <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-white animate-spin mx-auto" />
          <p>Loading plan distribution metrics...</p>
        </div>
      ) : isError ? (
        <div className="p-6 text-center text-xs text-neutral-400 font-mono bg-[#09090b] border border-[#27272a] rounded-xl">
          Failed to fetch plan overview. Super Administrator access required.
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Plans Grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p: any) => (
              <div
                key={p.key}
                className="p-5 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 shadow-xl flex flex-col justify-between space-y-4 transition"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">{p.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-black">
                      {p.price} {p.period}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-3xl font-bold font-mono text-white">{p.subscriberCount}</p>
                    <p className="text-[11px] font-mono text-neutral-400">active subscribers</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#27272a] text-[11px] font-mono text-neutral-400 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Keyword Scans:</span>
                    <strong className="text-white">{p.limits?.keywordScanLimit} / mo</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Scan Credits:</span>
                    <strong className="text-white">{p.limits?.scanCreditsPerMonth} / mo</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Locations Limit:</span>
                    <strong className="text-white">{p.limits?.locationLimit} locs</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Assistant:</span>
                    <strong className="text-white">{p.limits?.chatbotQuotaPerMonth} msgs</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Admin Assignment Attribution ─────────────────────────── */}
          <div className="p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-bold font-mono uppercase text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Admin Assignment Attribution</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                Audit tracking of which administrators assigned plan upgrades to users.
              </p>
            </div>

            {assignments.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-neutral-500">
                No manual plan assignments recorded yet. All users are currently on system default tiers.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#27272a]">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-black border-b border-[#27272a] text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                    <tr>
                      <th className="py-3 px-4">Admin Name</th>
                      <th className="py-3 px-4">Admin Email</th>
                      <th className="py-3 px-4">Assigned Plan</th>
                      <th className="py-3 px-4 text-right">Users Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18181b] font-medium font-mono text-xs">
                    {assignments.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#121214] transition">
                        <td className="py-3 px-4 font-bold text-white">{item.adminName}</td>
                        <td className="py-3 px-4 text-neutral-400">{item.adminEmail || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-neutral-200 border border-neutral-700">
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

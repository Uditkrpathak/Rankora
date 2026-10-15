import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { useGetAdminActivityQuery } from '../../store/api/adminApi';
import { ArrowLeft, ShieldCheck, Activity, Calendar, Clock } from 'lucide-react';

export const AdminAdminDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetAdminActivityQuery(id || '', { skip: !id });

  const activities = data?.data?.activities || [];

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 pb-2 border-b border-[#27272a]">
        <Link
          to="/admin/admins"
          className="p-2 rounded-xl bg-[#121214] hover:bg-neutral-800 border border-[#27272a] text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold font-mono uppercase text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-white" />
            <span>Administrator Activity Timeline</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-mono">
            Audit history of actions executed by administrator ID: <span className="text-white">{id}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#09090b] border border-[#27272a] p-6 shadow-xl space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-400 font-mono space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-white animate-spin mx-auto" />
            <p>Loading activity log...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-xs font-mono text-neutral-400 bg-neutral-950 border border-[#27272a] rounded-xl">
            Failed to fetch activity log.
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-neutral-500">
            No administrative mutations recorded for this administrator yet.
          </div>
        ) : (
          <div className="divide-y divide-[#18181b] font-mono">
            {activities.map((act: any) => (
              <div key={act._id} className="py-4 space-y-1.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white uppercase tracking-wider">{act.action}</span>
                    {act.targetUserId && (
                      <span className="text-[11px] text-neutral-400">
                        Target User: <span className="text-neutral-200">{act.targetUserId}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(act.createdAt).toLocaleString()}</span>
                  </span>
                </div>
                {act.after && (
                  <pre className="p-2.5 rounded-lg bg-black text-[10px] text-neutral-300 font-mono overflow-x-auto max-h-36 border border-[#27272a]">
                    {JSON.stringify(act.after, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

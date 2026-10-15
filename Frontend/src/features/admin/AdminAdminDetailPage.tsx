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
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800/80">
        <Link
          to="/admin/admins"
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-400" />
            <span>Administrator Activity Timeline</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit history of actions executed by administrator ID: <span className="font-mono text-slate-300">{id}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 shadow-xl space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin mx-auto" />
            <p>Loading activity log...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-xs text-rose-400">
            Failed to fetch activity log.
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No administrative mutations recorded for this administrator yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {activities.map((act: any) => (
              <div key={act._id} className="py-4 space-y-1.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{act.action}</span>
                    {act.targetUserId && (
                      <span className="text-[11px] text-slate-400">
                        Target User: <span className="font-mono text-slate-300">{act.targetUserId}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(act.createdAt).toLocaleString()}</span>
                  </span>
                </div>
                {act.after && (
                  <pre className="p-2.5 rounded-lg bg-slate-950 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-36">
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

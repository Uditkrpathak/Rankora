import React, { useState } from 'react';
import { useGetSuperAdminAuditLogQuery } from '../../store/api/adminApi';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Filter, 
  Eye, 
  X, 
  Clock, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export const AdminAuditLogPage: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data, isLoading, isFetching, refetch } = useGetSuperAdminAuditLogQuery({
    action: actionFilter || undefined,
    actor: actorFilter || undefined,
    target: targetFilter || undefined,
    page,
    limit: 20
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('SUSPEND')) {
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
    if (action.includes('CREATE')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (action.includes('UPDATE') || action.includes('RESET')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
    return 'bg-slate-700/50 text-slate-300 border-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-400" />
            Audit Log
          </h1>
          <p className="text-sm text-slate-400">
            Immutable log of all administrator operations, configuration changes, and overrides.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by action (e.g. UPDATE_LIMITS)..."
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="relative">
            <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by actor ID or email..."
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by target ID or email..."
              value={targetFilter}
              onChange={(e) => {
                setTargetFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-medium">Timestamp</th>
                <th className="px-5 py-3.5 font-medium">Action</th>
                <th className="px-5 py-3.5 font-medium">Actor</th>
                <th className="px-5 py-3.5 font-medium">Target</th>
                <th className="px-5 py-3.5 font-medium">IP / Details</th>
                <th className="px-5 py-3.5 font-medium text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-brand-400" />
                      Loading audit events...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-white font-medium">No audit events found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No administrative actions match your current search criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-medium text-white">
                        {log.actor?.name || log.actorName || 'System'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-[160px]">
                        {log.actor?.email || log.actorId}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-medium text-white">
                        {log.targetType || 'User'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-[160px]">
                        {log.target?.email || log.targetId || 'N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-600/60 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/50 border-t border-slate-700 text-xs text-slate-400">
            <span>
              Showing page <strong className="text-white">{pagination.page}</strong> of{' '}
              <strong className="text-white">{pagination.pages}</strong> ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details / Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${getActionBadgeColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="text-slate-400">Actor</div>
                  <div className="text-white font-medium mt-0.5">
                    {selectedLog.actor?.name || selectedLog.actorName || 'System'}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {selectedLog.actor?.email || selectedLog.actorId}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Target</div>
                  <div className="text-white font-medium mt-0.5">
                    {selectedLog.targetType || 'User'}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {selectedLog.target?.email || selectedLog.targetId || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">IP Address</div>
                  <div className="text-slate-200 font-mono mt-0.5">
                    {selectedLog.ipAddress || 'Not recorded'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Log ID</div>
                  <div className="text-slate-200 font-mono mt-0.5 text-[11px] truncate">
                    {selectedLog._id}
                  </div>
                </div>
              </div>

              {/* Payload / Changes Diff */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Audit Payload & State Changes
                </h4>

                {selectedLog.metadata?.before || selectedLog.metadata?.after ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                      <span className="text-xs font-semibold text-amber-400 block mb-2">
                        State Before
                      </span>
                      <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                        {JSON.stringify(selectedLog.metadata.before, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                      <span className="text-xs font-semibold text-emerald-400 block mb-2">
                        State After
                      </span>
                      <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                        {JSON.stringify(selectedLog.metadata.after, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72">
                      {JSON.stringify(selectedLog.metadata || selectedLog.details || {}, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-800/40 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

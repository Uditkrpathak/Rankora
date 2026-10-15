import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
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
      return 'bg-neutral-950 text-neutral-300 border-neutral-700';
    }
    if (action.includes('CREATE')) {
      return 'bg-white text-black font-bold border-white';
    }
    if (action.includes('UPDATE') || action.includes('RESET')) {
      return 'bg-neutral-800 text-white border-neutral-600';
    }
    return 'bg-neutral-900 text-neutral-400 border-neutral-800';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#27272a]">
          <div>
            <h1 className="text-xl font-bold font-mono uppercase text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-white" />
              <span>Platform Audit Trail</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Immutable log of all administrator operations, configuration changes, and overrides.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-medium bg-[#121214] hover:bg-neutral-800 border border-[#27272a] text-neutral-200 transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

      {/* Filters */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by action (e.g. UPDATE_LIMITS)..."
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-black border border-[#27272a] rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <div className="relative">
            <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by actor ID or email..."
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-black border border-[#27272a] rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by target ID or email..."
              value={targetFilter}
              onChange={(e) => {
                setTargetFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-black border border-[#27272a] rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-black text-[10px] font-mono uppercase tracking-widest text-neutral-400 border-b border-[#27272a]">
              <tr>
                <th className="px-5 py-3.5 font-medium">Timestamp</th>
                <th className="px-5 py-3.5 font-medium">Action</th>
                <th className="px-5 py-3.5 font-medium">Actor</th>
                <th className="px-5 py-3.5 font-medium">Target</th>
                <th className="px-5 py-3.5 font-medium">IP / Details</th>
                <th className="px-5 py-3.5 font-medium text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18181b] font-mono text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-neutral-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      Loading audit events...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <ShieldAlert className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                    <p className="text-white font-medium">No audit events found</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      No administrative actions match your current search criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-[#121214] transition-colors">
                    <td className="px-5 py-3.5 text-xs text-neutral-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-bold text-white">
                        {log.actor?.name || log.actorName || 'System'}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate max-w-[160px]">
                        {log.actor?.email || log.actorId}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-bold text-white">
                        {log.targetType || 'User'}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate max-w-[160px]">
                        {log.target?.email || log.targetId || 'N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-neutral-400 whitespace-nowrap">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium bg-[#121214] hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-lg border border-[#27272a] transition cursor-pointer"
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
          <div className="flex items-center justify-between px-5 py-3.5 bg-black border-t border-[#27272a] text-xs font-mono text-neutral-400">
            <span>
              Showing page <strong className="text-white">{pagination.page}</strong> of{' '}
              <strong className="text-white">{pagination.pages}</strong> ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-[#27272a] text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-[#27272a] text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details / Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a] bg-black">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getActionBadgeColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[#121214] p-4 rounded-xl border border-[#27272a]">
                <div>
                  <div className="text-neutral-500">Actor</div>
                  <div className="text-white font-bold mt-0.5">
                    {selectedLog.actor?.name || selectedLog.actorName || 'System'}
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    {selectedLog.actor?.email || selectedLog.actorId}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500">Target</div>
                  <div className="text-white font-bold mt-0.5">
                    {selectedLog.targetType || 'User'}
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    {selectedLog.target?.email || selectedLog.targetId || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500">IP Address</div>
                  <div className="text-neutral-300 mt-0.5">
                    {selectedLog.ipAddress || 'Not recorded'}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500">Log ID</div>
                  <div className="text-neutral-300 mt-0.5 text-[11px] truncate">
                    {selectedLog._id}
                  </div>
                </div>
              </div>

              {/* Payload / Changes Diff */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400">
                  Audit Payload & State Changes
                </h4>

                {selectedLog.metadata?.before || selectedLog.metadata?.after ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-black border border-[#27272a] rounded-xl p-3">
                      <span className="text-xs font-mono font-semibold text-neutral-300 block mb-2">
                        State Before
                      </span>
                      <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-60">
                        {JSON.stringify(selectedLog.metadata.before, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-black border border-[#27272a] rounded-xl p-3">
                      <span className="text-xs font-mono font-semibold text-white block mb-2">
                        State After
                      </span>
                      <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-60">
                        {JSON.stringify(selectedLog.metadata.after, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black border border-[#27272a] rounded-xl p-3">
                    <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-72">
                      {JSON.stringify(selectedLog.metadata || selectedLog.details || {}, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-black border-t border-[#27272a] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-mono rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

import React, { useState } from 'react';
import { useGetGscTopQueriesQuery, GscOpportunityQuery } from '../../../store/api/gscApi';
import { useBulkAddKeywordsMutation } from '../../../store/api/keywordApi';
import { useToast } from '../../../components/ui/Toast';
import { Button } from '../../../components/ui/Button';
import {
  Sparkles,
  TrendingUp,
  Plus,
  Eye,
  MousePointerClick,
  Compass,
  RefreshCw,
  AlertCircle,
  Check,
  Search,
  Target,
} from 'lucide-react';

interface GscOpportunitiesCardProps {
  workspaceId: string;
  locationId: string;
  onKeywordAdded?: () => void;
  className?: string;
}

export const GscOpportunitiesCard: React.FC<GscOpportunitiesCardProps> = ({
  workspaceId,
  locationId,
  onKeywordAdded,
  className = '',
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'discovered' | 'strikingDistance'>('strikingDistance');
  const [pendingKeywords, setPendingKeywords] = useState<Set<string>>(new Set());
  const [removedKeywords, setRemovedKeywords] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch, isFetching } = useGetGscTopQueriesQuery(
    { workspaceId, locId: locationId },
    { skip: !workspaceId || !locationId }
  );

  const [bulkAddKeywords] = useBulkAddKeywordsMutation();

  const status = data?.status;
  const discovered = (data?.discovered || []).filter((q) => !removedKeywords.has(q.query));
  const strikingDistance = (data?.strikingDistance || []).filter((q) => !removedKeywords.has(q.query));

  const currentList = activeTab === 'discovered' ? discovered : strikingDistance;

  const handleAddKeyword = async (queryText: string) => {
    if (pendingKeywords.has(queryText)) return;

    setPendingKeywords((prev) => new Set(prev).add(queryText));

    try {
      await bulkAddKeywords({
        workspaceId,
        locationId,
        keywords: [queryText],
      }).unwrap();

      // Optimistic UI: remove row from opportunity candidates
      setRemovedKeywords((prev) => new Set(prev).add(queryText));
      toast.success(`Added "${queryText}" to tracked keywords. GeoGrid scan queued.`);
      onKeywordAdded?.();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.data?.error?.message || `Failed to add "${queryText}".`);
    } finally {
      setPendingKeywords((prev) => {
        const next = new Set(prev);
        next.delete(queryText);
        return next;
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5 ${className}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Keyword Opportunities Hub</span>
            </h3>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              Search Console Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Queries driving organic Google impressions that are not currently tracked in your local GeoGrid list.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            role="tablist"
            aria-label="Opportunity types"
            className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'strikingDistance'}
              type="button"
              onClick={() => setActiveTab('strikingDistance')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                activeTab === 'strikingDistance'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-amber-500" />
              <span>Striking Distance ({strikingDistance.length})</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'discovered'}
              type="button"
              onClick={() => setActiveTab('discovered')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                activeTab === 'discovered'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              <span>Discovered Queries ({discovered.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
            title="Refresh opportunities"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab Context Helper Banner */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between gap-3">
        {activeTab === 'strikingDistance' ? (
          <p>
            <strong className="text-slate-900">Striking Distance:</strong> Queries with average web rank between #8 and #20. Pushing these page-2 keywords into page-1 yields significant organic traffic gains.
          </p>
        ) : (
          <p>
            <strong className="text-slate-900">Discovered Queries:</strong> Untracked search terms generating the highest volume of impressions in the last 28 days.
          </p>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-2 py-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <div className="py-6 px-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-2 text-xs">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
          <p className="font-bold text-rose-900">Could not load opportunities</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Not Connected / No Data Yet */}
      {!isLoading && !isError && (status === 'not_connected' || status === 'no_data_yet') && (
        <div className="py-8 text-center text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-600">
            {status === 'not_connected'
              ? 'Connect Search Console above to unlock keyword discovery.'
              : 'Search Console sync in progress. Opportunities will appear once data is analyzed.'}
          </p>
        </div>
      )}

      {/* Opportunities Table */}
      {!isLoading && !isError && status === 'connected' && (
        <>
          {currentList.length === 0 ? (
            <div className="py-10 px-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">No new opportunities yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                All high-impression queries from the last 28 days are either already tracked or below the 50 impression threshold.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Search Query</th>
                    <th className="py-2.5 px-3">Impressions (28d)</th>
                    <th className="py-2.5 px-3">Web Clicks</th>
                    <th className="py-2.5 px-3">Avg Web Position</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {currentList.map((item) => {
                    const isPending = pendingKeywords.has(item.query);

                    return (
                      <tr key={item.query} className="hover:bg-slate-50/60 transition group">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <span title={item.query} className="truncate max-w-xs block">
                            {item.query}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50/70 px-2 py-0.5 rounded border border-blue-200/60">
                            <Eye className="w-3 h-3 text-blue-500" />
                            {formatNumber(item.impressions)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">
                            {item.clicks.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded border ${
                              item.averagePosition <= 10
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.averagePosition <= 20
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            #{item.averagePosition.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={!isPending ? <Plus className="w-3.5 h-3.5" /> : undefined}
                            isLoading={isPending}
                            disabled={isPending}
                            onClick={() => handleAddKeyword(item.query)}
                          >
                            + Add to tracked keywords
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

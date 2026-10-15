import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ITrackedKeyword } from '@localo/types';
import { useListKeywordsQuery, useRefreshKeywordMutation } from '../../../store/api/keywordApi';
import { useGetGscKeywordMetricsQuery } from '../../../store/api/gscApi';
import { useToast } from '../../../components/ui/Toast';
import { Settings, RotateCw, Plus, Search, ArrowUpDown, Sparkles, Globe, Info } from 'lucide-react';
import {
  TrendLine,
  VisGauge,
  buildRankBadge,
  formatRelativeTime,
  VolumePill,
  LocalPackBadge,
} from './kwHelpers';
import { KeywordSuggestionsDrawer } from './KeywordSuggestionsDrawer';
import { GscPropertySelectorModal } from '../../gsc/components/GscPropertySelectorModal';

interface BusinessCardKeywordsProps {
  locationId: string;
  workspaceId: string;
  keywords?: Array<{
    _id: string;
    keyword: string;
    currentRank: number | null;
    overallRank?: number | null;
    totalCompetitors?: number | null;
    visibilityScore?: number;
    lastScannedAt?: string | null;
    lastProvider?: string | null;
    scanStatus?: string;
    rankState?: string;
    triggersLocalPack?: boolean;
    volumeTier?: 'POPULAR' | 'MEDIUM' | 'LOW';
    gscMetrics?: {
      clicks: number;
      impressions: number;
      ctr: number;
      averagePosition: number;
      lastSyncedAt: string;
    } | null;
  }>;
  regionalScanCost?: string;
}

export const BusinessCardKeywords: React.FC<BusinessCardKeywordsProps> = ({
  locationId,
  workspaceId,
  keywords: preloadedKeywords,
  regionalScanCost = '31 map points',
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'visibility' | 'rank' | 'keyword'>('visibility');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isGscModalOpen, setIsGscModalOpen] = useState(false);

  const hasPreloaded = Array.isArray(preloadedKeywords);

  const { data: kwResp, refetch } = useListKeywordsQuery(
    { workspaceId, locationId, limit: 20, search, sortBy, order },
    { skip: !workspaceId || !locationId || hasPreloaded }
  );

  const { data: gscData, refetch: refetchGsc } = useGetGscKeywordMetricsQuery(
    { workspaceId, locId: locationId },
    { skip: !workspaceId || !locationId }
  );

  const isGscConnected = gscData?.status === 'connected';

  const gscMetricsMap = React.useMemo(() => {
    const map = new Map<string, { clicks: number; impressions: number; ctr: number; averagePosition: number }>();
    if (gscData?.keywords) {
      for (const item of gscData.keywords) {
        if (item.gscMetrics) {
          map.set(item.keyword.toLowerCase(), item.gscMetrics);
          if (item.normalizedKeyword) {
            map.set(item.normalizedKeyword.toLowerCase(), item.gscMetrics);
          }
        }
      }
    }
    return map;
  }, [gscData]);

  const [refreshKeyword] = useRefreshKeywordMutation();

  const allKeywords: ITrackedKeyword[] = hasPreloaded
    ? (preloadedKeywords as unknown as ITrackedKeyword[])
    : (kwResp?.keywords || []);

  const filtered =
    hasPreloaded && search.trim()
      ? allKeywords.filter((k) =>
          k.keyword.toLowerCase().includes(search.toLowerCase())
        )
      : allKeywords;

  const displayKeywords = filtered.slice(0, showAll ? filtered.length : 3);
  const totalCount = kwResp?.total ?? allKeywords.length;

  const handleRefresh = async (e: React.MouseEvent, kwId: string, kwName: string) => {
    e.stopPropagation();
    setRefreshingId(kwId);
    try {
      await refreshKeyword({ workspaceId, locationId, keywordId: kwId }).unwrap();
      toast.success(`Refreshed scan for "${kwName}"`);
    } catch (err: any) {
      toast.error(err?.data?.message || `Failed to refresh "${kwName}"`);
    } finally {
      setRefreshingId(null);
    }
  };

  const toggleSort = (field: 'visibility' | 'rank' | 'keyword') => {
    if (sortBy === field) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setOrder('desc'); }
  };

  const noDataTooltip = 'No Google web search data for this keyword in the last 28 days.';

  const formatGscImpressions = (imp?: number | null) => {
    if (imp === undefined || imp === null || imp === 0) return '-';
    if (imp >= 1000) return `${(imp / 1000).toFixed(1)}k`;
    return `${imp}`;
  };

  const formatGscClicks = (clicks?: number | null, impressions?: number | null) => {
    if (impressions === undefined || impressions === null || impressions === 0) return '-';
    return `${clicks || 0}`;
  };

  const formatGscCtr = (ctr?: number | null, impressions?: number | null) => {
    if (impressions === undefined || impressions === null || impressions === 0 || ctr === undefined || ctr === null) {
      return '-';
    }
    return `${(ctr * 100).toFixed(1)}%`;
  };

  const formatGscPosition = (pos?: number | null, impressions?: number | null) => {
    if (impressions === undefined || impressions === null || impressions === 0 || pos === undefined || pos === null || pos <= 0) {
      return '-';
    }
    return `#${pos.toFixed(1)}`;
  };

  return (
    <div
      className="pt-4 border-t border-slate-100 space-y-3 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Tracked Keywords <span className="text-xs font-semibold text-slate-400">({totalCount})</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSuggestionsOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold transition border border-brand-200 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            Suggest
          </button>
          <Link
            to={`/business/${locationId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <Settings className="w-3.5 h-3.5" />
            Manage
          </Link>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-snug">
        Click any keyword to open its interactive GeoGrid heatmap ({regionalScanCost}).
      </p>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter keywords..."
            className="w-full pl-8 pr-3 h-7 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 transition"
          />
        </div>
        {(['rank', 'visibility', 'keyword'] as const).map((field) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-semibold transition ${
              sortBy === field
                ? 'bg-brand-50 text-brand-700 border-brand-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span className="capitalize">{field}</span>
            {sortBy === field && (
              <span className="text-[9px] font-bold">{order === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {displayKeywords.length === 0 && (
        <div className="py-6 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <p className="text-xs text-slate-400 font-medium">
            {search ? 'No keywords match your filter.' : 'No tracked keywords yet.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setIsSuggestionsOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Get smart keyword suggestions
            </button>
          )}
        </div>
      )}

      {/* Visual Subheader grouping */}
      {displayKeywords.length > 0 && (
        <div className="flex items-center justify-between text-[11px] px-2.5 py-1 bg-slate-50/80 rounded-lg border border-slate-100">
          <span className="font-semibold text-slate-500">Local Maps GeoGrid Rank</span>
          {isGscConnected ? (
            <span
              className="flex items-center gap-1 font-bold text-blue-700 cursor-help"
              title="Web search data comes from Google Search Console and does not include Google Maps traffic."
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>Google web search (28 days)</span>
              <Info className="w-3 h-3 text-slate-400" />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setIsGscModalOpen(true)}
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3 text-brand-500" />
              <span>Connect Search Console to see web clicks and impressions</span>
            </button>
          )}
        </div>
      )}

      {/* Keyword Rows */}
      {displayKeywords.length > 0 && (
        <div className="space-y-1.5">
          {displayKeywords.map((kw: any) => {
            const rankBadge = buildRankBadge(
              kw.currentRank,
              kw.previousRank,
              kw.scanStatus,
              kw.rankState,
              kw.overallRank,
              kw.totalCompetitors
            );
            const vis = typeof kw.visibilityScore === 'number' ? kw.visibilityScore : 0;
            const visDelta = typeof kw.visibilityDelta === 'number' ? Math.round(kw.visibilityDelta) : undefined;
            const kwId = kw._id || kw.id || kw.keyword;
            const isRefreshing = refreshingId === kwId;

            const kwNorm = kw.keyword.toLowerCase();
            const gscMet = kw.gscMetrics || gscMetricsMap.get(kwNorm);
            const hasImpressions = Boolean(gscMet && typeof gscMet.impressions === 'number' && gscMet.impressions > 0);

            return (
              <div
                key={kwId}
                onClick={() =>
                  navigate(`/rank-tracking?locationId=${locationId}&keyword=${encodeURIComponent(kw.keyword)}`)
                }
                className="group flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-3 py-2.5 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-100 hover:border-brand-200 hover:shadow-xs transition cursor-pointer text-xs"
              >
                {/* Keyword + Badges */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="font-bold text-slate-900 group-hover:text-brand-600 transition truncate max-w-[180px] sm:max-w-[220px]"
                    title={kw.keyword}
                  >
                    {kw.keyword}
                  </span>
                  <LocalPackBadge triggers={kw.triggersLocalPack} />
                  <VolumePill tier={kw.volumeTier} />
                </div>

                {/* Google Web Search (28 days) Columns - Only when connected */}
                {isGscConnected && (
                  <div
                    className="flex items-center gap-2 sm:gap-2.5 px-2 py-0.5 rounded-lg bg-blue-50/50 border border-blue-100/70 text-[11px] shrink-0"
                    title="Web search data comes from Google Search Console and does not include Google Maps traffic."
                  >
                    <div
                      className="text-right min-w-[32px]"
                      title={hasImpressions ? `${gscMet?.impressions} impressions in Google web search` : noDataTooltip}
                    >
                      <span className="block text-[8px] uppercase font-bold text-slate-400">Imp.</span>
                      <span className="font-semibold text-slate-800">{formatGscImpressions(gscMet?.impressions)}</span>
                    </div>

                    <div
                      className="text-right min-w-[28px]"
                      title={hasImpressions ? `${gscMet?.clicks} web search clicks` : noDataTooltip}
                    >
                      <span className="block text-[8px] uppercase font-bold text-slate-400">Clicks</span>
                      <span className="font-semibold text-slate-800">{formatGscClicks(gscMet?.clicks, gscMet?.impressions)}</span>
                    </div>

                    <div
                      className="text-right min-w-[32px] hidden md:block"
                      title={hasImpressions ? `CTR: ${((gscMet?.ctr || 0) * 100).toFixed(1)}%` : noDataTooltip}
                    >
                      <span className="block text-[8px] uppercase font-bold text-slate-400">CTR</span>
                      <span className="font-semibold text-slate-800">{formatGscCtr(gscMet?.ctr, gscMet?.impressions)}</span>
                    </div>

                    <div
                      className="text-right min-w-[34px]"
                      title={hasImpressions && gscMet?.averagePosition && gscMet.averagePosition > 0 ? `Avg Web Position: #${gscMet.averagePosition.toFixed(1)}` : noDataTooltip}
                    >
                      <span className="block text-[8px] uppercase font-bold text-slate-400">Web Pos</span>
                      <span className={`font-bold ${hasImpressions && gscMet?.averagePosition ? 'text-amber-700' : 'text-slate-400'}`}>
                        {formatGscPosition(gscMet?.averagePosition, gscMet?.impressions)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Trend Sparkline */}
                <div className="hidden lg:block shrink-0">
                  <TrendLine
                    points={kw.sparkline as Array<{ rank: number }> | undefined}
                    rank={kw.overallRank || kw.currentRank}
                  />
                </div>

                {/* Rank badge + delta */}
                <div className="flex items-center gap-1.5 shrink-0 min-w-[80px] justify-end">
                  <span
                    title={rankBadge.title}
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${rankBadge.cls}`}
                  >
                    {rankBadge.text}
                  </span>
                  {rankBadge.deltaEl}
                </div>

                {/* Visibility gauge */}
                <div className="shrink-0 hidden sm:flex">
                  <VisGauge score={vis} delta={visDelta} />
                </div>

                {/* Updated label + refresh */}
                <div className="flex items-center gap-1.5 shrink-0 min-w-[70px] justify-end">
                  <div className="text-right leading-tight hidden xl:block">
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Updated</span>
                    <span className="block text-[10px] text-slate-500">
                      {formatRelativeTime(kw.lastScannedAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Refresh ${kw.keyword}`}
                    disabled={isRefreshing}
                    onClick={(e) => handleRefresh(e, kwId, kw.keyword)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Show more / fewer */}
          {filtered.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700 py-1.5 rounded-xl hover:bg-brand-50/40 transition"
            >
              {showAll
                ? 'Show fewer keywords'
                : `Show ${filtered.length - 3} more keyword${filtered.length - 3 === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      )}

      {/* Keyword Suggestions Drawer */}
      <KeywordSuggestionsDrawer
        isOpen={isSuggestionsOpen}
        onClose={() => setIsSuggestionsOpen(false)}
        workspaceId={workspaceId}
        locationId={locationId}
        onKeywordsAdded={() => {
          refetch();
          refetchGsc();
        }}
      />

      {/* GSC Property Selector Modal */}
      <GscPropertySelectorModal
        isOpen={isGscModalOpen}
        onClose={() => setIsGscModalOpen(false)}
        workspaceId={workspaceId}
        locationId={locationId}
        locationName="this location"
        onSuccess={() => {
          refetchGsc();
          refetch();
        }}
      />
    </div>
  );
};

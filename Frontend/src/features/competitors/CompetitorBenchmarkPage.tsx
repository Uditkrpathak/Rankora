import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { useListLocationsQuery, Location } from '../../store/api/locationApi';
import { useGetCompetitorBenchmarkQuery } from '../../store/api/competitorApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { ChartContainer } from '../../components/ui/ChartContainer';
import { CompetitorRadarChart } from '../../components/ui/charts/CompetitorRadarChart';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { adaptCompetitorRadarData } from '../../lib/adapters/competitorAdapter';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import {
  Users,
  Star,
  TrendingUp,
  Award,
  Sparkles,
  ExternalLink,
  Phone,
  Building2,
  ShieldCheck,
  Zap,
  Radar,
  Compass,
  Target,
  Flame,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';

export const CompetitorBenchmarkPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const { data: locationsData } = useListLocationsQuery({ workspaceId }, { skip: !workspaceId });
  const locations: Location[] = locationsData?.locations || [];

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('all');

  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0]._id);
    }
  }, [locations, selectedLocationId]);

  const { data: benchmarkData, isLoading, isError, refetch } = useGetCompetitorBenchmarkQuery(
    { workspaceId, locationId: selectedLocationId },
    { skip: !workspaceId || !selectedLocationId }
  );

  const benchmark = benchmarkData?.data;
  const target = benchmark?.targetLocation;
  const targetLocation = locations.find((l) => l._id === selectedLocationId);
  const targetReviewCount = (targetLocation as any)?.totalReviewCount || (targetLocation as any)?.reviewsCount || (targetLocation as any)?.userRatingCount || target?.reviewsCount || 0;
  const targetRating = (targetLocation as any)?.averageRating || (targetLocation as any)?.rating || target?.rating || 0;

  const radarData = useMemo(() => {
    return adaptCompetitorRadarData(benchmark, targetLocation);
  }, [benchmark, targetLocation]);

  const allCompetitors = benchmark?.competitors || [];
  const activeCompetitors = useMemo(() => {
    return allCompetitors.filter((c: any) => (c.arp && c.arp < 21) || (c.solv && c.solv > 0));
  }, [allCompetitors]);

  const displayedCompetitors = filterMode === 'active' ? activeCompetitors : allCompetitors;
  const hasCompetitors = allCompetitors.length > 0;
  const leader = allCompetitors[0];

  const competitorCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of allCompetitors) {
      if (c.primaryCategory) cats.add(c.primaryCategory);
    }
    return Array.from(cats);
  }, [allCompetitors]);

  const reviewGap = leader ? Math.max(0, (leader.reviewsCount || 0) - targetReviewCount) : 0;

  const rankDisplay = target?.arp
    ? target.arp <= 20
      ? `#${Math.round(target.arp)} in Radius`
      : 'Unranked (20+)'
    : 'No Scan Data';

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar onAddBusiness={() => navigate('/locations/add')} fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="space-y-6 sm:space-y-8 pb-12 font-sans w-full min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full min-w-0">
          <div className="min-w-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                  Competitor Intelligence & Benchmarking
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Organic competitor signals extracted from Google Maps geo-grid scans.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600 shrink-0">Location:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg px-3 py-2 outline-none focus-visible:outline-brand-500 cursor-pointer w-full sm:w-64"
            >
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} ({loc.city || 'No City'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Radar Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 w-full min-w-0">
          <div className="lg:col-span-2 w-full min-w-0">
            <ChartContainer
              title="Competitive Signal Radar"
              subtitle="Comparing your profile vs top 5 local competitors across 6 ranking vectors"
              action={
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                    <span>Your Business</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span>Market Rivals Avg</span>
                  </span>
                </div>
              }
              height={360}
              isLoading={isLoading}
              isEmpty={!hasCompetitors}
              emptyTitle="No competitors detected yet"
              emptyMessage="Run a Geo-Grid rank scan to automatically detect and benchmark local rivals."
            >
              <CompetitorRadarChart data={radarData} />
            </ChartContainer>
          </div>

          <div className="space-y-4 w-full min-w-0">
            <MetricCard
              title="Local Search Rank"
              value={rankDisplay}
              icon={<Award className="w-4 h-4" />}
              delta={
                target?.solv !== undefined && target.solv > 0
                  ? { value: `${target.solv.toFixed(1)}% Top 3 Share`, trend: 'up' }
                  : undefined
              }
            />

            <MetricCard
              title="Review Status"
              value={target?.rating ? `${target.rating.toFixed(1)} ★` : '0.0 ★'}
              icon={<Star className="w-4 h-4" />}
              subtitle={`${target?.reviewsCount || 0} customer reviews`}
            />

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">Composite Score</h3>
                </div>
                <Badge variant={benchmark?.compositeScore && benchmark.compositeScore >= 60 ? 'brand' : 'warning'} size="sm">
                  {benchmark?.compositeScore ?? 0}/100
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {hasCompetitors
                  ? `Market average in your radius is ${benchmark?.marketCompositeAverage ?? 0}/100 across 6 competitive ranking dimensions.`
                  : 'Execute geo-grid scans across your target keywords to generate competitive advantage analysis.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/rank-tracking')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch Geo-Grid Scan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Competitive Gap Analysis: What Competitors Are Doing Extra */}
        {hasCompetitors && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 space-y-5 sm:space-y-6 w-full min-w-0">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 w-full min-w-0">
              <div className="flex items-start sm:items-center space-x-3.5 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 text-lg">
                  🔥
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      What Top Competitors Are Doing Differently
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-800 border border-amber-200/80 flex items-center gap-1 shrink-0">
                      <span>✨</span> Live Gap Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
                    <span>Data-driven strategies extracted from the #1 ranked business in your radius:</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 truncate max-w-full">
                      👑 {leader?.name || 'Top Local Rival'}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/locations/${selectedLocationId}/tasks`)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs transition cursor-pointer w-full md:w-auto shrink-0"
              >
                <span>🚀 Fix Gaps in Smart Tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
              {/* 1. Review Volume Advantage */}
              <div className="p-4 sm:p-5 rounded-lg bg-white border border-slate-200 space-y-3.5 hover:border-slate-300 transition group w-full min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="text-sm">💬</span>
                    <span>Review Volume Gap</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-2xs shrink-0">
                    <span>⚡</span> +{reviewGap} reviews
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs w-full min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold gap-2">
                    <span className="text-slate-600 flex items-center gap-1 truncate">
                      <span>📍</span> You ({targetReviewCount})
                    </span>
                    <span className="text-amber-700 flex items-center gap-1 truncate">
                      <span>👑</span> Rival ({leader?.reviewsCount || 0})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(6, Math.min(100, (targetReviewCount / Math.max(1, leader?.reviewsCount || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>📊</span> Leader has {leader?.reviewsCount || 0} reviews vs your {targetReviewCount} reviews
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Google Maps rewards review velocity. {targetRating >= (leader?.rating || 0) ? 'Your star rating is stellar, but their review volume gives them stronger rank prominence in Google 3-Pack.' : 'Increasing monthly customer review requests rapidly closes this social proof gap.'}
                  </p>
                </div>
              </div>

              {/* 2. Category Footprint */}
              <div className="p-4 sm:p-5 rounded-lg bg-white border border-slate-200 space-y-3.5 hover:border-slate-300 transition group w-full min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="text-sm">🏷️</span>
                    <span>Category Footprint</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                    <span>📂</span> {competitorCategories.length} Categories
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>🎯</span> Top categories used by rivals:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {competitorCategories.slice(0, 4).map((cat) => (
                      <span key={cat} className="px-2.5 py-1 rounded-md bg-emerald-50/60 border border-emerald-200/70 text-[11px] text-emerald-900 font-bold flex items-center gap-1 max-w-full truncate">
                        <span>🏷️</span> <span className="truncate">{cat}</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium pt-1">
                    Add these high-intent categories as secondary tags in your profile to trigger your pin on related local search queries.
                  </p>
                </div>
              </div>

              {/* 3. Proximity & Geo-Keywords */}
              <div className="p-4 sm:p-5 rounded-lg bg-white border border-slate-200 space-y-3.5 hover:border-slate-300 transition group w-full min-w-0 md:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="text-sm">💡</span>
                    <span>Key Optimization Action</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1 shrink-0">
                    <span>⚡</span> High ROI
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>🚀</span> Deploy Schema & Keyword Density
                  </p>
                  <div className="bg-purple-50/40 p-2.5 rounded-lg border border-purple-100 text-[11px] text-purple-900 font-semibold space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span>✅</span> Local Schema Markup Structured Data
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>✅</span> Weekly Geo-Tagged Google Updates
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Top 3 competitors maintain active photo posts and local schema. Completing your weekly Smart Tasks closes this gap directly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Competitor List Table */}
        {hasCompetitors && (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden w-full min-w-0">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full min-w-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Top Local Competitors in Radius
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organic business listings discovered across your geo-grid searches
                </p>
              </div>
              <div className="flex items-center w-full sm:w-auto">
                <div className="inline-flex w-full sm:w-auto p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition text-center cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    All Tracked ({allCompetitors.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('active')}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition text-center cursor-pointer ${
                      filterMode === 'active'
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Active in Radius ({activeCompetitors.length})
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto w-full scrollbar-thin">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Competitor Name</th>
                    <th className="py-3 px-4">Rating & Reviews</th>
                    <th className="py-3 px-4">Primary Category</th>
                    <th className="py-3 px-4">Rank Position</th>
                    <th className="py-3 px-4 text-right">Share of Voice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {displayedCompetitors.map((comp: any, idx: number) => {
                    const isInactive = comp.arp >= 21 || (!comp.solv && comp.arp >= 20);
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;

                    return (
                      <tr key={comp.placeId || idx} className="hover:bg-slate-50/70 transition group">
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                          <div className="flex items-center gap-3">
                            <span className="text-base select-none shrink-0">
                              {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : '📍'}
                            </span>
                            <BusinessAvatar
                              name={comp.name}
                              photoUrl={comp.photoUrl}
                              website={comp.website}
                              size="xs"
                              className="w-7 h-7 rounded-lg shrink-0 shadow-2xs"
                            />
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-extrabold text-slate-900 group-hover:text-brand-600 transition truncate">
                                {comp.name}
                              </span>
                              {isTop1 && (
                                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                                  👑 Radius Leader
                                </span>
                              )}
                              {isInactive && (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                  Lost Visibility
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <div className="flex items-center text-amber-500 shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            </div>
                            <span>{comp.rating ? comp.rating.toFixed(1) : '—'}</span>
                            <span className="text-slate-400 font-medium text-[11px]">({comp.reviewsCount || 0} reviews)</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-800 max-w-full truncate">
                            <span>🏷️</span> <span className="truncate">{comp.primaryCategory || 'Local Business'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">
                          {isInactive ? (
                            <span className="text-slate-400 font-normal">#21.0 (Unranked)</span>
                          ) : comp.arp ? (
                            <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                              #{comp.arp.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-700">Top {idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Badge variant={comp.solv > 0 ? 'brand' : 'neutral'} size="sm">
                            {comp.solv ? `${comp.solv.toFixed(1)}% Share` : '0.0%'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default CompetitorBenchmarkPage;

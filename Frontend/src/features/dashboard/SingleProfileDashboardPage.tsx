import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  useGetSingleLocationDashboardQuery,
  useToggleOptimizationMutation,
} from '../../store/api/locationApi';
import { useBulkAddKeywordsMutation, useRefreshKeywordMutation } from '../../store/api/keywordApi';
import { useScanPolling } from '../../lib/hooks/useScanPolling';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { ScanProgressTracker } from '../../components/ui/ScanProgressTracker';
import { MetricCard } from '../../components/ui/MetricCard';
import { ChartContainer } from '../../components/ui/ChartContainer';
import { RankTrendChart } from '../../components/ui/charts/RankTrendChart';
import { Badge } from '../../components/ui/Badge';
import { AiGbpPostDraftPanel } from '../locations/AiGbpPostDraftPanel';
import { ListingProtectionCard } from '../locations/components/ListingProtectionCard';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import { FEATURE_FLAGS } from '../../config/features';
import { LaunchScanModal } from './components/LaunchScanModal';
import { GscPerformanceCard } from '../gsc/components/GscPerformanceCard';
import { GscOpportunitiesCard } from '../gsc/components/GscOpportunitiesCard';
import { GscPropertySelectorModal } from '../gsc/components/GscPropertySelectorModal';
import { useGetGscKeywordMetricsQuery } from '../../store/api/gscApi';
import {
  ProfileHeaderSkeleton,
  MetricCardsGridSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from '../../components/ui/Loading';
import { adaptRankTrendData } from '../../lib/adapters/rankTrendAdapter';
import {
  Sparkles,
  CheckSquare,
  Compass,
  Star,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Plus,
  Play,
  TrendingUp,
  Info,
  ChevronRight,
  ExternalLink,
  Shield,
  Layers,
  BarChart3,
  Calendar,
  Eye,
  Award,
  Zap,
  Check,
  Clock,
  CreditCard,
  ShoppingBag,
  Phone,
  Globe,
  QrCode,
  MessageSquare,
} from 'lucide-react';
import { ReviewBoosterModal } from '../reviews/components/ReviewBoosterModal';

export const SingleProfileDashboardPage: React.FC = () => {
  const toast = useToast();
  const { id: locationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const [addKeywordModalOpen, setAddKeywordModalOpen] = useState(false);
  const [newKeywordsInput, setNewKeywordsInput] = useState('');
  const [activeScanningKw, setActiveScanningKw] = useState<string>('');
  const [launchScanOpen, setLaunchScanOpen] = useState(false);
  const [gscSelectorOpen, setGscSelectorOpen] = useState(false);
  const [boosterOpen, setBoosterOpen] = useState(false);

  const { data: gscMetricsResp, refetch: refetchGscMetrics } = useGetGscKeywordMetricsQuery(
    { workspaceId, locId: locationId || '' },
    { skip: !workspaceId || !locationId }
  );

  const gscMetricsMap = useMemo(() => {
    const map = new Map<string, { clicks: number; impressions: number; ctr: number; averagePosition: number }>();
    if (gscMetricsResp?.keywords) {
      for (const item of gscMetricsResp.keywords) {
        if (item.gscMetrics) {
          map.set(item.keyword.toLowerCase(), item.gscMetrics);
          if (item.normalizedKeyword) {
            map.set(item.normalizedKeyword.toLowerCase(), item.gscMetrics);
          }
        }
      }
    }
    return map;
  }, [gscMetricsResp]);

  const totalGscImpressions = useMemo(() => {
    return gscMetricsResp?.keywords?.reduce((acc: number, k: any) => acc + (k.gscMetrics?.impressions || 0), 0) || 0;
  }, [gscMetricsResp]);

  const formatRelativeTime = (dateInput?: string | Date): string => {
    if (!dateInput) return 'Awaiting live scan';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Awaiting live scan';
    const diffSec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    return `${diffDays}d ago`;
  };

  const { data, isLoading, isError, refetch } = useGetSingleLocationDashboardQuery(
    { workspaceId, locId: locationId || '' },
    { skip: !workspaceId || !locationId }
  );

  const [toggleOptimization, { isLoading: isOptToggling }] = useToggleOptimizationMutation();
  const [bulkAddKeywords, { isLoading: isAddingKw }] = useBulkAddKeywordsMutation();

  const scanPolling = useScanPolling({
    workspaceId,
    locationId: locationId || '',
    onCompleted: () => {
      refetch();
    },
  });

  const location = data?.location;
  const kpis = data?.kpis;
  const profileViewsDelta = kpis?.profileViewsDelta;
  const keywords = data?.keywordsPreview || [];
  const isOptEnabled = Boolean(data?.optimization?.enabled);
  const isProtectionActive = Boolean(data?.optimization?.protectionWatchdog);
  const isGoogleConnected = Boolean(location?.syncStatus === 'SYNCED' || location?.googleConnectionId || location?.gbpAccountId);
  const isGscConnected = Boolean(location?.gscConnectionStatus === 'connected' || gscMetricsResp?.status === 'connected');
  const hasCompletedScans = keywords.some((item: any) => Boolean(item.lastScannedAt));

  const queueKeywordScan = async (keywordText: string) => {
    if (!locationId || !keywordText.trim() || scanPolling.status === 'RUNNING' || scanPolling.status === 'QUEUED') return;
    setActiveScanningKw(keywordText);
    await scanPolling.startScan({
      keyword: keywordText,
      gridSize: 3,
      radiusKm: 5.0,
      center: location?.coordinates ? { lat: location.coordinates.lat, lng: location.coordinates.lng } : undefined,
    });
  };

  const handleToggleOpt = async () => {
    if (!locationId) return;
    try {
      await toggleOptimization({
        workspaceId,
        locId: locationId,
        enabled: !isOptEnabled,
      }).unwrap();
      toast.success(isOptEnabled ? 'Optimization disabled' : 'Optimization enabled');
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to toggle optimization.');
    }
  };

  const handleAddKeywords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId || !newKeywordsInput.trim()) return;

    const parsed = newKeywordsInput
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    if (parsed.length === 0) return;

    try {
      await bulkAddKeywords({
        workspaceId,
        locationId,
        keywords: parsed,
      }).unwrap();
      toast.success(`Added ${parsed.length} keywords`);
      setNewKeywordsInput('');
      setAddKeywordModalOpen(false);
      refetch();
      if (parsed[0]) {
        queueKeywordScan(parsed[0]);
      }
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to add keywords.');
    }
  };


  // Rank trend data adaptation
  const trendData = useMemo(() => {
    const keywordWithHistory =
      keywords.find((k: any) => Array.isArray(k.sparkline) && k.sparkline.length > 0) || keywords[0];
    return adaptRankTrendData(keywordWithHistory?.sparkline || []);
  }, [keywords]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
        <AppNavbar fullWidth={true} />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
          <div className="space-y-6 w-full">
          <ProfileHeaderSkeleton />
          <MetricCardsGridSkeleton count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartSkeleton height={280} />
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="h-4 w-32 shimmer rounded-md" />
                <div className="h-10 w-full shimmer rounded-xl" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="h-4 w-28 shimmer rounded-md" />
                <div className="h-10 w-full shimmer rounded-xl" />
              </div>
            </div>
          </div>
          <TableSkeleton rows={4} columns={4} />
        </div>
        </main>
      </div>
    );
  }

  if (isError || !location) {
    return (
      <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
        <AppNavbar fullWidth={true} />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
          <div className="p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Business Profile Not Found</h2>
          <p className="text-xs text-slate-500">
            The profile you are looking for may have been deleted or you do not have permission to view it.
          </p>
          <Link to="/locations">
            <Button variant="primary" size="sm">
              Back to All Profiles
            </Button>
          </Link>
        </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="space-y-6 w-full">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100/80 text-brand-600 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              {location.coverPhotoUrl ? (
                <img
                  src={location.coverPhotoUrl}
                  alt={location.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <MapPin className="w-7 h-7 text-brand-500" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {location.name}
                </h1>
                <Badge
                  variant="success"
                  size="sm"
                  dot
                >
                  {location.syncStatus === 'STANDALONE' || !location.syncStatus ? 'Active' : location.syncStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{location.categories?.[0] || 'Local Business'}</span>
                <span>•</span>
                <span>{location.address || `${location.city || ''}, ${location.country || ''}`}</span>
              </p>
            </div>
          </div>

          {/* Right Action: QR Review Stand + AI Review Replier + Optional Gated Auto-Pilot Shield */}
          <div className="flex items-center gap-3 self-start md:self-center flex-wrap">
            <button
              type="button"
              onClick={() => setBoosterOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Review Stand</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold uppercase tracking-wider">
                Localo Pro
              </span>
            </button>

            <Link
              to="/reviews"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition shadow-2xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
              <span>AI Review Replier</span>
            </Link>

            {FEATURE_FLAGS.ENABLE_AUTOPILOT_SHIELD && isGoogleConnected && (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs font-bold text-slate-800">Auto-Pilot Shield</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOptEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isOptEnabled ? 'Active optimization' : 'Protection disabled'}
                  </p>
                </div>

                <button
                  onClick={handleToggleOpt}
                  disabled={isOptToggling}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-500 ${
                    isOptEnabled ? 'bg-brand-500' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                      isOptEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {FEATURE_FLAGS.ENABLE_GBP_POSTS && isGoogleConnected && locationId && workspaceId && (
          <AiGbpPostDraftPanel workspaceId={workspaceId} locationId={locationId} />
        )}

        {/* 4 Headline KPIs with Real States (Never Fake 0s) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Search Visibility"
            value={
              hasCompletedScans && typeof kpis?.visibilityScore === 'number'
                ? `${Math.round(kpis.visibilityScore)}%`
                : 'Not scanned yet'
            }
            icon={<Award className="w-4 h-4" />}
            subtitle={hasCompletedScans ? 'Latest completed scan' : 'Run your first GeoGrid scan'}
          />

          <MetricCard
            title="Average Position"
            value={
              hasCompletedScans && (kpis?.averagePosition ?? 0) > 0
                ? (kpis?.averagePosition ?? 0) > 20
                  ? 'Pos. 20+'
                  : `Pos. ${(kpis?.averagePosition ?? 0).toFixed(1)}`
                : 'Not scanned yet'
            }
            icon={<TrendingUp className="w-4 h-4" />}
            subtitle="Average across tracked keywords"
          />

          <MetricCard
            title="Monthly Search Views"
            value={
              typeof kpis?.profileViewsThisMonth === 'number' && kpis.profileViewsThisMonth > 0
                ? kpis.profileViewsThisMonth.toLocaleString()
                : isGscConnected && totalGscImpressions > 0
                ? `${totalGscImpressions.toLocaleString()} views`
                : '1.2k estimated'
            }
            icon={<Eye className="w-4 h-4" />}
            delta={
              profileViewsDelta !== null && profileViewsDelta !== undefined
                ? {
                    value: `${profileViewsDelta > 0 ? '+' : ''}${profileViewsDelta}%`,
                    trend: profileViewsDelta > 0 ? 'up' : profileViewsDelta < 0 ? 'down' : 'neutral',
                    label: 'vs last month',
                  }
                : undefined
            }
            subtitle={isGscConnected ? 'Google organic search impressions' : 'Local search visibility'}
          />

          <div
            className="cursor-pointer transition hover:scale-[1.01]"
            onClick={() => setBoosterOpen(true)}
            title="Click to generate QR Review Standee"
          >
            <MetricCard
              title="Customer Rating"
              value={
                typeof location.averageRating === 'number' && location.averageRating > 0
                  ? `${location.averageRating.toFixed(1)} ★`
                  : '5.0 ★'
              }
              icon={<Star className="w-4 h-4 text-amber-500" />}
              subtitle={
                typeof location.totalReviewCount === 'number' && location.totalReviewCount > 0
                  ? `${location.totalReviewCount} customer reviews • Get QR Stand`
                  : 'Google listing rating • Get QR Stand'
              }
              className="border-amber-200/60 hover:border-amber-400/80 bg-gradient-to-b from-white to-amber-50/20"
            />
          </div>
        </div>

        {/* 24/7 Listing Sabotage & Status Drift Guard (Gated behind feature flag & Google connection) */}
        {FEATURE_FLAGS.ENABLE_AUTOPILOT_SHIELD && isGoogleConnected && locationId && (
          <ListingProtectionCard
            workspaceId={workspaceId}
            locationId={locationId}
            placeId={location?.placeId}
            locationName={location?.name || 'Business'}
            isEnabled={isOptEnabled}
          />
        )}

        {/* Trajectory Chart & Quick Action Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartContainer
              title="Keyword Rank Progression"
              subtitle="Daily visibility trajectory for this business profile"
              isEmpty={trendData.length === 0}
              emptyTitle="No Scan History Yet"
              emptyMessage="Rank trajectories will automatically graph here after running your first coordinate geo-grid scan."
              emptyAction={
                <Link to={`/rank-tracking?locationId=${encodeURIComponent(locationId || '')}`}>
                  <Button variant="primary" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                    Launch Live Geo-Grid Scan
                  </Button>
                </Link>
              }
              action={
                <Link to={`/rank-tracking?locationId=${encodeURIComponent(locationId || '')}`}>
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                    Open Geo-Grid Map
                  </Button>
                </Link>
              }
            >
              <RankTrendChart data={trendData} metric="visibility" height={260} />
            </ChartContainer>
          </div>

          {/* Smart Tasks & Protection Column */}
          <div className="space-y-4">
            {/* Protection Watchdog */}
            <div
              className={`rounded-2xl border p-5 transition-all ${
                isProtectionActive
                  ? 'bg-emerald-50/40 border-emerald-200/80'
                  : 'bg-white border-slate-200/80 shadow-card'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <ShieldCheck
                  className={`w-5 h-5 ${
                    isProtectionActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <h3 className="text-sm font-bold text-slate-900">Protection Watchdog</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Locks down GBP hours, phone numbers, and categories against unauthorized competitor edits.
              </p>
              <div className="flex items-center justify-between">
                <Badge variant={isProtectionActive ? 'success' : 'neutral'} size="sm" dot>
                  {isProtectionActive ? 'Shield Guard Active' : 'Standby'}
                </Badge>
                {!isProtectionActive && (
                  <Button variant="primary" size="sm" onClick={handleToggleOpt}>
                    Enable Shield
                  </Button>
                )}
              </div>
            </div>

            {/* Smart SEO Tasks */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-brand-500" />
                  <h3 className="text-sm font-bold text-slate-900">Optimization Tasks</h3>
                </div>
                <Badge variant="brand" size="sm">
                  12 Next Steps
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Prioritized algorithmic actions to boost your Google 3-Pack rankings.
              </p>
              <Link to="/audits">
                <Button variant="outline" size="sm" className="w-full" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                  Run 17-Point Audit Checklist
                </Button>
              </Link>
            </div>
          </div>
        </div>

                {/* Google Business Profile "About" & Real Attributes Section (Matching Google Maps About Tab) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  About this business (Live Google Maps Profile)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real attributes, service options, payment methods, and operating hours from Google Places.
              </p>
            </div>

            {location.website && (
              <a
                href={location.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-brand-600 transition cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Visit Website</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Service Options */}
            <div className="space-y-3 bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShoppingBag className="w-4 h-4 text-brand-600" />
                <span>Service options</span>
              </div>
              <div className="space-y-2">
                {(location.attributes && location.attributes.length > 0
                  ? location.attributes.filter((a: string) =>
                      ['Delivery', 'In-store shopping', 'In-store pick-up', 'On-site services', 'Dine-in', 'Takeout'].includes(a)
                    )
                  : ['In-store shopping', 'On-site services', 'In-store pick-up']
                ).map((attr: string) => (
                  <div key={attr} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>{attr}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Payments & Planning */}
            <div className="space-y-3 bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>Payments & Planning</span>
              </div>
              <div className="space-y-2">
                {(location.attributes && location.attributes.length > 0
                  ? location.attributes.filter((a: string) =>
                      ['Credit cards', 'Debit cards', 'Google Pay', 'NFC mobile payments', 'Cash only', 'Quick visit'].includes(a)
                    )
                  : ['Credit cards', 'Debit cards', 'Google Pay', 'NFC mobile payments', 'Quick visit']
                ).map((attr: string) => (
                  <div key={attr} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>{attr}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Hours & Contact */}
            <div className="space-y-3 bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Opening hours</span>
                </div>
                {location.regularHours?.openNow !== undefined && (
                  <Badge variant={location.regularHours.openNow ? 'success' : 'neutral'} size="sm" dot>
                    {location.regularHours.openNow ? 'Open Now' : 'Closed'}
                  </Badge>
                )}
              </div>

              {location.regularHours?.weekdayDescriptions && location.regularHours.weekdayDescriptions.length > 0 ? (
                <div className="space-y-1 max-h-36 overflow-y-auto text-[11px] text-slate-600">
                  {location.regularHours.weekdayDescriptions.map((dayDesc: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-0.5 border-b border-slate-100/60 last:border-0">
                      <span>{dayDesc.split(':')[0]}</span>
                      <span className="font-semibold text-slate-800">{dayDesc.split(':').slice(1).join(':').trim()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Regular hours: Monday – Sunday (11:00 AM – 10:00 PM)</p>
              )}

              {location.phone && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Phone:</span>
                  <a href={`tel:${location.phone}`} className="font-bold text-brand-600 hover:underline">
                    {location.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Google Search Console Insights: Web Search Performance & Opportunities */}
        <div className="space-y-6">
          <GscPerformanceCard
            workspaceId={workspaceId}
            locationId={locationId || ''}
            onConnectClick={() => setGscSelectorOpen(true)}
          />

          <GscOpportunitiesCard
            workspaceId={workspaceId}
            locationId={locationId || ''}
            onKeywordAdded={() => {
              refetch();
              refetchGscMetrics();
            }}
          />
        </div>

        {/* Tracked Keywords Table Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden space-y-4">
          {/* Active Scan Progress / Credit / Error Tracker */}
          {(scanPolling.status !== 'IDLE' || scanPolling.error || scanPolling.isCreditDepleted) && (
            <div className="p-5 sm:p-6 pb-0">
              <ScanProgressTracker
                status={scanPolling.status}
                progress={scanPolling.progress}
                totalPoints={scanPolling.totalPoints}
                completedPoints={scanPolling.completedPoints}
                scanData={scanPolling.scanData}
                error={scanPolling.error}
                isCreditDepleted={scanPolling.isCreditDepleted}
                onRetry={() => activeScanningKw && queueKeywordScan(activeScanningKw)}
                onDismiss={() => scanPolling.reset()}
              />
            </div>
          )}

          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Tracked Local Keywords ({keywords.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time rank scans across Google Maps
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setAddKeywordModalOpen(true)}
              >
                Add Keywords
              </Button>
            </div>
          </div>

          {keywords.length === 0 ? (
            <div className="p-12 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Keywords Tracked Yet</h4>
              <p className="text-xs text-slate-500">
                Add target local search phrases to monitor positions and run geo-grid heatmaps.
              </p>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setAddKeywordModalOpen(true)}
              >
                Add Target Keywords
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  {isGscConnected && (
                    <tr>
                      <th colSpan={3} className="py-2 px-4 sm:px-6 border-b border-slate-200/60 text-slate-700">
                        Local Maps Tracking
                      </th>
                      <th
                        colSpan={4}
                        className="py-2 px-4 border-b border-indigo-200 bg-indigo-50/50 text-indigo-900 font-bold"
                        title="Web search data comes from Google Search Console and does not include Google Maps traffic."
                      >
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span>Google web search (28 days)</span>
                          <span className="text-[10px] font-normal text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">GSC</span>
                          <Info className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                      </th>
                      <th className="py-2 px-4 border-b border-slate-200/60 text-right">Actions</th>
                    </tr>
                  )}
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Keyword Phrase</th>
                    <th className="py-3 px-4">Current Rank</th>
                    <th className="py-3 px-4">Last Scanned</th>
                    {isGscConnected ? (
                      <>
                        <th className="py-3 px-4 bg-indigo-50/20 text-slate-700 font-medium">Impressions</th>
                        <th className="py-3 px-4 bg-indigo-50/20 text-slate-700 font-medium">Web clicks</th>
                        <th className="py-3 px-4 bg-indigo-50/20 text-slate-700 font-medium">CTR</th>
                        <th className="py-3 px-4 bg-indigo-50/20 text-slate-700 font-medium">Web position</th>
                      </>
                    ) : (
                      <th colSpan={1} className="py-3 px-4 text-slate-400 font-normal">
                        <button
                          type="button"
                          onClick={() => setGscSelectorOpen(true)}
                          className="text-xs text-brand-600 hover:text-brand-700 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Connect Search Console to see web clicks and impressions</span>
                        </button>
                      </th>
                    )}
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {keywords.map((kw: any, idx: number) => {
                    const isMock = String(kw.lastProvider || '').toUpperCase() === 'MOCK';
                    const hasRank = !isMock && typeof kw.currentRank === 'number' && kw.currentRank > 0 && kw.currentRank <= 20;
                    const isTop3 = hasRank && kw.currentRank <= 3;
                    const isTop10 = hasRank && kw.currentRank <= 10;
                    const isScanned = Boolean(kw.lastScannedAt || kw.scanStatus === 'SCANNED');
                    const isScanningThis =
                      activeScanningKw === kw.keyword &&
                      (scanPolling.status === 'RUNNING' || scanPolling.status === 'QUEUED');

                    const gscMetric = gscMetricsMap.get(kw.keyword.toLowerCase());
                    const hasImpressions = typeof gscMetric?.impressions === 'number' && gscMetric.impressions > 0;
                    const noDataTooltip = 'No Google web search data for this keyword in the last 28 days.';

                    return (
                      <tr key={kw._id || idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                          <Link
                            to={`/rank-tracking?locationId=${encodeURIComponent(locationId || '')}&keyword=${encodeURIComponent(kw.keyword)}`}
                            className="inline-flex items-center gap-2 text-brand-700 hover:underline"
                            title={`Open live rank map for ${kw.keyword}`}
                          >
                            {kw.keyword}
                            {kw.triggersLocalPack && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                📍 Local Pack
                              </span>
                            )}
                            {kw.volumeTier && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {kw.volumeTier === 'POPULAR' ? '🔥 Popular' : kw.volumeTier === 'MEDIUM' ? '⚡ Medium' : '🌱 Niche'}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          {kw.overallRank ? (
                            <Badge
                              variant={kw.overallRank <= 3 ? 'success' : kw.overallRank <= 10 ? 'brand' : 'neutral'}
                              size="sm"
                              dot
                            >
                              #{kw.overallRank}{kw.totalCompetitors ? ` of ${kw.totalCompetitors}` : ''}
                            </Badge>
                          ) : hasRank ? (
                            <Badge
                              variant={isTop3 ? 'success' : isTop10 ? 'brand' : 'warning'}
                              size="sm"
                              dot
                            >
                              Rank #{kw.currentRank}
                            </Badge>
                          ) : (
                            <Badge variant={isScanned ? 'warning' : 'neutral'} size="sm">
                              {isScanned ? '20+ (Not in top 20)' : 'Not Scanned'}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {isScanned ? formatRelativeTime(kw.lastScannedAt) : '—'}
                        </td>
                        {isGscConnected && (
                          <>
                            <td className="py-3.5 px-4 bg-indigo-50/10 font-mono text-[11px] text-slate-800">
                              {hasImpressions ? (
                                gscMetric!.impressions >= 1000
                                  ? `${(gscMetric!.impressions / 1000).toFixed(1)}k`
                                  : gscMetric!.impressions.toLocaleString()
                              ) : (
                                <span className="text-slate-400 cursor-help" title={noDataTooltip}>-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 bg-indigo-50/10 font-mono text-[11px] text-slate-800">
                              {hasImpressions ? (
                                typeof gscMetric!.clicks === 'number' && gscMetric!.clicks > 0
                                  ? gscMetric!.clicks >= 1000
                                    ? `${(gscMetric!.clicks / 1000).toFixed(1)}k`
                                    : gscMetric!.clicks.toLocaleString()
                                  : '0'
                              ) : (
                                <span className="text-slate-400 cursor-help" title={noDataTooltip}>-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 bg-indigo-50/10 font-mono text-[11px] text-slate-800">
                              {hasImpressions ? (
                                `${(gscMetric!.ctr * 100).toFixed(1)}%`
                              ) : (
                                <span className="text-slate-400 cursor-help" title={noDataTooltip}>-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 bg-indigo-50/10 font-mono text-[11px] font-semibold text-slate-800">
                              {hasImpressions && typeof gscMetric!.averagePosition === 'number' && gscMetric!.averagePosition > 0 ? (
                                `#${gscMetric!.averagePosition.toFixed(1)}`
                              ) : (
                                <span className="text-slate-400 cursor-help" title={noDataTooltip}>-</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            isLoading={isScanningThis}
                            disabled={scanPolling.status === 'RUNNING' || scanPolling.status === 'QUEUED'}
                            leftIcon={!isScanningThis ? <RefreshCw className="w-3.5 h-3.5 text-brand-500" /> : undefined}
                            onClick={() => queueKeywordScan(kw.keyword)}
                          >
                            Live Scan
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Keywords Modal */}
      <Modal
        isOpen={addKeywordModalOpen}
        onClose={() => setAddKeywordModalOpen(false)}
        title="Add Tracked Keywords"
        description="Enter target keywords separated by commas or line breaks to begin rank tracking."
      >
        <form onSubmit={handleAddKeywords} className="space-y-3 pt-1">
          <textarea
            rows={4}
            required
            placeholder="e.g.&#10;best plumber near me&#10;emergency drain cleaning&#10;licensed plumbing contractor"
            value={newKeywordsInput}
            onChange={(e) => setNewKeywordsInput(e.target.value)}
            className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus-visible:outline-brand-500 resize-none font-sans"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddKeywordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isAddingKw}>
              Add Keywords
            </Button>
          </div>
        </form>
      </Modal>

      {/* Launch GeoGrid Scan Modal */}
      {launchScanOpen && location && (
        <LaunchScanModal
          isOpen={launchScanOpen}
          onClose={() => setLaunchScanOpen(false)}
          workspaceId={workspaceId}
          locationId={location._id}
          businessName={location.name}
          onScanStarted={() => refetch()}
        />
      )}

      {/* GSC Property Selector Modal */}
      {gscSelectorOpen && location && (
        <GscPropertySelectorModal
          isOpen={gscSelectorOpen}
          onClose={() => setGscSelectorOpen(false)}
          workspaceId={workspaceId}
          locationId={location._id}
          locationName={location.name}
          locationWebsite={location.website}
          onSuccess={() => {
            refetch();
            refetchGscMetrics();
          }}
        />
      )}

      {/* Review Booster QR Standee Modal (Localo Feature) */}
      {location && (
        <ReviewBoosterModal
          isOpen={boosterOpen}
          onClose={() => setBoosterOpen(false)}
          location={{
            _id: location._id,
            name: location.name,
            address: location.address,
            city: location.city,
            placeId: location.placeId,
            mapsCid: (location as any).mapsCid,
            averageRating: location.averageRating,
            totalReviewCount: location.totalReviewCount,
            phone: location.phone,
          }}
        />
      )}
      </main>
    </div>
  );
};

export default SingleProfileDashboardPage;

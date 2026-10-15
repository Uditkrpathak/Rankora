import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  useGetOverviewQuery,
  useToggleOptimizationMutation,
  useTogglePinMutation,
  useDeleteLocationMutation,
} from '../../store/api/locationApi';
import { useLazyGetGoogleAuthUrlQuery } from '../../store/api/gbpApi';
import { useRefreshKeywordMutation } from '../../store/api/keywordApi';
import { useGetScanConfigQuery } from '../../store/api/scanApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import { LocationDetailDrawer } from './components/LocationDetailDrawer';
import { useDebounce } from '../../lib/hooks/useDebounce';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  MapPin,
  Plus,
  Trash2,
  Globe,
  Star,
  Pin,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronDown,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  MoreVertical,
  MoreHorizontal,
  SlidersHorizontal,
  Compass,
  AlertCircle,
  HelpCircle,
  X,
  Zap,
  Settings,
} from 'lucide-react';

export const LocationsPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const locationState = useLocation().state as { successMessage?: string; activatedProfileName?: string } | null;
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  // Filter & Search State
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [googleAccountFilter, setGoogleAccountFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastOpened');
  const [showKeywords, setShowKeywords] = useState(true);
  const [page, setPage] = useState(1);

  // Success Banner Toast State
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Selected Profile IDs for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Popovers & Modals State
  const [confirmOptLocId, setConfirmOptLocId] = useState<string | null>(null);
  const [openMenuLocId, setOpenMenuLocId] = useState<string | null>(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [quotaErrorMsg, setQuotaErrorMsg] = useState('');
  const [refreshingKwId, setRefreshingKwId] = useState<string | null>(null);
  const [drawerLocation, setDrawerLocation] = useState<any | null>(null);

  const formatRelativeTime = (dateInput?: string | Date): string => {
    if (!dateInput) return 'Updated recently';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Updated recently';
    const diffSec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 10) return 'Updated just now';
    if (diffSec < 60) return `Updated ${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Updated ${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `Updated ${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    return `Updated ${diffDays}d ago`;
  };

  // Read success message from navigation router state
  useEffect(() => {
    if (locationState?.successMessage) {
      setSuccessToast(locationState.successMessage);
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  // API Queries & Mutations
  const { data: overviewData, isLoading, refetch } = useGetOverviewQuery(
    {
      workspaceId,
      page,
      search: debouncedSearch,
      status: statusFilter,
      googleAccountId: googleAccountFilter,
      tag: tagFilter,
      sortBy,
    },
    { skip: !workspaceId }
  );
  const { data: scanConfigResponse } = useGetScanConfigQuery({ workspaceId }, { skip: !workspaceId });
  const regionalScan = scanConfigResponse?.data.scanShapes.SUNFLOWER;
  const regionalScanCost = regionalScan
    ? `${regionalScan.pointCount} map points`
    : 'a regional scan';

  const [toggleOptimization, { isLoading: isOptToggling }] = useToggleOptimizationMutation();
  const [togglePin] = useTogglePinMutation();
  const [deleteLocation] = useDeleteLocationMutation();
  const [triggerGetAuthUrl] = useLazyGetGoogleAuthUrlQuery();
  const [refreshKeyword, { isLoading: isRefreshingKw }] = useRefreshKeywordMutation();

  const counters = overviewData?.counters || {
    activeProfiles: 0,
    activeProfilesLimit: 30,
    optimizationSlotsUsed: 0,
    optimizationSlotsLimit: 15,
    pinnedCount: 0,
    inactiveCount: 0,
  };

  const locations = overviewData?.locations || [];

  const handleToggleSelect = (locId: string) => {
    setSelectedIds((prev) => (prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === locations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(locations.map((l: any) => l._id));
    }
  };

  const handlePromptOptimization = (e: React.MouseEvent, locId: string, currentEnabled: boolean) => {
    e.stopPropagation();
    if (currentEnabled) {
      // Direct turn off without prompt
      executeToggleOptimization(locId, false);
    } else {
      // Show confirmation popover (Screenshot 4)
      setConfirmOptLocId(locId);
    }
  };

  const executeToggleOptimization = async (locId: string, enabled: boolean) => {
    try {
      setConfirmOptLocId(null);
      await toggleOptimization({
        workspaceId,
        locId,
        enabled,
      }).unwrap();
      refetch();
    } catch (err: any) {
      if (err?.data?.error?.code === 'OPTIMIZATION_SLOTS_EXHAUSTED' || err?.status === 402) {
        setQuotaErrorMsg(
          err?.data?.error?.message ||
            `You have used all ${counters.optimizationSlotsLimit} optimization slots on your plan. Upgrade your plan to activate AI Agent and Protection for more profiles.`
        );
        setQuotaModalOpen(true);
      } else {
        toast.error(err?.data?.error?.message || 'Failed to toggle optimization.');
      }
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, locId: string) => {
    e.stopPropagation();
    try {
      await togglePin({ workspaceId, locId }).unwrap();
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleConnectGoogle = async (e: React.MouseEvent, linkToLocationId?: string) => {
    e.stopPropagation();
    try {
      const res = await triggerGetAuthUrl(
        linkToLocationId ? { workspaceId, linkToLocationId } : workspaceId
      ).unwrap();
      if (res?.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      toast.error(err?.data?.error?.message || 'Failed to initiate Google connection.');
    }
  };

  const handleRefreshSingleKeyword = async (e: React.MouseEvent, locId: string, kwId: string) => {
    e.stopPropagation();
    try {
      setRefreshingKwId(kwId);
      await refreshKeyword({ workspaceId, locationId: locId, keywordId: kwId }).unwrap();
      toast.success('Keyword scan refreshed');
      setTimeout(() => {
        refetch();
        setRefreshingKwId(null);
      }, 1000);
    } catch (err: any) {
      setRefreshingKwId(null);
      toast.error(err?.data?.error?.message || 'Failed to refresh keyword scan.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, locId: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to remove "${name}" from your tracked business profiles?`)) {
      await deleteLocation({ workspaceId, locId }).unwrap();
      setOpenMenuLocId(null);
      refetch();
    }
  };

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar onAddBusiness={() => navigate('/locations/add')} fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="w-full pb-14">
        {/* Top Success Banner Toast (Matching Screenshot 3) */}
        {successToast && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 20px',
              margin: '0 auto 24px',
              maxWidth: '480px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#16a34a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={14} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', flex: 1 }}>
              {successToast}
            </span>
            <button
              onClick={() => setSuccessToast(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Page Title & Add Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              My Business Profiles
            </h1>
          </div>

          <Link
            to="/locations/add"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Business Profile</span>
          </Link>
        </div>

        {/* 1. Plan Counters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* All active */}
          <div className="bg-white rounded-2xl border border-brand-200/80 p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Active Profiles</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200">
                Unlimited
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              {counters.activeProfiles}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Active profiles managed
            </p>
          </div>

          {/* Optimization */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Optimization Shield</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                Auto-Pilot
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              {counters.optimizationSlotsUsed}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Profiles with AI Protection
            </p>
          </div>

          {/* Pinned */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pinned Profiles</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              {counters.pinnedCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Quick access favorites
            </p>
          </div>

          {/* Inactive */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inactive / Paused</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              {counters.inactiveCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Archived locations
            </p>
          </div>
        </div>

        {/* 2. Toolbar & Bulk Selector Row (Matching Screenshot 3) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* Left: Bulk Checkbox + Search + Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1 }}>
            {/* Search Box */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search profiles"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            {/* Tag Dropdown */}
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#334155',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="">Tag</option>
              <option value="agency">Agency</option>
              <option value="retail">Retail</option>
            </select>

            {/* Google Account Dropdown */}
            <select
              value={googleAccountFilter}
              onChange={(e) => setGoogleAccountFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#334155',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="">Google account</option>
            </select>

            {/* Select X Profiles Checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer', marginLeft: '6px' }}>
              <input
                type="checkbox"
                checked={selectedIds.length === locations.length && locations.length > 0}
                onChange={handleSelectAll}
                style={{ borderRadius: '4px', cursor: 'pointer' }}
              />
              <span>Select {locations.length} profiles</span>
            </label>
          </div>

          {/* Right: Sort & Show Keywords Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1e293b',
                  background: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <option value="lastOpened">Last opened</option>
                <option value="rank_asc">Rank (best first)</option>
                <option value="visibility_desc">Visibility %</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="newReviews">New reviews</option>
              </select>
            </div>

            {/* Show Keywords Checkbox (Matching Screenshot 3) */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={showKeywords}
                onChange={(e) => setShowKeywords(e.target.checked)}
                style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span>Show keywords</span>
            </label>
          </div>
        </div>

        {/* 3. Business Profile Cards List (Matching Screenshots 3, 4, 5) */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl shimmer shrink-0" />
                  <div className="space-y-2 flex-1 max-w-md">
                    <div className="h-4 w-44 shimmer rounded-md" />
                    <div className="h-3 w-64 shimmer rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full shimmer" />
                  <div className="w-20 h-7 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : locations.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              border: '2px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <MapPin size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              No business profiles found
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 20px' }}>
              Add a business location to start rank tracking and audits.
            </p>
            <Link
              to="/locations/add"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Plus size={16} />
              Add Business Profile
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {locations.map((loc: any) => {
              const isOptEnabled = Boolean(loc.optimization?.enabled);
              const topKws = loc.topKeywords || [];
              const requiresConnect = Boolean(loc.requiresGoogleConnection || (!loc.googleConnectionId && loc.addedVia === 'places_search'));

              return (
                <div
                  key={loc._id}
                  onClick={() => navigate(`/locations/${loc._id}/profile`)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#93c5fd')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                >
                  {/* Card Header Top Row (Matching Screenshot 3) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    {/* Left: Checkbox + Pin + Image + Name & Address */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                      {/* Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(loc._id)}
                        onChange={() => handleToggleSelect(loc._id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: '4px', cursor: 'pointer', accentColor: '#2563eb' }}
                      />

                      {/* Pin Button */}
                      <button
                        onClick={(e) => handleTogglePin(e, loc._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          color: loc.isPinned ? '#2563eb' : '#cbd5e1',
                          marginTop: '2px',
                        }}
                        title={loc.isPinned ? 'Unpin profile' : 'Pin profile to top'}
                      >
                        <Pin size={16} style={{ fill: loc.isPinned ? '#2563eb' : 'none' }} />
                      </button>

                      {/* Business Image Thumbnail */}
                      <BusinessAvatar
                        name={loc.name}
                        coverPhotoUrl={loc.coverPhotoUrl}
                        logoUrl={loc.logoUrl}
                        website={loc.website}
                        category={loc.primaryCategory?.displayName || loc.categories?.[0]}
                        size="md"
                        className="w-[46px] h-[46px] rounded-xl shadow-2xs"
                      />

                      {/* Business Name & Address */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                          {loc.name}
                        </h2>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {loc.address}, {loc.city}, {loc.state} {loc.postalCode}
                        </p>
                        {loc.googleConnectionId && (
                          <p
                            title={loc.syncError || undefined}
                            style={{
                              fontSize: '11px',
                              color: loc.syncStatus === 'ERROR' ? '#dc2626' : loc.syncStatus === 'PENDING' ? '#b45309' : '#15803d',
                              margin: '0 0 5px',
                            }}
                          >
                            {loc.syncStatus === 'PENDING'
                              ? 'Syncing Google profile…'
                              : loc.syncStatus === 'ERROR'
                                ? `Google sync issue: ${loc.syncError || 'Retry sync'}`
                                : `Google synced${loc.lastSyncedAt ? ` ${new Date(loc.lastSyncedAt).toLocaleString()}` : ''}`}
                          </p>
                        )}

                        {/* Unprotected Red Shield Alert Badge (Screenshot 3) */}
                        {!isOptEnabled && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>
                            <ShieldAlert size={14} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Audit Score Donut + Optimization Switch + More Actions (Matching Real Localo UI) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      {/* Top: Audit Score Donut + More Menu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {loc.auditScore !== null && loc.auditScore !== undefined ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Audit score</span>
                            <div style={{ position: 'relative', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="42" height="42" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                <path
                                  stroke="#f1f5f9"
                                  strokeWidth="3.2"
                                  fill="none"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                  stroke="#f59e0b"
                                  strokeWidth="3.2"
                                  strokeDasharray={`${Math.max(0, Math.min(100, loc.auditScore))}, 100`}
                                  strokeLinecap="round"
                                  fill="none"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                              </svg>
                              <span style={{ position: 'absolute', fontSize: '10.5px', fontWeight: 800, color: '#0f172a' }}>
                                {loc.auditScore}%
                              </span>
                            </div>
                            {typeof loc.auditUnknownCount === 'number' && loc.auditUnknownCount > 0 && (
                              <span style={{ fontSize: '9px', color: '#64748b' }}>{loc.auditUnknownCount} need data</span>
                            )}
                            {loc.auditRulesVersion && loc.auditRulesVersion !== '2026.3' && (
                              <span style={{ fontSize: '9px', color: '#b45309' }}>older rules · rerun</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'right' }}>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Audit score</div>
                              <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '130px', lineHeight: '1.3' }}>
                                Run an audit to calculate a score
                              </div>
                            </div>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                border: '1.5px dashed #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#64748b',
                                fontSize: '13px',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              ?
                            </div>
                          </div>
                        )}

                        {/* More Actions Menu Button */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setOpenMenuLocId(openMenuLocId === loc._id ? null : loc._id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px',
                              cursor: 'pointer',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {openMenuLocId === loc._id && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                width: '170px',
                                background: '#ffffff',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0',
                                padding: '6px',
                                zIndex: 50,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                to={`/rank-tracking?locationId=${loc._id}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  textDecoration: 'none',
                                }}
                              >
                                <Compass size={14} style={{ color: '#2563eb' }} />
                                Geo-Grid Heatmap
                              </Link>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDrawerLocation(loc);
                                  setOpenMenuLocId(null);
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <EyeIcon />
                                Quick Info Drawer
                              </button>

                              <Link
                                to={`/locations/${loc._id}/profile`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  textDecoration: 'none',
                                }}
                              >
                                <Layers size={14} style={{ color: '#2563eb' }} />
                                View Dashboard
                              </Link>

                              <button
                                onClick={(e) => handleDelete(e, loc._id, loc.name)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#dc2626',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <Trash2 size={14} />
                                Delete Profile
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom: Geo-Grid Map Link + Optimization Toggle Switch */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link
                          to={`/rank-tracking?locationId=${loc._id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontSize: '11px',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          <Compass size={13} />
                          <span>View Map</span>
                        </Link>

                        <div style={{ position: 'relative' }}>
                        <div
                          onClick={(e) => handlePromptOptimization(e, loc._id, isOptEnabled)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '3px 6px 3px 10px',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#1e293b' }}>
                            Optimization
                          </span>
                          <div
                            style={{
                              width: '36px',
                              height: '20px',
                              borderRadius: '20px',
                              background: isOptEnabled ? '#2563eb' : '#cbd5e1',
                              position: 'relative',
                              transition: 'background 0.2s',
                            }}
                          >
                            <div
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: '#ffffff',
                                position: 'absolute',
                                top: '2px',
                                left: isOptEnabled ? '18px' : '2px',
                                transition: 'left 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              }}
                            />
                          </div>
                        </div>

                        {/* Optimization Confirmation Popover (Matching Screenshot 4) */}
                        {confirmOptLocId === loc._id && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 10px)',
                              right: 0,
                              width: '320px',
                              background: '#ffffff',
                              borderRadius: '16px',
                              padding: '18px 20px',
                              boxShadow: '0 15px 35px -5px rgba(0,0,0,0.15), 0 5px 15px rgba(0,0,0,0.06)',
                              border: '1px solid #e2e8f0',
                              zIndex: 60,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '16px' }}>⚠️</span>
                              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                Turn on optimization features?
                              </h3>
                            </div>

                            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px' }}>
                              Optimization gives you access to additional features. One profile uses one optimization seat.
                              You can always turn off optimization and use this seat on another account in the new billing cycle.
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                              <button
                                onClick={() => setConfirmOptLocId(null)}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#475569',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => executeToggleOptimization(loc._id, true)}
                                style={{
                                  padding: '7px 16px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: '#2563eb',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                }}
                              >
                                Turn on
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Yellow Google Account Connection Warning Banner hidden */}
                  {false && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: '#fefce8',
                        border: '1px solid #fef08a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#854d0e', fontWeight: 600 }}>
                        <span>⚠️</span>
                        <span>Link to the Google Account that manages this Business Profile to unlock all features.</span>
                      </div>

                      <button
                        onClick={(e) => handleConnectGoogle(e, loc._id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#1e293b',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <span style={{ color: '#4285F4', fontWeight: 900 }}>G</span>
                        <span>Connect with Google</span>
                      </button>
                    </div>
                  )}

                  {/* Inline Keywords Accordion (Matching Screenshot 5) */}
                  {showKeywords && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Keywords</span>
                        <Link
                          to={`/locations/${loc._id}/profile`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Settings size={13} />
                          <span>Manage</span>
                        </Link>
                      </div>

                      {topKws.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                          No tracked keywords yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Opening an unscanned keyword starts {regionalScanCost}. Saved recent maps reopen without a scan.
                          </div>
                          {topKws.map((kw: any, idx: number) => {
                            const hasRank = kw.currentRank !== null && kw.currentRank !== undefined;
                            const isRankedInTop20 = hasRank && kw.currentRank > 0 && kw.currentRank <= 20;
                            const kwRank = isRankedInTop20 ? `Rank ${kw.currentRank}` : hasRank ? '20+' : '--';
                            const badgeBg = !hasRank ? '#f1f5f9' : isRankedInTop20 && kw.currentRank <= 3 ? '#dcfce7' : isRankedInTop20 && kw.currentRank <= 10 ? '#fef3c7' : '#fee2e2';
                            const badgeColor = !hasRank ? '#94a3b8' : isRankedInTop20 && kw.currentRank <= 3 ? '#15803d' : isRankedInTop20 && kw.currentRank <= 10 ? '#b45309' : '#b91c1c';
                            const kwVis = hasRank ? `${Math.round(kw.visibilityScore || 0)}%` : '—';

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: '#f8fafc',
                                  fontSize: '13px',
                                }}
                              >
                                {/* Keyword Text */}
                                <Link
                                  to={`/rank-tracking?locationId=${encodeURIComponent(loc._id)}&keyword=${encodeURIComponent(kw.keyword)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`Open saved map or start ${regionalScanCost} for ${kw.keyword}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1d4ed8', whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer' }}
                                >
                                  {kw.keyword}
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb' }}>View map ↗</span>
                                  {hasRank && (
                                    <span title={`Latest scan provider: ${kw.lastProvider}`} style={{ padding: '2px 5px', borderRadius: '5px', background: '#e2e8f0', color: '#475569', fontSize: '9px', fontWeight: 700 }}>
                                      {kw.lastProvider}
                                    </span>
                                  )}
                                </Link>

                                {/* Dashed Connector Line */}
                                <div style={{ flex: 1, borderBottom: '1px dashed #cbd5e1', margin: '0 16px', minWidth: '40px' }} />

                                {/* Metric Badges & Refresh Icon (Matching Real Localo UI) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                  {/* Rank Pill Badge */}
                                  <span
                                    style={{
                                      padding: '3px 10px',
                                      borderRadius: '12px',
                                      background: badgeBg,
                                      color: badgeColor,
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      minWidth: '60px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {kwRank}
                                  </span>

                                  {/* Visibility Gauge with Target Focus Eye Icon */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '110px' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                                      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                                      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                                      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                                      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                                      <circle cx="12" cy="12" r="2.5" />
                                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                    </svg>
                                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                                      <div style={{ width: hasRank ? kwVis : '0%', height: '100%', background: hasRank && kw.visibilityScore > 0 ? '#16a34a' : '#cbd5e1', borderRadius: '3px' }} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: hasRank && kw.visibilityScore > 0 ? '#16a34a' : '#94a3b8', minWidth: '28px', textAlign: 'right' }}>
                                      {kwVis}
                                    </span>
                                  </div>

                                  {/* Stacked Relative Time + Refresh Button */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '95px', justifyContent: 'flex-end' }}>
                                    <div style={{ textAlign: 'right', lineHeight: '1.2' }}>
                                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Updated</div>
                                      <div
                                        title={kw.lastScanError || undefined}
                                        style={{ fontSize: '11px', color: kw.lastScanStatus === 'FAILED' || kw.lastScanError ? '#be123c' : '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}
                                      >
                                        {kw.lastScanStatus === 'QUEUED' ? 'Queued' : kw.lastScanStatus === 'RUNNING' ? 'Scanning…' : kw.lastScanStatus === 'FAILED' || kw.lastScanError ? 'Scan failed' : kw.lastScannedAt && hasRank ? formatRelativeTime(kw.lastScannedAt).replace('Updated ', '') : 'Open map to scan'}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => handleRefreshSingleKeyword(e, loc._id, kw._id)}
                                      disabled={refreshingKwId === kw._id}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: refreshingKwId === kw._id ? '#2563eb' : '#94a3b8', padding: '2px' }}
                                      title="Run rank scan with the configured provider"
                                      >
                                        <RefreshCw
                                          size={12}
                                        style={{
                                          animation: refreshingKwId === kw._id ? 'spin 1s linear infinite' : undefined,
                                        }}
                                      />
                                      </button>
                                      <Link
                                        to={`/rank-tracking?locationId=${encodeURIComponent(loc._id)}&keyword=${encodeURIComponent(kw.keyword)}`}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ padding: '4px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'none' }}
                                        title={`Open saved map or start ${regionalScanCost} for ${kw.keyword}`}
                                      >
                                        Open map
                                      </Link>
                                    </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Quota Modal */}
        <Modal
          isOpen={quotaModalOpen}
          onClose={() => setQuotaModalOpen(false)}
          title="Optimization Limit Reached"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {quotaErrorMsg}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuotaModalOpen(false)}
              >
                Close
              </Button>
              <Link to="/settings/plans">
                <Button
                  variant="primary"
                  size="sm"
                >
                  Upgrade Plan
                </Button>
              </Link>
            </div>
          </div>
        </Modal>

        {/* Location Detail Drawer (Option A) */}
        <LocationDetailDrawer
          location={drawerLocation}
          isOpen={Boolean(drawerLocation)}
          onClose={() => setDrawerLocation(null)}
          workspaceId={workspaceId}
        />
      </div>
      </main>
    </div>
  );
};

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default LocationsPage;

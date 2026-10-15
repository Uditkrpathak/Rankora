import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  Star,
  RefreshCw,
  Clock,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Image as ImageIcon,
  Compass,
  Layers,
  Award,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Location } from '../../../store/api/locationApi';
import { useSyncLocationMutation } from '../../../store/api/gbpApi';
import { BusinessAvatar } from '../../../components/ui/BusinessAvatar';

interface LocationDetailDrawerProps {
  location: (Location & {
    isPinned?: boolean;
    tags?: string[];
    optimization?: { enabled: boolean; enabledAt?: string; protectionWatchdog?: boolean };
    cachedKpis?: {
      visibilityScore: number;
      averagePosition: number;
      profileViewsThisMonth: number;
      profileViewsDelta: number;
      totalReviews: number;
      averageRating: number;
      newReviewsCount: number;
      areaDifficulty?: string;
    };
    topKeywords?: Array<{
      _id: string;
      keyword: string;
      currentRank: number | null;
      visibilityScore: number;
    }>;
  }) | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export const LocationDetailDrawer: React.FC<LocationDetailDrawerProps> = ({
  location,
  isOpen,
  onClose,
  workspaceId,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'hours' | 'attributes'>('overview');
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);
  const [syncLocationMutation, { isLoading: isSyncing }] = useSyncLocationMutation();

  if (!isOpen || !location) return null;

  const handleSyncNow = async () => {
    try {
      setSyncSuccessToast(null);
      await syncLocationMutation({
        workspaceId,
        locId: location._id,
      }).unwrap();
      setSyncSuccessToast('Location profile synchronized with Google.');
      setTimeout(() => setSyncSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to sync location:', err);
    }
  };

  // Calculate profile completeness score
  const completenessChecks = [
    Boolean(location.name),
    Boolean(location.address),
    Boolean(location.phone),
    Boolean(location.website),
    Boolean(location.categories && location.categories.length > 0),
    Boolean(location.regularHours && Object.keys(location.regularHours).length > 0),
    Boolean(location.coverPhotoUrl || location.logoUrl),
    Boolean(location.ownershipVerified),
  ];
  const completedCount = completenessChecks.filter(Boolean).length;
  const completionPct = Math.round((completedCount / completenessChecks.length) * 100);

  const formatRelativeTime = (dateInput?: string | Date | null): string => {
    if (!dateInput) return 'Never synced';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recently';
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-300">
        
        {/* Cover Photo / Header Banner */}
        <div className="relative h-44 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 shrink-0 overflow-hidden">
          {location.coverPhotoUrl ? (
            <img
              src={location.coverPhotoUrl}
              alt={location.name}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/90 hover:bg-black/60 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            aria-label="Close details"
          >
            <X size={18} />
          </button>

          {/* Sync Badge overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {location.ownershipVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-md shadow-xs">
                <ShieldCheck size={13} />
                <span>GBP Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/90 text-white backdrop-blur-md shadow-xs">
                <ShieldAlert size={13} />
                <span>Places Search Profile</span>
              </span>
            )}

            {location.syncStatus === 'SYNCED' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/90 text-white backdrop-blur-md">
                <CheckCircle2 size={12} />
                <span>Synced</span>
              </span>
            )}
          </div>
        </div>

        {/* Business Header Strip */}
        <div className="px-6 pt-0 pb-4 border-b border-slate-100 relative bg-white shrink-0">
          <div className="flex items-start justify-between gap-4 -mt-10">
            <BusinessAvatar
              name={location.name}
              logoUrl={location.logoUrl}
              coverPhotoUrl={location.coverPhotoUrl}
              category={location.primaryCategory?.displayName || location.categories?.[0]}
              website={location.website}
              size="xl"
              className="w-20 h-20 rounded-2xl shadow-lg ring-4 ring-white shrink-0"
            />

            <div className="pt-12 flex items-center gap-2">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-all border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              {location.name}
            </h2>

            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-600">
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {location.primaryCategory?.displayName || location.categories?.[0] || 'Local Business'}
              </span>

              {location.averageRating !== null && location.averageRating !== undefined && (
                <div className="flex items-center gap-1 font-semibold text-slate-800">
                  <Star size={13} className="text-amber-500 fill-amber-500" />
                  <span>{location.averageRating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">
                    ({location.totalReviewCount || 0} reviews)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Toast Alert */}
          {syncSuccessToast && (
            <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>{syncSuccessToast}</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview & KPIs
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'hours'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Business Hours
          </button>
          <button
            onClick={() => setActiveTab('attributes')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'attributes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Google Metadata
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Profile Completeness Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-700">GBP Profile Health</span>
                  <span className="font-extrabold text-blue-600">{completionPct}% Completed</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completionPct >= 80
                        ? 'bg-emerald-500'
                        : completionPct >= 50
                        ? 'bg-blue-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{completedCount} of {completenessChecks.length} attributes configured</span>
                  <span>Last synced: {formatRelativeTime(location.lastSyncedAt || location.updatedAt)}</span>
                </div>
              </div>

              {/* KPI Grid */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Local SEO Performance KPIs
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">Share of Local Voice</span>
                    <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {location.cachedKpis?.visibilityScore !== undefined
                        ? `${location.cachedKpis.visibilityScore.toFixed(0)}%`
                        : '—'}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                      <TrendingUp size={11} />
                      <span>Search Visibility</span>
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">Average Rank (ATRP)</span>
                    <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {location.cachedKpis?.averagePosition
                        ? `#${location.cachedKpis.averagePosition.toFixed(1)}`
                        : '—'}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                      Across tracked grid
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">Customer Reviews</span>
                    <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {location.totalReviewCount ?? 0}
                    </div>
                    <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                      <Star size={11} className="fill-amber-500 text-amber-500" />
                      <span>{location.averageRating?.toFixed(1) || '0.0'} Avg Rating</span>
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">Area Difficulty</span>
                    <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {location.cachedKpis?.areaDifficulty || 'LOW'}
                    </div>
                    <span className="text-[11px] text-blue-600 font-medium mt-0.5 block">
                      Competitor Density
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact & NAP Info */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  NAP & Contact Details
                </h3>
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-start gap-3 text-slate-700">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900">Address</div>
                      <div>{location.address}, {location.city}, {location.state} {location.postalCode}</div>
                      {location.placeId && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}&query_place_id=${location.placeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline mt-1"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>

                  {location.phone && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Phone size={15} className="text-slate-400 shrink-0" />
                      <div>
                        <span className="text-slate-500 mr-2">Phone:</span>
                        <a href={`tel:${location.phone}`} className="font-semibold text-slate-900 hover:text-blue-600">
                          {location.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {location.website && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Globe size={15} className="text-slate-400 shrink-0" />
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-slate-500 mr-2">Website:</span>
                        <a
                          href={location.website.startsWith('http') ? location.website : `https://${location.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {location.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Navigation Cards */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/rank-tracking?locId=${location._id}`);
                  }}
                  className="w-full p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 hover:from-blue-100 hover:to-indigo-100 rounded-xl border border-blue-200 text-left flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <Compass size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Launch Geo-Grid Heatmap</div>
                      <div className="text-[11px] text-slate-600">View 31-pin local rankings on Google Maps</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    onClose();
                    navigate(`/audits?locId=${location._id}`);
                  }}
                  className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Run 17-Point SEO Audit</div>
                      <div className="text-[11px] text-slate-600">Actionable recommendations & AI fix drafts</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </>
          )}

          {activeTab === 'hours' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Operating Schedule
              </h3>
              {location.regularHours && Object.keys(location.regularHours).length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {Object.entries(location.regularHours).map(([day, periods]: [string, any]) => (
                    <div key={day} className="p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-800 capitalize">{day}</span>
                      <span className="text-slate-600">
                        {periods?.openTime && periods?.closeTime
                          ? `${periods.openTime} – ${periods.closeTime}`
                          : periods?.isClosed
                          ? 'Closed'
                          : 'Open 24 Hours'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <Clock size={24} className="mx-auto text-slate-400 mb-2" />
                  <div>No business hours configured on this profile yet.</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attributes' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Categories & Taxonomy
              </h3>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <span className="text-slate-500">Primary Category:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {location.primaryCategory?.displayName || location.categories?.[0] || 'None'}
                  </div>
                </div>

                {location.secondaryCategories && location.secondaryCategories.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Secondary Categories:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {location.secondaryCategories.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium">
                          {c.displayName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">
                Technical Identifiers
              </h3>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono text-[11px] text-slate-600">
                <div><span className="text-slate-400 select-none">ID: </span>{location._id}</div>
                {location.placeId && <div><span className="text-slate-400 select-none">Google Place ID: </span>{location.placeId}</div>}
                {location.gbpLocationId && <div><span className="text-slate-400 select-none">GBP Location ID: </span>{location.gbpLocationId}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

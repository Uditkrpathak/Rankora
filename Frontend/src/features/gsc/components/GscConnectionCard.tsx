import React, { useState, useEffect } from 'react';
import { useToast } from '../../../components/ui/Toast';
import {
  useGetGscAuthUrlQuery,
  useSyncGscLocationMutation,
  useGetGscSitesQuery,
} from '../../../store/api/gscApi';
import { Location } from '../../../store/api/locationApi';
import { GscPropertySelectorModal } from './GscPropertySelectorModal';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Globe,
  Clock,
  ArrowRight,
  Settings,
} from 'lucide-react';

interface GscConnectionCardProps {
  workspaceId: string;
  location?: Location | null;
  onLocationUpdated?: () => void;
  className?: string;
}

export const GscConnectionCard: React.FC<GscConnectionCardProps> = ({
  workspaceId,
  location,
  onLocationUpdated,
  className = '',
}) => {
  const toast = useToast();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const { data: authData, isLoading: isAuthLoading } = useGetGscAuthUrlQuery(
    { workspaceId, linkToLocationId: location?._id },
    { skip: !workspaceId }
  );

  const { data: sites = [], isSuccess: hasSites } = useGetGscSitesQuery(workspaceId, {
    skip: !workspaceId,
  });

  const [syncLocation, { isLoading: isSyncing }] = useSyncGscLocationMutation();

  const connectionStatus = location?.gscConnectionStatus || 'none';
  const siteUrl = location?.gscSiteUrl;
  const lastSyncedAt = location?.gscLastSyncedAt;

  // Initialize countdown if last synced was less than 15 minutes ago
  useEffect(() => {
    if (!lastSyncedAt) return;
    const syncedTime = new Date(lastSyncedAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - syncedTime) / 1000);
    const remaining = 15 * 60 - elapsedSeconds;
    if (remaining > 0) {
      setCooldownSeconds(remaining);
    }
  }, [lastSyncedAt]);

  // Cooldown countdown tick
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const formatCooldown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${rem < 10 ? '0' : ''}${rem}s`;
  };

  const formatRelativeTime = (dateInput?: string | null) => {
    if (!dateInput) return 'Never synced';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Never synced';
    const diffSec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    return `${diffDays}d ago`;
  };

  const handleConnectClick = () => {
    // If sites are already accessible (Google account already linked), open selector directly
    if (hasSites && sites.length > 0 && location) {
      setSelectorOpen(true);
      return;
    }
    const authUrl = authData?.authUrl;
    if (authUrl) {
      window.location.href = authUrl;
    } else {
      toast.error('Unable to initialize Google authorization. Please try again.');
    }
  };

  const handleSyncNow = async () => {
    if (!location || isSyncing || cooldownSeconds > 0) return;

    try {
      await syncLocation({
        workspaceId,
        locId: location._id,
      }).unwrap();

      toast.success('Search Console data synchronization queued.');
      setCooldownSeconds(15 * 60); // 15-minute rate limit
      onLocationUpdated?.();
    } catch (err: any) {
      if (err?.status === 429 || err?.data?.error?.code === 'GSC_SYNC_RATE_LIMITED') {
        toast.warning(err?.data?.error?.message || 'Manual sync is rate-limited to once every 15 minutes.');
        setCooldownSeconds(15 * 60);
      } else {
        toast.error(err?.data?.error?.message || 'Failed to trigger Search Console synchronization.');
      }
    }
  };

  return (
    <>
      <div className={`bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6 ${className}`}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                  fill="#4285F4"
                />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900">Google Search Console</h3>

                {connectionStatus === 'connected' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    Connected
                  </span>
                )}

                {connectionStatus === 'needs_reauth' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle size={12} className="text-amber-600" />
                    Needs Reconnect
                  </span>
                )}

                {connectionStatus === 'none' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    Not Connected
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {connectionStatus === 'connected'
                  ? `Monitoring organic search visibility for ${siteUrl || 'connected property'}.`
                  : 'Track organic Google web search impressions, search clicks, and high-opportunity ranking keywords.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="self-start sm:self-auto flex items-center gap-2.5 flex-wrap">
            {connectionStatus === 'connected' && location && (
              <>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing || cooldownSeconds > 0}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-brand-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing
                      ? 'Syncing...'
                      : cooldownSeconds > 0
                      ? `Sync now (${formatCooldown(cooldownSeconds)})`
                      : 'Sync now'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectorOpen(true)}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition"
                  title="Change connected Search Console property"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {connectionStatus === 'needs_reauth' && (
              <button
                type="button"
                onClick={handleConnectClick}
                disabled={isAuthLoading}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAuthLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span>Reconnect Search Console</span>
              </button>
            )}

            {connectionStatus === 'none' && (
              <button
                type="button"
                onClick={handleConnectClick}
                disabled={isAuthLoading}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                {isAuthLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Globe size={16} className="text-brand-400" />
                )}
                <span>Connect Google Search Console</span>
              </button>
            )}
          </div>
        </div>

        {/* Reauth Warning Banner */}
        {connectionStatus === 'needs_reauth' && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-bold">Google authorization expired or was revoked</p>
              <p className="text-amber-800 leading-relaxed">
                Google access token refresh failed. Reconnect your Google account to resume automatic keyword discovery and search query synchronization.
              </p>
            </div>
            <button
              onClick={handleConnectClick}
              className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-amber-900 font-bold hover:bg-amber-100/60 transition shrink-0"
            >
              Reconnect now
            </button>
          </div>
        )}

        {/* Connected Property Details */}
        {connectionStatus === 'connected' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Connected Property
              </span>
              {siteUrl ? (
                <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs">{siteUrl}</span>
                  {siteUrl.startsWith('sc-domain:') ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Domain
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      URL prefix
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-slate-500 font-medium">No Search Console property linked yet</span>
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(true)}
                    className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                  >
                    Select Property
                  </button>
                </div>
              )}
            </div>

            {siteUrl && (
              <div className="flex items-center gap-4 text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last synced: {formatRelativeTime(lastSyncedAt)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Organic Web Impressions
            </div>
            <p className="text-[11px] text-slate-500">
              Measures how often your site appears in Google organic web search.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Striking Distance Opportunities
            </div>
            <p className="text-[11px] text-slate-500">
              Highlights keywords ranking #8–20 with high impressions to push to page 1.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Impression-Weighted Positions
            </div>
            <p className="text-[11px] text-slate-500">
              Accurate ranking math that avoids naive average distortions.
            </p>
          </div>
        </div>

        {/* Security & Data Scope Note */}
        <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span>
            Uses read-only Google Webmasters scope. Measures organic web search independently of Google Maps rankings.
          </span>
        </div>
      </div>

      {/* Property Selector Modal */}
      {location && (
        <GscPropertySelectorModal
          isOpen={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          workspaceId={workspaceId}
          locationId={location._id}
          locationName={location.name}
          locationWebsite={location.website}
          currentSiteUrl={siteUrl}
          onSuccess={() => onLocationUpdated?.()}
        />
      )}
    </>
  );
};

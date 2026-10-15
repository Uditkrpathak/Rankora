import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import { useGetGoogleAuthUrlQuery, useGetGoogleStatusQuery, useDisconnectGoogleMutation } from '../../store/api/gbpApi';
import { useListLocationsQuery, Location } from '../../store/api/locationApi';
import { GscConnectionCard } from '../gsc/components/GscConnectionCard';
import { CheckCircle2, AlertCircle, RefreshCw, ExternalLink, ShieldCheck, Loader2, Link2, Sparkles, Check } from 'lucide-react';

export const ConnectedAccountsPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const { data: locationsData, refetch: refetchLocations } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId }
  );
  const locations: Location[] = locationsData?.locations || [];
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const targetLocation = locations.find((l: Location) => l._id === selectedLocationId) || locations[0] || null;

  const { data: authData, isLoading: isAuthLoading } = useGetGoogleAuthUrlQuery(workspaceId, { skip: !workspaceId });
  const { data: connData, isLoading: isConnLoading, refetch } = useGetGoogleStatusQuery(workspaceId, { skip: !workspaceId });
  const [disconnectGoogle, { isLoading: isDisconnecting }] = useDisconnectGoogleMutation();
  const [disconnectError, setDisconnectError] = useState('');

  const isConnected = connData?.isConnected || activeWorkspace?.gbpConnectionStatus === 'connected';

  const handleConnect = () => {
    const authUrl = authData?.authUrl;
    if (authUrl) {
      sessionStorage.setItem('oauth_source', 'gbp');
      sessionStorage.setItem('oauth_return_url', '/settings/connections');
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Business Profile account? Auto-sync will stop.')) return;
    try {
      setDisconnectError('');
      await disconnectGoogle({ workspaceId }).unwrap();
      refetch();
    } catch (err: any) {
      setDisconnectError(err?.data?.error?.message || err?.data?.message || 'Failed to disconnect');
    }
  };

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Connected Accounts
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Connect Google Business Profile to enable automatic profile sync, location health checks, and rank tracking.
            </p>
          </div>
        </div>

        {disconnectError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold shadow-2xs">
            {disconnectError}
          </div>
        )}

        {/* Google Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900">
                    Google Business Profile API
                  </h3>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      Live Connection Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  {isConnected
                    ? `Connected as ${connData?.googleEmail || 'Google Account'}. Direct sync with Google Maps & Search active.`
                    : 'Link your Google account to discover and sync your business locations, post updates, and respond to reviews.'}
                </p>
              </div>
            </div>

            <div className="self-start sm:self-auto">
              {isConnected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDisconnecting && <Loader2 size={14} className="animate-spin" />}
                  <span>Disconnect Account</span>
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isAuthLoading || !authData?.authUrl}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Connect Google Account</span>
                </button>
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Automatic Review Sync
              </div>
              <p className="text-[11px] text-slate-500">Pulls customer reviews and star ratings directly from Google.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                1-Click Review Replies
              </div>
              <p className="text-[11px] text-slate-500">Post verified business responses straight to Google Maps.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Listing Protection Watchdog
              </div>
              <p className="text-[11px] text-slate-500">Detects unauthorized third-party edits to your phone, hours, and NAP.</p>
            </div>
          </div>

          {/* Security notice */}
          <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>OAuth tokens are encrypted at rest with AES-256-GCM in high-security hardware vaults.</span>
          </div>
        </div>

        {/* Location Selector for Search Console if multiple locations */}
        {locations.length > 1 && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <span className="font-bold text-slate-700">Managing Search Console property for:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {locations.map((loc: Location) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} {loc.city ? `(${loc.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Google Search Console Card */}
        <GscConnectionCard
          workspaceId={workspaceId}
          location={targetLocation}
          onLocationUpdated={() => refetchLocations()}
        />
      </div>
    </SettingsLayout>
  );
};

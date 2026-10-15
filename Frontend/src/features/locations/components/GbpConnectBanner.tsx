import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import {
  useGetGoogleStatusQuery,
  useLazyGetGoogleAuthUrlQuery,
  useDisconnectGoogleMutation,
} from '../../../store/api/gbpApi';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface GbpConnectBannerProps {
  onOpenImport: () => void;
}

export const GbpConnectBanner: React.FC<GbpConnectBannerProps> = ({ onOpenImport }) => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const canManage = activeWorkspace?.role === 'owner' || activeWorkspace?.role === 'admin';

  const { data: statusData, isLoading, isFetching, refetch } = useGetGoogleStatusQuery(workspaceId, {
    skip: !workspaceId,
  });

  const [triggerGetAuthUrl, { isFetching: isGettingUrl }] = useLazyGetGoogleAuthUrlQuery();
  const [disconnectGoogle, { isLoading: isDisconnecting }] = useDisconnectGoogleMutation();

  const [actionError, setActionError] = useState<string | null>(null);

  const handleConnect = async () => {
    setActionError(null);
    try {
      const res = await triggerGetAuthUrl(workspaceId).unwrap();
      const authUrl = (res as any)?.authUrl || (res as any)?.data?.authUrl;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        setActionError('Failed to obtain Google authentication URL. Please verify server configuration.');
      }
    } catch (err: any) {
      setActionError(err?.data?.error?.message || err?.message || 'Failed to initiate Google authentication. Please try again.');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Business Profile? Synced locations will remain as standalone entries.')) {
      return;
    }
    setActionError(null);
    try {
      await disconnectGoogle({ workspaceId }).unwrap();
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Failed to disconnect Google account.');
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#64748b',
          fontSize: '13px',
        }}
      >
        <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite', color: '#4f46e5' }} />
        <span>Checking Google Business Profile status...</span>
      </div>
    );
  }

  const isConnected = statusData?.isConnected;
  const status = statusData?.status;
  const googleEmail = statusData?.googleEmail;
  const isRevoked = status === 'REVOKED' || status === 'EXPIRED';

  return (
    <div
      style={{
        background: isRevoked
          ? '#fff5f5'
          : isConnected
          ? '#ffffff'
          : '#ffffff',
        border: `1px solid ${
          isRevoked
            ? '#fecaca'
            : isConnected
            ? '#bbf7d0'
            : '#e2e8f0'
        }`,
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        {/* Left: Info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isRevoked
                ? '#fee2e2'
                : isConnected
                ? '#f0fdf4'
                : '#eef2ff',
              border: `1px solid ${
                isRevoked
                  ? '#fecaca'
                  : isConnected
                  ? '#bbf7d0'
                  : '#c7d2fe'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isRevoked ? (
              <AlertTriangle size={20} style={{ color: '#e11d48' }} />
            ) : isConnected ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
            ) : (
              <Globe size={20} style={{ color: '#4f46e5' }} />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                Google Business Profile
              </span>
              {isConnected && !isRevoked ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#16a34a',
                    }}
                  />
                  CONNECTED
                </span>
              ) : isRevoked ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                  }}
                >
                  RECONNECT REQUIRED
                </span>
              ) : null}
            </div>

            <p style={{ margin: 0, color: '#64748b', fontSize: '13px', lineHeight: '1.4' }}>
              {isRevoked
                ? 'Google authorization was revoked or expired. Reconnect now to restore automatic location syncing.'
                : isConnected
                ? `Connected as ${googleEmail || 'Google Account'}. Discovered locations can be imported and kept in sync automatically.`
                : 'Connect your Google Business Profile to import listings in 1 click and keep address, categories, and metrics automatically synced.'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isConnected && !isRevoked ? (
            <>
              <button
                id="import-gbp-locations-btn"
                onClick={onOpenImport}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '9px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Download size={14} />
                Import Locations
              </button>

              {canManage && (
                <button
                  id="disconnect-gbp-btn"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 14px',
                    borderRadius: '9px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isDisconnecting ? (
                    <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <LogOut size={14} />
                  )}
                  Disconnect
                </button>
              )}
            </>
          ) : (
            <button
              id="connect-gbp-btn"
              onClick={handleConnect}
              disabled={isGettingUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isGettingUrl ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
              }}
            >
              {isGettingUrl ? (
                <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite', color: '#4f46e5' }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
              )}
              {isRevoked ? 'Reconnect Google Account' : 'Connect Google Business'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px' }}>
          {actionError}
        </div>
      )}
    </div>
  );
};

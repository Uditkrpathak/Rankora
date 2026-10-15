import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useConnectGoogleMutation } from '../../store/api/gbpApi';
import { useToast } from '../../components/ui/Toast';
import { CheckCircle2, AlertTriangle, Loader2, ArrowLeft, Globe } from 'lucide-react';

export const GbpCallbackPage: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const [connectGoogle] = useConnectGoogleMutation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      const msg =
        errorParam === 'access_denied'
          ? 'Google authorization was denied or cancelled.'
          : `Google OAuth Error: ${errorParam}`;
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      const msg = 'Missing OAuth authorization code or state from Google redirect.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!workspaceId) {
      // Waiting for workspace state to be ready
      return;
    }

    let isMounted = true;

    async function handleExchange() {
      try {
        await connectGoogle({
          workspaceId: workspaceId!,
          code: code!,
          state: state!,
        }).unwrap();

        if (isMounted) {
          setStatus('success');
          const source = sessionStorage.getItem('oauth_source');
          const returnUrl = sessionStorage.getItem('oauth_return_url');
          sessionStorage.removeItem('oauth_source');
          sessionStorage.removeItem('oauth_return_url');

          if (source === 'gsc') {
            toast.success('Google Search Console connected successfully!');
          } else {
            toast.success('Google Account connected successfully!');
          }

          setTimeout(() => {
            navigate(returnUrl || (source === 'gsc' ? '/settings/connections' : '/locations'), { replace: true });
          }, 1200);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          const errCode = err?.data?.error?.code;
          let msg = err?.data?.error?.message || 'Failed to complete Google authorization.';
          if (errCode === 'INVALID_STATE') {
            msg = 'Security validation failed: Invalid or expired OAuth state token. Please try connecting again.';
          } else if (errCode === 'STATE_REPLAY_DETECTED') {
            msg = 'Security alert: This authorization request has already been processed.';
          }
          setErrorMessage(msg);
          toast.error(msg);
        }
      }
    }

    handleExchange();

    return () => {
      isMounted = false;
    };
  }, [code, state, errorParam, workspaceId, connectGoogle, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '40px 36px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        }}
      >
        {status === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loader2 size={30} style={{ color: '#4f46e5', animation: 'spin 0.7s linear infinite' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>
                Connecting to Google...
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Verifying authorization credentials and securing your Google Business Profile connection.
              </p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>
                Google Connected Successfully!
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Redirecting you back to your Locations management dashboard...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={32} style={{ color: '#dc2626' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
                Connection Failed
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {errorMessage}
              </p>
            </div>
            <button
              onClick={() => navigate('/locations', { replace: true })}
              style={{
                marginTop: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                background: '#4f46e5',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
              }}
            >
              <ArrowLeft size={15} />
              Return to Locations
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default GbpCallbackPage;

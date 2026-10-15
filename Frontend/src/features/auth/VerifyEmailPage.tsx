import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateUserVerified } from '../../store/slices/authSlice';
import { AuthLayout } from './AuthLayout';
import {
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useGetPublicConfigQuery,
  useDevVerifyNowMutation
} from '../../store/api/authApi';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Mail,
  ExternalLink,
  Sparkles,
  Zap
} from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const token = searchParams.get('token');

  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { data: configData } = useGetPublicConfigQuery();
  const devVerifyBypassEnabled = Boolean(configData?.data?.devVerifyBypassEnabled);

  const [verifyEmail, { isLoading, isSuccess, isError, error }] = useVerifyEmailMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();
  const [devVerifyNow, { isLoading: isBypassing }] = useDevVerifyNowMutation();

  const [resendEmail, setResendEmail] = useState(user?.email || '');
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [devBypassError, setDevBypassError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      verifyEmail({ token })
        .unwrap()
        .then(() => {
          dispatch(updateUserVerified());
        })
        .catch(() => {});
    }
  }, [token, verifyEmail, dispatch]);

  // If already authenticated and email is verified, bypass this page
  if (isAuthenticated && user?.isEmailVerified && user?.status === 'ACTIVE' && !token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDevBypass = async () => {
    setDevBypassError(null);
    try {
      await devVerifyNow().unwrap();
      dispatch(updateUserVerified());
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorObj = err as { data?: { error?: { message?: string } } };
      setDevBypassError(errorObj?.data?.error?.message || 'Failed to bypass verification.');
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendSent(false);

    const emailToUse = resendEmail.trim() || user?.email || '';
    if (!emailToUse) {
      setResendError('Please enter your account email address.');
      return;
    }

    try {
      await resendVerification({ email: emailToUse }).unwrap();
      setResendSent(true);
    } catch (err: any) {
      setResendError(err?.data?.error?.message || 'Failed to send verification email. Please try again.');
    }
  };

  return (
    <AuthLayout
      title={token ? 'Email Verification' : 'Verify Your Email'}
      subtitle={
        token
          ? 'Activating your workspace and setting up your account.'
          : 'Activate your workspace to start auditing local search rankings.'
      }
    >
      {/* 1. Loading verification */}
      {isLoading && (
        <div className="text-center py-8">
          <RefreshCw className="w-9 h-9 text-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-900">Verifying your email token...</p>
          <p className="text-xs text-slate-500 mt-1">Setting up your Rankora workspace</p>
        </div>
      )}

      {/* 2. Success state */}
      {isSuccess && (
        <div className="text-center py-6 space-y-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Email Verified Successfully!</h3>
          <p className="text-xs text-slate-600 max-w-xs mx-auto">
            Your account is now active and ready for local SEO rank tracking.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer mt-4"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Token was present but failed (Expired or Invalid) */}
      {token && isError && !isLoading && !isSuccess && (
        <div className="py-4 space-y-5">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-amber-900">
                Verification link expired or invalid
              </strong>
              <span>
                Verification tokens expire after 24 hours or cannot be used more than once. Request a new verification link below.
              </span>
            </div>
          </div>

          {resendSent ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-medium">
                ✓ A fresh verification link has been dispatched to your email address.
              </div>
            </div>
          ) : (
            <form onSubmit={handleResend} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Enter your account email:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                />
              </div>

              {resendError && (
                <div className="text-rose-600 text-xs flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{resendError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isResending}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isResending ? 'Sending...' : 'Resend Verification Link'}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link to="/login" className="text-xs text-brand-600 hover:underline">
              Return to Login
            </Link>
          </div>
        </div>
      )}

      {/* 4. No token in URL (User landed after registration or visited /verify-email) */}
      {!token && !isLoading && !isSuccess && (
        <div className="py-4 space-y-5">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-brand-50 border border-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Mail className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Check your inbox</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                We've sent a verification link to your email. Click the link in your email to activate your account and start using Rankora.
              </p>
            </div>
          </div>

          {resendSent ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-medium">
                ✓ A fresh verification link has been dispatched to{' '}
                <span className="font-bold">{resendEmail || 'your email'}</span>.
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="text-xs text-slate-500 font-medium text-center">
                Didn't receive the email or link expired?
              </div>
              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  />
                </div>

                {resendError && (
                  <div className="text-rose-600 text-xs flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{resendError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isResending}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isResending ? 'Sending...' : 'Resend Verification Link'}
                </button>
              </form>
            </div>
          )}

          {/* Dev-Only Instant Verification Bypass (Gated on Server Config Flag) */}
          {devVerifyBypassEnabled && (
            <div className="pt-3 border-t border-dashed border-brand-200">
              <div className="p-3 bg-brand-50/80 border border-brand-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-brand-950 font-bold">
                    <Zap className="w-4 h-4 text-brand-600 fill-brand-600" />
                    <span>Development Environment</span>
                  </div>
                  <span className="text-[10px] bg-brand-200 text-brand-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Dev Bypass
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Skip email inbox check and activate your account directly via secure server dev bypass.
                </p>
                {devBypassError && (
                  <div className="text-rose-600 text-[11px] flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{devBypassError}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleDevBypass}
                  disabled={isBypassing}
                  className="w-full py-2 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isBypassing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Activating account...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Instant Verify & Activate (Dev Only)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="text-center pt-2 flex items-center justify-center space-x-4 text-xs text-slate-500">
            <Link to="/login" className="text-brand-600 hover:underline font-semibold">
              Return to Login
            </Link>
            <span>·</span>
            <Link to="/dashboard" className="text-slate-600 hover:underline">
              Continue to Dashboard
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default VerifyEmailPage;

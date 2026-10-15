import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useLoginMutation, useGoogleLoginMutation, useMfaChallengeMutation } from '../../store/api/authApi';
import { KeyRound, Mail, Lock, ArrowRight, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { AuthAlert } from '../../components/ui/AuthAlert';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as any)?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);

  const [login, { isLoading: isLoginLoading }] = useLoginMutation();
  const [googleLogin, { isLoading: isGoogleLoading }] = useGoogleLoginMutation();
  const [mfaChallenge, { isLoading: isMfaLoading }] = useMfaChallengeMutation();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await login({ email, password }).unwrap();
      if (res.data?.mfaRequired) {
        setMfaChallengeToken(res.data.mfaChallengeToken);
      } else {
        const u = res.data?.user;
        if (u?.mustChangePassword) {
          navigate('/change-password', { replace: true });
        } else if (u?.platformRole === 'ADMIN' || u?.platformRole === 'SUPER_ADMIN') {
          navigate('/admin', { replace: true });
        } else {
          navigate(destination === '/login' || destination === '/admin/login' ? '/dashboard' : destination, { replace: true });
        }
      }
    } catch (err: any) {
      setError(err);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setError(null);

    try {
      const res = await mfaChallenge({ mfaChallengeToken, code: mfaCode }).unwrap();
      const u = res.data?.user;
      if (u?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else if (u?.platformRole === 'ADMIN' || u?.platformRole === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate(destination === '/login' || destination === '/admin/login' ? '/dashboard' : destination, { replace: true });
      }
    } catch (err: any) {
      setError(err);
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      const res = await googleLogin({ idToken }).unwrap();
      const u = res.data?.user;
      if (u?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else if (u?.platformRole === 'ADMIN' || u?.platformRole === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate(destination === '/login' || destination === '/admin/login' ? '/dashboard' : destination, { replace: true });
      }
    } catch (err: any) {
      setError(err);
    }
  };

  // View for MFA challenge step
  if (mfaChallengeToken) {
    return (
      <AuthLayout
        title="Two-Factor Authentication"
        subtitle="Enter the 6-digit code from your authenticator app or an emergency backup code."
      >
      {/* Two-Factor Authentication View */}
      <AuthAlert error={error} onDismiss={() => setError(null)} />

        <form onSubmit={handleMfaSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Verification Code</label>
            <div className="relative">
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456 or ABCD-EFGH"
                required
                autoFocus
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isMfaLoading}
            className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isMfaLoading ? 'Verifying...' : 'Verify & Continue'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMfaChallengeToken(null)}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition"
          >
            ← Back to regular login
          </button>
        </form>
      </AuthLayout>
    );
  }

  // Standard Login View
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your local rankings, tasks, and Google Business Profiles."
    >
      <AuthAlert error={error} onDismiss={() => setError(null)} />

      {/* Google One-Click Button */}
      <GoogleSignInButton
        text="signin"
        isLoading={isGoogleLoading}
        onSuccess={handleGoogleSignIn}
        onError={(msg) => setError(msg)}
      />

      {/* Divider */}
      <div className="relative flex py-2 items-center mb-6">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-medium">Or with email</span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Email + Password Form */}
      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-300 text-slate-900 text-base md:text-xs focus-visible:outline-brand-500 outline-none transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-600 hover:text-brand-800 font-medium transition">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-9 pr-9 h-9 rounded-lg border border-slate-300 text-slate-900 text-base md:text-xs focus-visible:outline-brand-500 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition p-1 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoginLoading}
          className="w-full mt-2 h-9 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
        >
          <span>{isLoginLoading ? 'Signing in...' : 'Sign In'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Footer link */}
      <div className="mt-8 text-center text-xs text-slate-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-800 transition">
          Create an account
        </Link>
      </div>

      <div className="mt-3 text-center text-[11px] text-slate-400">
        Staff & System Administrators:{' '}
        <Link to="/admin/login" className="text-slate-500 hover:text-brand-600 underline transition font-medium">
          Admin portal sign in
        </Link>
      </div>
    </AuthLayout>
  );
};

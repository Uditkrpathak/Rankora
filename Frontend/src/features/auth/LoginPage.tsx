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

        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Verification Code</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456 or ABCD-EFGH"
                required
                autoFocus
                className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white focus:bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isMfaLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2E3192] to-[#1d4ed8] hover:from-[#242775] hover:to-[#1a44be] text-white font-semibold text-sm transition-all shadow-md shadow-brand-500/20 hover:shadow-lg hover:shadow-brand-500/30 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isMfaLoading ? 'Verifying...' : 'Verify & Continue'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMfaChallengeToken(null)}
            className="w-full pt-1 text-center text-xs text-slate-500 hover:text-slate-800 transition font-medium"
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
      <div className="relative flex py-2 items-center mb-5">
        <div className="flex-grow border-t border-slate-200/80"></div>
        <span className="flex-shrink mx-3 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Or with email</span>
        <div className="flex-grow border-t border-slate-200/80"></div>
      </div>

      {/* Email + Password Form */}
      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white focus:bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-11 h-11 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white focus:bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-lg focus:outline-none transition cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoginLoading}
          className="w-full mt-2 h-11 rounded-xl bg-gradient-to-r from-[#2E3192] to-[#1d4ed8] hover:from-[#242775] hover:to-[#1a44be] text-white font-semibold text-sm transition-all shadow-md shadow-brand-500/20 hover:shadow-lg hover:shadow-brand-500/30 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99] group"
        >
          <span>{isLoginLoading ? 'Signing in...' : 'Sign In'}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </form>

      {/* Footer link */}
      <div className="mt-6 text-center text-xs text-slate-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700 transition">
          Create an account
        </Link>
      </div>
    </AuthLayout>
  );
};

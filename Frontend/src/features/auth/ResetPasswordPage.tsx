import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import zxcvbn from 'zxcvbn';
import { AuthLayout } from './AuthLayout';
import { useResetPasswordMutation } from '../../store/api/authApi';
import { Lock, ArrowRight, AlertCircle, Check, X, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const zxcvbnScore = newPassword ? zxcvbn(newPassword, ['rankora', 'localo']).score : 0;
  const rules = {
    length: newPassword.length >= 10,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
    strength: zxcvbnScore >= 3
  };
  const isValid = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!isValid) {
      setErrorMessage('Please satisfy all password complexity requirements.');
      return;
    }
    setErrorMessage(null);

    try {
      await resetPassword({ token, newPassword }).unwrap();
      setIsDone(true);
    } catch (err: any) {
      setErrorMessage(err.data?.error?.message || 'Password reset failed. The link may have expired.');
    }
  };

  if (isDone) {
    return (
      <AuthLayout title="Password Reset Successful" subtitle="Your password has been updated securely.">
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <p className="text-xs text-slate-600">All active sessions across other devices have been invalidated.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition"
          >
            Sign In with New Password
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set New Password" subtitle="Choose a strong password to secure your local SEO data.">
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition p-0.5 rounded"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
            </button>
          </div>

          {newPassword && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px]">
              <div className="flex items-center space-x-2">
                {rules.length ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                <span className={rules.length ? 'text-emerald-700 font-medium' : 'text-slate-500'}>At least 10 characters</span>
              </div>
              <div className="flex items-center space-x-2">
                {rules.strength ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                <span className={rules.strength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>Strong & unguessable entropy</span>
              </div>
              <div className="flex items-center space-x-2">
                {rules.uppercase ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                <span className={rules.uppercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}>One uppercase letter</span>
              </div>
              <div className="flex items-center space-x-2">
                {rules.number ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                <span className={rules.number ? 'text-emerald-700 font-medium' : 'text-slate-500'}>One number</span>
              </div>
              <div className="flex items-center space-x-2">
                {rules.special ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                <span className={rules.special ? 'text-emerald-700 font-medium' : 'text-slate-500'}>One special character</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition p-0.5 rounded"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          <span>{isLoading ? 'Updating...' : 'Update Password'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </AuthLayout>
  );
};

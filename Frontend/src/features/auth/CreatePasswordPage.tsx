import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import zxcvbn from 'zxcvbn';
import { AuthLayout } from './AuthLayout';
import { useConfirmCreatePasswordMutation } from '../../store/api/authApi';
import { Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export const CreatePasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const [confirmCreatePassword, { isLoading }] = useConfirmCreatePasswordMutation();

  const zxcvbnScore = newPassword ? zxcvbn(newPassword, ['rankora', 'localo']).score : 0;
  const rules = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
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
      await confirmCreatePassword({ token, newPassword }).unwrap();
      setIsDone(true);
    } catch (err: any) {
      setErrorMessage(err.data?.error?.message || 'Password creation failed. The link may have expired or a password already exists.');
    }
  };

  if (isDone) {
    return (
      <AuthLayout title="Password Created Successfully" subtitle="Your password has been configured securely.">
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <p className="text-xs text-slate-600">
            You can now log in with your email and password, or update your account email in settings.
          </p>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Account Password"
      subtitle="Set a password to enable password authentication and account updates."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-200">
            {errorMessage}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 pr-10 text-slate-900"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 pr-10 text-slate-900"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password Strength Checklist */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-[11px] text-slate-600">
          <p className="font-semibold text-slate-800 mb-1">Password Requirements:</p>
          <div className={`flex items-center gap-1.5 ${rules.length ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>{rules.length ? '✓' : '○'}</span> At least 8 characters
          </div>
          <div className={`flex items-center gap-1.5 ${rules.uppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>{rules.uppercase ? '✓' : '○'}</span> One uppercase letter
          </div>
          <div className={`flex items-center gap-1.5 ${rules.lowercase ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>{rules.lowercase ? '✓' : '○'}</span> One lowercase letter
          </div>
          <div className={`flex items-center gap-1.5 ${rules.number ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>{rules.number ? '✓' : '○'}</span> One number
          </div>
          <div className={`flex items-center gap-1.5 ${rules.special ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>{rules.special ? '✓' : '○'}</span> One special character
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !isValid || !token}
          className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Creating Password...' : 'Create Password'}
          <ArrowRight className="w-4 h-4" />
        </button>

        {!token && (
          <p className="text-center text-xs text-red-500 font-medium">
            Missing confirmation token. Please open the link sent to your email.
          </p>
        )}
      </form>
    </AuthLayout>
  );
};

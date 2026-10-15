import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useForgotPasswordMutation } from '../../store/api/authApi';
import { Mail, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await forgotPassword({ email });
    setSubmitted(true);
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your account email to receive a secure password reset link."
    >
      {submitted ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Check Your Inbox</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            If an account exists for <strong>{email}</strong>, we have dispatched a single-use password reset link. This link expires in 1 hour.
          </p>
          <div className="pt-4">
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 text-xs text-brand-600 font-semibold hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-brand-600 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{isLoading ? 'Sending...' : 'Send Reset Link'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-4">
            <Link to="/login" className="text-xs text-slate-500 hover:text-slate-800 transition">
              Remember your password? Sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

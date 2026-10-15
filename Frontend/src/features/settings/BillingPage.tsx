import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import { CreditCard, Zap, CheckCircle2, ShieldCheck, ArrowUpRight, Sparkles, Compass, MessageSquare, MapPin, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export const BillingPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const plan = activeWorkspace?.plan || 'trial';

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Billing & Subscription
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your subscription plan, credit allotments, and invoice history.
            </p>
          </div>
          <Link
            to="/settings/plans"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore All Plans</span>
          </Link>
        </div>

        {/* Current Plan Overview Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900 capitalize">
                    {plan === 'trial' ? '14-Day Free Trial' : `${plan} Plan`}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Active Plan
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {plan === 'trial' ? 'Full Pro trial access unlocked across all features.' : 'Monthly recurring subscription.'}
                </p>
              </div>
            </div>

            <Link
              to="/settings/plans"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs self-start sm:self-auto"
            >
              <span>Change Subscription</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Allotments Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Current Plan Allotments & Resource Limits
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Location Profiles</span>
                  <MapPin className="w-4 h-4 text-brand-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {(activeWorkspace as any)?.limits?.locations === -1 ? 'Unlimited' : ((activeWorkspace as any)?.limits?.locations || 10)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Google Business Profile slots</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Geo-Grid Scans</span>
                  <Compass className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {(activeWorkspace as any)?.limits?.monthlyScans === -1 ? 'Unlimited' : ((activeWorkspace as any)?.limits?.monthlyScans || 100)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Monthly grid rank scans</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">AI Assistant</span>
                  <Sparkles className="w-4 h-4 text-violet-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {(activeWorkspace as any)?.limits?.aiCredits === -1 ? 'Unlimited' : ((activeWorkspace as any)?.limits?.aiCredits || 20)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Monthly review & audit credits</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-brand-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Payment & Security</h2>
              <p className="text-xs text-slate-500">Secure card processing, invoicing, and billing credentials.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">No Payment Method Required</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Enjoy your 14-day free trial with zero upfront credit card requirement.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Stripe 256-bit Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

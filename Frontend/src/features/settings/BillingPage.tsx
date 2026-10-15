import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useGetMeLimitsQuery } from '../../store/api/authApi';
import { SettingsLayout } from './SettingsLayout';
import { 
  CreditCard, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowUpRight, 
  Sparkles, 
  Compass, 
  MessageSquare, 
  MapPin, 
  FileText,
  Key,
  Users,
  AlertTriangle,
  Info,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const BillingPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const { data: limitsData, isLoading } = useGetMeLimitsQuery();

  const planName = limitsData?.planName || activeWorkspace?.plan || 'Trial';
  const effectiveLimits = limitsData?.effectiveLimits;
  const usage = limitsData?.usage || { locationsCount: 0, scanCreditsUsed: 0, aiChatbotQueriesUsed: 0 };
  const resetAt = limitsData?.usageResetAt ? new Date(limitsData.usageResetAt).toLocaleDateString() : null;

  const calculatePercent = (used: number, limit: number) => {
    if (limit === -1 || !limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Billing & Resource Limits
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              View your subscription status, resource allocations, and administrator-managed limits.
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

        {/* Managed limits banner */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-indigo-950">Managed by Platform Administrator</p>
            <p className="text-indigo-800/80 mt-0.5 leading-relaxed">
              Your plan tier, feature capabilities, and usage allotments are governed by administrative policies. 
              {resetAt && ` Monthly counters automatically reset on ${resetAt}.`}
            </p>
          </div>
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
                    {planName} Plan
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Active Plan
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Platform tier: <strong className="text-slate-700 capitalize">{planName}</strong>
                  {limitsData?.planExpiresAt && ` • Expires ${new Date(limitsData.planExpiresAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <Link
              to="/settings/plans"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs self-start sm:self-auto"
            >
              <span>View Plans</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Usage & Allotments Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
              Resource Usage & Quotas
            </h4>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-brand-600" />
                Loading resource allocations...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Locations Limit */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Location Profiles</span>
                    <MapPin className="w-4 h-4 text-brand-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {usage.locationsCount}{' '}
                      <span className="text-xs font-medium text-slate-500">
                        / {effectiveLimits?.locationsLimit === -1 ? '∞' : (effectiveLimits?.locationsLimit ?? 10)}
                      </span>
                    </div>
                    {effectiveLimits?.locationsLimit !== -1 && (
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            calculatePercent(usage.locationsCount, effectiveLimits?.locationsLimit ?? 10) >= 100 
                              ? 'bg-rose-500' 
                              : 'bg-brand-600'
                          }`}
                          style={{ width: `${calculatePercent(usage.locationsCount, effectiveLimits?.locationsLimit ?? 10)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {effectiveLimits?.locationsLimit !== -1 && usage.locationsCount >= (effectiveLimits?.locationsLimit ?? 10) && (
                    <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Limit reached: set by your administrator.
                    </p>
                  )}
                </div>

                {/* Monthly Scan Credits */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Monthly Scan Credits</span>
                    <Compass className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {usage.scanCreditsUsed}{' '}
                      <span className="text-xs font-medium text-slate-500">
                        / {effectiveLimits?.scanCreditsPerMonth === -1 ? '∞' : (effectiveLimits?.scanCreditsPerMonth ?? 100)}
                      </span>
                    </div>
                    {effectiveLimits?.scanCreditsPerMonth !== -1 && (
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            calculatePercent(usage.scanCreditsUsed, effectiveLimits?.scanCreditsPerMonth ?? 100) >= 100 
                              ? 'bg-rose-500' 
                              : 'bg-indigo-600'
                          }`}
                          style={{ width: `${calculatePercent(usage.scanCreditsUsed, effectiveLimits?.scanCreditsPerMonth ?? 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {effectiveLimits?.scanCreditsPerMonth !== -1 && usage.scanCreditsUsed >= (effectiveLimits?.scanCreditsPerMonth ?? 100) && (
                    <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Limit reached: set by your administrator.
                    </p>
                  )}
                </div>

                {/* AI Assistant Queries */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">AI Assistant Queries</span>
                    <Sparkles className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {usage.aiChatbotQueriesUsed}{' '}
                      <span className="text-xs font-medium text-slate-500">
                        / {effectiveLimits?.aiChatbotQueriesPerMonth === -1 ? '∞' : (effectiveLimits?.aiChatbotQueriesPerMonth ?? 50)}
                      </span>
                    </div>
                    {effectiveLimits?.aiChatbotQueriesPerMonth !== -1 && (
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            calculatePercent(usage.aiChatbotQueriesUsed, effectiveLimits?.aiChatbotQueriesPerMonth ?? 50) >= 100 
                              ? 'bg-rose-500' 
                              : 'bg-violet-600'
                          }`}
                          style={{ width: `${calculatePercent(usage.aiChatbotQueriesUsed, effectiveLimits?.aiChatbotQueriesPerMonth ?? 50)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {effectiveLimits?.aiChatbotQueriesPerMonth !== -1 && usage.aiChatbotQueriesUsed >= (effectiveLimits?.aiChatbotQueriesPerMonth ?? 50) && (
                    <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Limit reached: set by your administrator.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Feature Access Flags */}
          {effectiveLimits && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Account Capabilities
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Geo-Grid Scanning</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    effectiveLimits.canUseGeoGrid 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {effectiveLimits.canUseGeoGrid ? 'Enabled' : 'Restricted'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">PDF Reports</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    effectiveLimits.canExportPdf 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {effectiveLimits.canExportPdf ? 'Enabled' : 'Restricted'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">API Access</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    effectiveLimits.canUseApi 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {effectiveLimits.canUseApi ? 'Enabled' : 'Restricted'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Team Seats</span>
                  <span className="font-bold text-slate-800">
                    {effectiveLimits.teamSeatLimit === -1 ? 'Unlimited' : `${effectiveLimits.teamSeatLimit} max`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Methods Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-brand-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Payment & Invoicing</h2>
              <p className="text-xs text-slate-500">Platform billing policies and invoices.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Administrator Managed Billing</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Subscriptions and credit allocations are provisioned directly by your platform administrator.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Admin Verified</span>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

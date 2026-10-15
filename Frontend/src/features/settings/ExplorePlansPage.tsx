import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import { Check, Zap, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export const ExplorePlansPage: React.FC = () => {
  const toast = useToast();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const currentPlan = activeWorkspace?.plan || 'trial';

  const plans = [
    {
      id: 'trial',
      name: '14-Day Free Trial',
      price: '$0',
      period: 'for 14 days',
      badge: 'CURRENT PLAN',
      description: 'Full access to all Pro features with 10 locations and 100 scan credits.',
      features: [
        '10 Google Business Profile locations',
        '100 Geo-Grid Scan credits',
        '20 AI Assistant credits',
        'Full 17-Point Audit engine',
        '3 Team member seats',
        'Live Google Search & Maps API sync',
      ],
      isCurrent: currentPlan === 'trial',
      buttonText: currentPlan === 'trial' ? 'Active Plan' : 'Trial Expired',
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter Plan',
      price: '$29',
      period: '/ month',
      badge: '',
      description: 'Ideal for single storefront businesses boosting local search rankings.',
      features: [
        '3 Google Business Profile locations',
        '50 Geo-Grid Scan credits / mo',
        '10 AI Assistant credits / mo',
        'Automated monthly audits',
        '2 Team member seats',
        'Standard email support',
      ],
      isCurrent: currentPlan === 'starter',
      buttonText: 'Upgrade to Starter',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro Growth',
      price: '$79',
      period: '/ month',
      badge: 'MOST POPULAR',
      description: 'For growing businesses and multi-location practices dominating local 3-packs.',
      features: [
        '15 Google Business Profile locations',
        '300 Geo-Grid Scan credits / mo',
        '50 AI Assistant credits / mo',
        '17-Point Audits on demand',
        '10 Team & Client seats',
        'Competitor benchmarking matrix',
        'Priority API sync frequency',
      ],
      isCurrent: currentPlan === 'pro',
      buttonText: 'Upgrade to Pro',
      popular: true,
    },
    {
      id: 'agency',
      name: 'Agency Scale',
      price: '$199',
      period: '/ month',
      badge: 'FOR AGENCIES',
      description: 'For digital agencies managing dozens of client profiles at scale.',
      features: [
        '50+ Google Business Profile locations',
        '1,200 Geo-Grid Scan credits / mo',
        'Unlimited AI audit reports',
        'Unlimited team & client logins',
        'White-label audit PDF exports',
        'Dedicated account manager',
        'Custom Webhook & API integrations',
      ],
      isCurrent: currentPlan === 'agency',
      buttonText: 'Contact Agency Sales',
      popular: false,
    },
  ];

  return (
    <SettingsLayout>
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider border border-brand-100">
            <Sparkles className="w-3.5 h-3.5" />
            Rankora Pricing & Growth Plans
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Flexible plans for every stage of growth
          </h1>
          <p className="text-sm text-slate-500">
            Scale your local search presence with coordinate-accurate rank heatmaps, automated audits, and GBP sync.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-2xl p-6 flex flex-col justify-between relative transition-all duration-200 ${
                p.popular
                  ? 'border-2 border-brand-600 shadow-lg shadow-brand-500/10 ring-4 ring-brand-500/10'
                  : 'border border-slate-200/80 shadow-xs hover:border-slate-300'
              }`}
            >
              {p.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-xs ${
                    p.popular
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {p.badge}
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h3>
                <p className="text-xs text-slate-500 min-h-[36px] mb-4 leading-relaxed">{p.description}</p>

                <div className="flex items-baseline gap-1 mb-5 pb-5 border-b border-slate-100">
                  <span className="text-3xl font-extrabold text-slate-900">{p.price}</span>
                  <span className="text-xs font-semibold text-slate-500">{p.period}</span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    What's included
                  </div>
                  <div className="space-y-2.5">
                    {p.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                        <Check className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled={p.isCurrent}
                onClick={() => {
                  if (!p.isCurrent) toast.info('Online plan upgrades will be enabled when production billing goes live.');
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  p.isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : p.popular
                    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs shadow-brand-600/30'
                    : 'bg-slate-900 hover:bg-black text-white shadow-xs'
                }`}
              >
                <span>{p.buttonText}</span>
                {!p.isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </SettingsLayout>
  );
};

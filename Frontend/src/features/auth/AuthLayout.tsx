import React from 'react';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { BRAND_CONFIG } from '../../config/brand';
import { Check } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-white antialiased text-slate-900">
      {/* Left Panel: Clean subtle preview panel */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 xl:p-12 bg-slate-50/60 border-r border-slate-200 relative">
        {/* Logo Top Left */}
        <div className="relative z-10">
          <BrandLogo to="/" size="md" />
        </div>

        {/* Center: Plain headline, supporting sentence & compact feature list */}
        <div className="relative z-10 my-auto max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl xl:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              See where your business ranks on Google Maps
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Check your position street by street, track high-intent keywords, and outperform local competitors.
            </p>
          </div>

          {/* Clean Compact Feature Points */}
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">Coordinate-Accurate Geo-Grid</p>
                <p className="text-[11px] text-slate-500 leading-normal">Track your Google Maps rank street by street around your location.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">Competitor 3-Pack Analysis</p>
                <p className="text-[11px] text-slate-500 leading-normal">Compare rankings and attributes against top local rivals in real time.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">AI Keyword Suggestions</p>
                <p className="text-[11px] text-slate-500 leading-normal">Surface high-converting local queries directly from real search trends.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">GBP Health & Automated Audits</p>
                <p className="text-[11px] text-slate-500 leading-normal">Keep your Google Business Profiles compliant, active, and optimized.</p>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Right Column: Form Area */}
      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center items-center p-4 sm:p-8 xl:p-12 relative">
        {/* Subtle Ambient Light for Right Side */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-50/50 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile Logo above form */}
          <div className="flex lg:hidden items-center justify-center mb-6">
            <BrandLogo to="/" size="lg" />
          </div>

          {/* Form Header */}
          <div className="mb-6 text-center sm:text-left">
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#0E1230] font-heading tracking-tight">{title}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>

          {/* Clean White Form Card */}
          <div className="bg-white rounded-lg p-6 sm:p-8 border border-slate-200">
            {children}
          </div>


        </div>
      </div>
    </div>
  );
};

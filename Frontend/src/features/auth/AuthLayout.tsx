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
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-10 xl:p-14 bg-slate-50/60 border-r border-slate-200 relative">
        {/* Logo Top Left */}
        <div className="relative z-10">
          <BrandLogo to="/dashboard" />
        </div>

        {/* Center: Plain headline, supporting sentence, 3 bullets & SVG Map Grid */}
        <div className="relative z-10 my-auto max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl xl:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              See where your business ranks on Google Maps
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Check your position street by street, track keywords, and compare with nearby competitors.
            </p>
          </div>

          {/* 3 Real Product Bullets */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
              </span>
              <span>Rank checks on a grid around your business</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
              </span>
              <span>Keyword suggestions from real Google searches</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
              </span>
              <span>Competitors from the same results</span>
            </div>
          </div>

          {/* Hand-built SVG illustration: Map grid with colored dots, NO numbers or fake data */}
          <div className="pt-3">
            <div className="p-4 rounded-2xl glass-panel border border-slate-200/90 shadow-2xs max-w-xs">
              <svg viewBox="0 0 200 140" fill="none" className="w-full h-auto" aria-hidden="true">
                {/* Clean map grid streets */}
                <rect x="10" y="10" width="180" height="120" rx="8" className="fill-slate-50 stroke-slate-200" strokeWidth="1" />
                <path d="M10 40 H190 M10 70 H190 M10 100 H190" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M55 10 V130 M100 10 V130 M145 10 V130" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />

                {/* Street arterial lines */}
                <path d="M30 10 Q60 50 100 70 T170 130" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 90 Q80 85 130 50 T190 30" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />

                {/* Grid ranking dots (pure colors, NO numbers) */}
                <circle cx="55" cy="40" r="4" className="fill-emerald-500" />
                <circle cx="100" cy="40" r="4" className="fill-emerald-500" />
                <circle cx="145" cy="40" r="4" className="fill-amber-500" />

                <circle cx="55" cy="70" r="4" className="fill-emerald-500" />
                <circle cx="100" cy="70" r="6" className="fill-brand-600 stroke-2 stroke-white" />
                <circle cx="145" cy="70" r="4" className="fill-amber-500" />

                <circle cx="55" cy="100" r="4" className="fill-amber-500" />
                <circle cx="100" cy="100" r="4" className="fill-rose-500" />
                <circle cx="145" cy="100" r="4" className="fill-rose-500" />
              </svg>
            </div>
          </div>
        </div>

        {/* Legal Footer */}
        <div className="relative z-10 text-[11px] text-slate-500">
          © {BRAND_CONFIG.copyrightYear} {BRAND_CONFIG.legalName}
        </div>
      </div>

      {/* Right Column: Form Area */}
      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center items-center p-4 sm:p-8 xl:p-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo above form */}
          <div className="flex lg:hidden items-center justify-center mb-6">
            <BrandLogo to="/dashboard" />
          </div>

          {/* Form Header */}
          <div className="mb-5 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          </div>

          {/* Clean White Form Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xs">
            {children}
          </div>

          {/* Mobile Footer */}
          <div className="mt-6 text-center lg:hidden text-[11px] text-slate-400">
            © {BRAND_CONFIG.copyrightYear} {BRAND_CONFIG.legalName}
          </div>
        </div>
      </div>
    </div>
  );
};

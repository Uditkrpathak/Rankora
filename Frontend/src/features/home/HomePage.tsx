import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { RankoraLogo } from '../../components/ui/RankoraLogo';
import {
  MapPin,
  TrendingUp,
  MessageSquare,
  Building2,
  Calendar,
  BarChart3,
  Search,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Globe2,
  Star,
  Check,
  Menu,
  X,
  Sliders,
  Sparkles,
  ShieldCheck,
  FileText,
  Phone,
  Car,
  Landmark,
  Shield,
  Linkedin,
  Twitter,
  Instagram,
  Compass,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const faqsLeft = [
    {
      q: 'How fast will I see results?',
      a: 'Most businesses notice measurable ranking improvements within 14 to 30 days of completing their initial profile optimization. Organic review velocity and citation cleanups typically produce sustained call gains in weeks two through four.',
    },
    {
      q: 'Do I need technical skills?',
      a: 'No technical background is required. Rankora translates complex search algorithm factors into straightforward, step-by-step checklist tasks you can complete in minutes without editing code or touching DNS settings.',
    },
    {
      q: 'Can I manage multiple locations?',
      a: 'Yes. Our platform is built from the ground up to support single storefronts, growing regional practices, and large multi-location franchises from one centralized account without logging in and out.',
    },
  ];

  const faqsRight = [
    {
      q: 'Is my Google account data safe?',
      a: 'Yes, your data is completely secure. We use official Google Business Profile APIs with enterprise-grade encryption. Rankora never requests or stores your Google password, and you retain full account ownership at all times.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes. You can cancel your subscription with a single click inside your account billing settings at any time. There are no contracts, commitments, or cancellation fees.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#5A6180] font-sans selection:bg-[#2E3192] selection:text-white relative overflow-x-hidden antialiased">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Rankora',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: 'Local SEO platform helping businesses climb Google Maps, win reviews and drive local calls.',
            publisher: {
              '@type': 'Organization',
              name: 'Agumentik Software Private Limited',
              url: 'https://rankora.app',
            },
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'USD',
              lowPrice: '29',
              highPrice: '199',
            },
          }),
        }}
      />

      {/* ── Sticky Translucent Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center min-w-[180px]">
            <Link to="/" className="group focus:outline-none flex items-center">
              <RankoraLogo size="md" />
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center gap-10 text-[14.5px] font-medium text-[#475569]" aria-label="Main Navigation">
            <a href="#features" className="hover:text-[#2E3192] transition-colors duration-150">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#2E3192] transition-colors duration-150">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-[#2E3192] transition-colors duration-150">
              Pricing
            </a>
            <a href="#case-studies" className="hover:text-[#2E3192] transition-colors duration-150">
              Case Studies
            </a>
            <a href="#faq" className="hover:text-[#2E3192] transition-colors duration-150">
              FAQ
            </a>
          </nav>

          {/* Right: Gradient Pill Button */}
          <div className="hidden sm:flex items-center justify-end min-w-[180px]">
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-[14px] font-semibold shadow-sm hover:shadow-md hover:opacity-95 active:scale-[0.99] transition-all duration-150 group"
              style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
            >
              <span>Dashboard</span>

            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-[#141833] hover:bg-[#F4F7FC] transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-6 py-5 space-y-4 shadow-xl">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-[15px] font-medium text-[#141833] hover:text-[#2E3192] transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-[15px] font-medium text-[#141833] hover:text-[#2E3192] transition-colors"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-[15px] font-medium text-[#141833] hover:text-[#2E3192] transition-colors"
            >
              Pricing
            </a>
            <a
              href="#case-studies"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-[15px] font-medium text-[#141833] hover:text-[#2E3192] transition-colors"
            >
              Case Studies
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-[15px] font-medium text-[#141833] hover:text-[#2E3192] transition-colors"
            >
              FAQ
            </a>
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-full text-white text-[14px] font-semibold shadow-sm flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              >
                <span>Dashboard</span>
                <ArrowRight size={15} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section (Premier SaaS Centered Layout) ───────────────── */}
      <section className="relative bg-white pt-14 pb-20 lg:pt-18 lg:pb-28 overflow-hidden">
        {/* Soft Ambient Radiance in Background */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-gradient-to-tr from-[#1CB5D6]/12 via-[#2E3192]/6 to-transparent rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Top Status Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F4F7FC] border border-[#2E3192]/10 text-xs font-medium text-[#141833] shadow-2xs mb-6">
              <span className="w-2 h-2 rounded-full bg-[#1FA971] animate-pulse" />
              <span className="font-semibold text-[11px] text-[#141833] tracking-wide uppercase">Local SEO Platform</span>
              <span className="text-slate-300">•</span>
              <span className="text-[#2E3192] font-semibold text-[11px]">Rankora by Agumentik</span>
              <span className="text-slate-300">•</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1CB5D6]/10 text-[#0284C7] font-semibold text-[10.5px]">24/7 Monitor</span>
            </div>

            {/* H1 Heading (Clean, Balanced 2-Line Headline with Guaranteed Vertical Separation) */}
            <h1 className="font-heading font-extrabold text-[#141833] tracking-tight max-w-3xl mx-auto mb-6 flex flex-col gap-3 sm:gap-4 text-center">
              <span className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] leading-tight block">
                Rank Higher on Google Maps &
              </span>
              <span
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] leading-tight block bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              >
                Win More Nearby Customers
              </span>
            </h1>

            {/* Subtitle / Paragraph */}
            <p className="text-base sm:text-lg text-[#5A6180] leading-[1.75] max-w-2xl mx-auto font-normal mb-8">
              Coordinate-accurate 13×13 geo-grid rank tracking, automated profile optimization, and AI review velocity — built to help ambitious local businesses dominate the Google 3-Pack.
            </p>

            {/* Primary Action Button */}
            <div className="flex items-center justify-center w-full mb-6">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="px-8 py-3.5 rounded-full text-white font-semibold text-base shadow-lg shadow-[#2E3192]/20 hover:shadow-xl hover:shadow-[#2E3192]/25 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              >
                <span>Start Free Trial</span>

              </Link>
            </div>

            {/* ── Centered Interactive Geo-Grid Showcase Window ──── */}
            <div className="pt-10 sm:pt-14 w-full max-w-4xl mx-auto">
              <div className="relative rounded-2xl sm:rounded-3xl border border-[#2E3192]/15 bg-white shadow-2xl shadow-[#2E3192]/10 overflow-hidden">
                {/* Window Chrome Header */}
                <div className="px-4 py-3 bg-[#F8FAFC] border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block" />
                    </div>
                    <span className="text-slate-300 ml-1">|</span>
                    <span className="font-heading font-bold text-xs text-[#141833] ml-1">Rankora Live Geo-Grid</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200/80 text-[11px] text-[#5A6180] shadow-2xs">
                    <Search size={11} className="text-[#1CB5D6]" />
                    <span className="font-medium text-[#141833]">dentist near me</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[#1FA971] font-semibold">15 km radius</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-semibold border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Scan Active
                    </span>
                  </div>
                </div>

                {/* Radar Grid Canvas Area */}
                <div className="relative bg-[#FAFCFF] p-6 sm:p-10 min-h-[340px] sm:min-h-[400px] flex items-center justify-center overflow-hidden">
                  {/* Map Grid Pattern */}
                  <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#CBD5E1_1px,transparent_1px),linear-gradient(to_bottom,#CBD5E1_1px,transparent_1px)] bg-[size:32px_32px]" />

                  {/* Concentric Radar Wave Signals */}
                  <div className="absolute w-[360px] h-[360px] rounded-full border border-[#2E3192]/10 bg-[#2E3192]/3 pointer-events-none" />
                  <div className="absolute w-[260px] h-[260px] rounded-full border border-[#1CB5D6]/20 bg-[#1CB5D6]/5 pointer-events-none" />
                  <div className="absolute w-[160px] h-[160px] rounded-full border border-[#1FA971]/30 bg-[#1FA971]/10 pointer-events-none" />

                  {/* Floating Metric 1: Business Profile Card (Top Left) */}
                  <div className="absolute top-4 left-4 bg-white/95 rounded-xl p-3 border border-slate-200/80 shadow-md backdrop-blur-md z-20 flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-[#1FA971]/15 text-[#1FA971] flex items-center justify-center font-bold text-xs shrink-0">
                      <Building2 size={16} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-xs text-[#141833]">Vance Family Dental</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#1FA971] text-white font-extrabold text-[9px]">#1</span>
                      </div>
                      <div className="text-[10px] text-[#5A6180]">
                        <span className="text-[#FFB800] font-bold">4.9 ★</span> (342 reviews) · Austin, TX
                      </div>
                    </div>
                  </div>

                  {/* Floating Metric 2: Local Visibility (Top Right) */}
                  <div className="absolute top-4 right-4 bg-white/95 rounded-xl p-3 border border-slate-200/80 shadow-md backdrop-blur-md z-20 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E97B8] block">Local Visibility</span>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-heading font-extrabold text-base text-[#141833]">98.4%</span>
                      <BarChart3 size={15} strokeWidth={2.5} className="text-[#1CB5D6]" />
                    </div>
                  </div>

                  {/* Floating Metric 3: Map Pack Dominance (Bottom Left) */}
                  <div className="hidden sm:flex absolute bottom-4 left-4 bg-white/95 rounded-xl p-2.5 border border-slate-200/80 shadow-md backdrop-blur-md z-20 items-center gap-2 text-left">
                    <div className="w-7 h-7 rounded-lg bg-[#2E3192]/10 text-[#2E3192] flex items-center justify-center shrink-0">
                      <MapPin size={14} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#8E97B8]">Google 3-Pack Share</div>
                      <div className="text-xs font-bold text-[#141833]">142 of 169 Grid Points (#1)</div>
                    </div>
                  </div>

                  {/* Floating Metric 4: Review Velocity (Bottom Right) */}
                  <div className="hidden sm:flex absolute bottom-4 right-4 bg-white/95 rounded-xl p-2.5 border border-slate-200/80 shadow-md backdrop-blur-md z-20 items-center gap-2 text-right">
                    <div className="w-7 h-7 rounded-lg bg-[#FFB800]/15 text-[#FFB800] flex items-center justify-center shrink-0">
                      <Star size={14} fill="#FFB800" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-semibold text-[#8E97B8]">Review Velocity</div>
                      <div className="text-xs font-bold text-[#1FA971]">+28 New Reviews This Month</div>
                    </div>
                  </div>

                  {/* Center Storefront Pin #1 */}
                  <div className="relative z-10 w-12 h-12 rounded-full bg-[#1FA971] text-white font-extrabold text-sm flex items-center justify-center shadow-xl border-2 border-white ring-4 ring-[#1FA971]/30">
                    <Building2 size={18} strokeWidth={2.5} />
                  </div>

                  {/* Surrounding Concentric Nodes on Map */}
                  <div className="absolute top-[28%] left-[48%] -translate-x-1/2 w-7 h-7 rounded-full bg-[#1FA971] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    1
                  </div>
                  <div className="absolute bottom-[28%] left-[48%] -translate-x-1/2 w-7 h-7 rounded-full bg-[#1FA971] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    1
                  </div>
                  <div className="absolute top-[48%] right-[32%] -translate-y-1/2 w-7 h-7 rounded-full bg-[#1FA971] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    1
                  </div>
                  <div className="absolute top-[48%] left-[32%] -translate-y-1/2 w-7 h-7 rounded-full bg-[#1CB5D6] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    2
                  </div>
                  <div className="absolute top-[22%] right-[36%] w-7 h-7 rounded-full bg-[#1CB5D6] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    3
                  </div>
                  <div className="absolute bottom-[22%] left-[36%] w-7 h-7 rounded-full bg-[#FFB800] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    4
                  </div>
                  <div className="absolute top-[16%] left-[40%] w-7 h-7 rounded-full bg-[#FFB800] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    5
                  </div>
                  <div className="absolute bottom-[16%] right-[40%] w-7 h-7 rounded-full bg-[#E74C3C] text-white font-extrabold text-xs flex items-center justify-center shadow border border-white">
                    7
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Strip ──────────────────────────────────────────────── */}
      <section className="py-10 bg-white border-y border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold text-[#8E97B8] uppercase tracking-wider mb-6">
            Trusted by 1,200+ local businesses
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 items-center justify-center opacity-70">
            <div className="flex items-center justify-center gap-2 font-heading font-bold text-sm text-[#141833]">
              <Building2 size={18} strokeWidth={1.5} className="text-[#2E3192]" />
              <span>DentalCare Clinic</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-heading font-bold text-sm text-[#141833]">
              <Landmark size={18} strokeWidth={1.5} className="text-[#1CB5D6]" />
              <span>Apex Law Group</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-heading font-bold text-sm text-[#141833]">
              <Car size={18} strokeWidth={1.5} className="text-[#2E3192]" />
              <span>Metro Auto Care</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-heading font-bold text-sm text-[#141833]">
              <Building2 size={18} strokeWidth={1.5} className="text-[#1CB5D6]" />
              <span>Beacon Realty</span>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 font-heading font-bold text-sm text-[#141833]">
              <Shield size={18} strokeWidth={1.5} className="text-[#2E3192]" />
              <span>BlueWave Hospitality</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section (4 Pill Cards on Clean White) ───────────────── */}
      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Stat 1 */}
            <div className="p-5 rounded-2xl bg-white border border-[#2E3192]/10 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-[#2E3192]/10 text-[#2E3192] flex items-center justify-center shrink-0">
                <TrendingUp size={22} strokeWidth={2} />
              </div>
              <div>
                <div className="font-heading font-extrabold text-2xl text-[#141833]">3.2x</div>
                <p className="text-xs font-semibold text-[#5A6180]">more local visibility</p>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="p-5 rounded-2xl bg-white border border-[#2E3192]/10 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-[#1FA971]/15 text-[#1FA971] flex items-center justify-center shrink-0">
                <Phone size={22} strokeWidth={2} />
              </div>
              <div>
                <div className="font-heading font-extrabold text-2xl text-[#1FA971]">68%</div>
                <p className="text-xs font-semibold text-[#5A6180]">more calls from Google</p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="p-5 rounded-2xl bg-white border border-[#2E3192]/10 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-[#FFB800]/15 text-[#FFB800] flex items-center justify-center shrink-0">
                <Star size={22} fill="#FFB800" strokeWidth={2} />
              </div>
              <div>
                <div className="font-heading font-extrabold text-2xl text-[#141833]">4.8★</div>
                <p className="text-xs font-semibold text-[#5A6180]">average review rating</p>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="p-5 rounded-2xl bg-white border border-[#2E3192]/10 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center shrink-0">
                <Calendar size={22} strokeWidth={2} />
              </div>
              <div>
                <div className="font-heading font-extrabold text-2xl text-[#2E3192]">14 days</div>
                <p className="text-xs font-semibold text-[#5A6180]">to first ranking gains</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid (White Background, Asymmetric Layout) ─── */}
      <section id="features" className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
              Everything you need to win local search
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A6180]">
              One platform to track, optimize and grow your local presence.
            </p>
          </div>

          {/* 12-Column Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* 1. Local Rank Tracking (Large, 8 Cols) */}
            <div className="md:col-span-12 lg:col-span-8 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#2E3192]/10 text-[#2E3192] flex items-center justify-center mb-5">
                  <MapPin size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#141833]">Local Rank Tracking</h3>
                <p className="mt-2 text-sm text-[#5A6180] max-w-xl">
                  See exactly where you rank on Google Maps for every keyword, down to the street.
                </p>
              </div>

              {/* Geo-Grid Heatmap Mini Preview */}
              <div className="mt-6 p-4 rounded-2xl bg-[#F4F7FC] border border-[#2E3192]/10 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-[#2E3192] text-white font-bold text-[10px]">
                    Live Geo-Grid Heatmap
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[#1FA971] text-white font-bold text-[10px]">
                    #1 Your Business
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold">
                  <div className="p-2.5 rounded-lg bg-[#1FA971] text-white">1</div>
                  <div className="p-2.5 rounded-lg bg-[#1FA971] text-white">1</div>
                  <div className="p-2.5 rounded-lg bg-[#1FA971] text-white">1</div>
                  <div className="p-2.5 rounded-lg bg-[#1CB5D6] text-white">2</div>
                  <div className="p-2.5 rounded-lg bg-[#FFB800] text-white">3</div>
                  <div className="p-2.5 rounded-lg bg-[#E74C3C] text-white">11</div>
                </div>
              </div>
            </div>

            {/* 2. Google Business Profile Manager (Wide, 4 Cols) */}
            <div className="md:col-span-6 lg:col-span-4 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#1CB5D6]/15 text-[#1CB5D6] flex items-center justify-center mb-5">
                  <Building2 size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-lg text-[#141833]">Google Business Profile Manager</h3>
                <p className="mt-2 text-sm text-[#5A6180]">
                  Update hours, posts, photos and services across all locations in one place.
                </p>
              </div>
              <div className="mt-6 p-3 rounded-xl bg-[#1FA971]/10 text-[#1FA971] flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} strokeWidth={2} />
                  <span>All Locations Synced</span>
                </span>
                <span>100% Up to Date</span>
              </div>
            </div>

            {/* 3. Review Management (Tall, 4 Cols) */}
            <div className="md:col-span-6 lg:col-span-4 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center mb-5">
                  <MessageSquare size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-lg text-[#141833]">Review Management</h3>
                <p className="mt-2 text-sm text-[#5A6180]">
                  Request, track and reply to reviews with smart templates that save hours every week.
                </p>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-[#F4F7FC] border border-[#2E3192]/10 text-xs space-y-2">
                <div className="flex text-[#FFB800] gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="#FFB800" strokeWidth={1.5} />
                  ))}
                </div>
                <p className="text-[#141833] font-medium italic">
                  &quot;Fast appointment and caring staff. Found them first on Google Maps.&quot;
                </p>
              </div>
            </div>

            {/* 4. Citation Builder (Small, 4 Cols) */}
            <div className="md:col-span-6 lg:col-span-4 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#1CB5D6]/15 text-[#1CB5D6] flex items-center justify-center mb-5">
                  <Globe2 size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-lg text-[#141833]">Citation Builder</h3>
                <p className="mt-2 text-sm text-[#5A6180]">
                  Fix and sync your listings across 100+ directories.
                </p>
              </div>
              <div className="mt-6 p-3 rounded-xl bg-[#1FA971]/10 text-[#1FA971] text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>100+ Synced Directories</span>
              </div>
            </div>

            {/* 5. Competitor Insights (Small, 4 Cols) */}
            <div className="md:col-span-6 lg:col-span-4 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#2E3192]/10 text-[#2E3192] flex items-center justify-center mb-5">
                  <Sliders size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-lg text-[#141833]">Competitor Insights</h3>
                <p className="mt-2 text-sm text-[#5A6180]">
                  See what top-ranked rivals do differently, then beat them.
                </p>
              </div>
              <div className="mt-6 p-3 rounded-xl bg-[#2E3192]/10 text-[#2E3192] text-xs font-bold flex items-center gap-1.5">
                <TrendingUp size={16} strokeWidth={2} />
                <span>Side-by-side gap matrix</span>
              </div>
            </div>

            {/* 6. AI Content & Post Scheduler (Wide, 8 Cols) */}
            <div className="md:col-span-12 lg:col-span-8 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#0284C7]/15 text-[#0284C7] flex items-center justify-center mb-5">
                  <Calendar size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#141833]">AI Content & Post Scheduler</h3>
                <p className="mt-2 text-sm text-[#5A6180]">
                  Create local-friendly posts in seconds and publish them on schedule.
                </p>
              </div>
              <div className="mt-6 p-3.5 rounded-xl bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-between text-xs font-bold">
                <span>Weekly automated Google updates & offers</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={15} strokeWidth={2} />
                  <span>Auto-Publish Active</span>
                </span>
              </div>
            </div>

            {/* 7. Reports and Analytics (Small, 4 Cols) */}
            <div className="md:col-span-12 lg:col-span-4 bento-card p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#1CB5D6]/15 text-[#1CB5D6] flex items-center justify-center mb-5">
                  <BarChart3 size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-heading font-bold text-lg text-[#141833]">Reports & Analytics</h3>
                <p className="mt-2 text-sm text-[#5A6180]">
                  Clear monthly reports your clients will actually read.
                </p>
              </div>
              <div className="mt-6 p-3 rounded-xl bg-[#F4F7FC] border border-[#2E3192]/10 text-[#2E3192] text-xs font-bold flex items-center gap-1.5">
                <FileText size={16} strokeWidth={1.5} />
                <span>White-label PDF reports</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works (White Background, Thin Gradient Dotted Line) ─── */}
      <section id="how-it-works" className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A6180]">
              Three steps to put your business in the Top 3.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative items-center">
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-white border border-[#2E3192]/10 shadow-sm text-center space-y-4 hover:shadow-md transition">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#1CB5D6]/15 text-[#1CB5D6] flex items-center justify-center font-heading font-bold text-lg">
                01
              </div>
              <h3 className="font-heading font-bold text-xl text-[#141833]">Connect</h3>
              <p className="text-sm text-[#5A6180] leading-relaxed">
                Link your Google Business Profile in one click.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-white border border-[#2E3192]/10 shadow-sm text-center space-y-4 hover:shadow-md transition">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#2E3192]/10 text-[#2E3192] flex items-center justify-center font-heading font-bold text-lg">
                02
              </div>
              <h3 className="font-heading font-bold text-xl text-[#141833]">Optimize</h3>
              <p className="text-sm text-[#5A6180] leading-relaxed">
                Rankora audits your profile and shows exactly what to fix.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-white border border-[#2E3192]/10 shadow-sm text-center space-y-4 hover:shadow-md transition">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#1FA971]/15 text-[#1FA971] flex items-center justify-center font-heading font-bold text-lg">
                03
              </div>
              <h3 className="font-heading font-bold text-xl text-[#141833]">Grow</h3>
              <p className="text-sm text-[#5A6180] leading-relaxed">
                Watch rankings, reviews and leads climb week by week.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Split Section (Map Rankings Left, Text Right) ──────────────── */}
      <section className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Geo-Grid Mockup Widget with Competitors List */}
            <div className="lg:col-span-6 rounded-3xl border border-[#2E3192]/15 bg-white shadow-xl overflow-hidden p-5">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F8FAFC] border border-[#2E3192]/10 mb-4 text-xs">
                <Search size={14} className="text-[#8E97B8]" />
                <span className="font-medium text-[#141833]">dental near me</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* Competitors List (5 cols) */}
                <div className="sm:col-span-6 space-y-2 text-left">
                  <div className="p-2.5 rounded-xl bg-[#F4F7FC] border border-[#1FA971]/30 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#1FA971] text-white text-[9px] font-bold flex items-center justify-center">1</span>
                      <span className="text-xs font-bold text-[#141833]">Vance Family Dental</span>
                    </div>
                    <div className="text-[10px] text-[#5A6180]">4.9 ★ (342) · 0.2 km</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#2E3192]/10 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#FFB800] text-white text-[9px] font-bold flex items-center justify-center">2</span>
                      <span className="text-xs font-medium text-[#141833]">SmileCare Clinic</span>
                    </div>
                    <div className="text-[10px] text-[#5A6180]">4.7 ★ (210) · 0.6 km</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#2E3192]/10 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#FFB800] text-white text-[9px] font-bold flex items-center justify-center">3</span>
                      <span className="text-xs font-medium text-[#141833]">Austin Dental Studio</span>
                    </div>
                    <div className="text-[10px] text-[#5A6180]">4.5 ★ (150) · 1.1 km</div>
                  </div>

                  <div className="text-[10px] text-[#2E3192] font-semibold pt-1">
                    View more results →
                  </div>
                </div>

                {/* Radar Mini Map (6 cols) */}
                <div className="sm:col-span-6 relative bg-[#FAFCFF] rounded-2xl h-48 flex items-center justify-center border border-[#2E3192]/10 overflow-hidden">
                  <div className="absolute w-36 h-36 rounded-full border border-[#2E3192]/15 bg-[#2E3192]/5" />
                  <div className="absolute w-24 h-24 rounded-full border border-[#1CB5D6]/25 bg-[#1CB5D6]/10" />
                  <div className="absolute w-12 h-12 rounded-full border border-[#1FA971]/35 bg-[#1FA971]/15" />
                  <div className="relative w-7 h-7 rounded-full bg-[#1FA971] text-white font-extrabold text-xs flex items-center justify-center shadow">
                    1
                  </div>
                  <div className="absolute top-4 left-8 w-5 h-5 rounded-full bg-[#1FA971] text-white text-[10px] font-bold flex items-center justify-center">1</div>
                  <div className="absolute bottom-4 right-8 w-5 h-5 rounded-full bg-[#1CB5D6] text-white text-[10px] font-bold flex items-center justify-center">2</div>
                  <div className="absolute top-8 right-6 w-5 h-5 rounded-full bg-[#FFB800] text-white text-[10px] font-bold flex items-center justify-center">3</div>
                  <div className="absolute bottom-6 left-6 w-5 h-5 rounded-full bg-[#E74C3C] text-white text-[10px] font-bold flex items-center justify-center">7</div>
                </div>
              </div>
            </div>

            {/* Right: Copy & Bullets */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
                See your rank on every street
              </h2>

              <p className="text-base text-[#5A6180] leading-relaxed">
                Geo-grid rank heatmaps, keyword tracking and weekly change alerts — everything you need to dominate your
                local area.
              </p>

              <ul className="space-y-3.5 text-sm sm:text-base text-[#141833]">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#0284C7] shrink-0" />
                  <span className="font-medium">Geo-grid rank heatmaps</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#0284C7] shrink-0" />
                  <span className="font-medium">Track by keyword and location</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#0284C7] shrink-0" />
                  <span className="font-medium">Weekly ranking change alerts</span>
                </li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/rank-tracking"
                  className="px-6 py-3 rounded-full text-white text-sm font-semibold shadow-md inline-flex items-center gap-2 hover:opacity-95 transition"
                  style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
                >
                  <span>Explore rank tracking</span>
                  <ArrowRight size={16} strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Case Study Section (Matching Screenshot) ──────────────────── */}
      <section id="case-studies" className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#2E3192]/15 shadow-xl shadow-[#2E3192]/5 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Dr. Jennifer Vance Photo */}
            <div className="lg:col-span-5 rounded-2xl overflow-hidden shadow-md border border-[#2E3192]/10 bg-[#F4F7FC]">
              <img
                src="/owner-storefront.webp"
                alt="Dr. Jennifer Vance at Vance Family Dental clinic"
                width={600}
                height={480}
                loading="lazy"
                className="w-full h-auto object-cover"
              />
            </div>

            {/* Quote & Author Info */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF6FE] text-[#0284C7] text-xs font-bold uppercase tracking-wider">
                <Star size={12} fill="#0284C7" strokeWidth={1} />
                <span>Verified Case Study</span>
              </div>

              <blockquote className="font-heading font-bold text-xl sm:text-2xl text-[#141833] leading-snug">
                &ldquo;Within three months we moved from page two to the top three on Maps, and phone calls nearly doubled.&rdquo;
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2E3192] text-white font-bold text-xs flex items-center justify-center">
                  JV
                </div>
                <div>
                  <div className="font-heading font-bold text-sm text-[#141833]">Dr. Jennifer Vance</div>
                  <div className="text-xs text-[#5A6180]">Owner, Vance Family Dental</div>
                </div>
              </div>

              {/* Metric Chips */}
              <div className="pt-2 flex flex-wrap gap-3">
                <span className="px-4 py-2 rounded-xl bg-[#1FA971]/10 text-[#1FA971] text-xs font-bold border border-[#1FA971]/20 flex items-center gap-1.5">
                  <Phone size={14} strokeWidth={2} />
                  <span>+112% calls</span>
                </span>
                <span className="px-4 py-2 rounded-xl bg-[#2E3192]/10 text-[#2E3192] text-xs font-bold border border-[#2E3192]/20 flex items-center gap-1.5">
                  <MapPin size={14} strokeWidth={2} />
                  <span>#1 map pack</span>
                </span>
                <span className="px-4 py-2 rounded-xl bg-[#1CB5D6]/15 text-[#0284C7] text-xs font-bold border border-[#1CB5D6]/30 flex items-center gap-1.5">
                  <Star size={14} fill="#0284C7" strokeWidth={1} />
                  <span>+86 reviews</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Section (Matching Screenshot) ─────────────────────── */}
      <section id="pricing" className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
              Pricing
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#5A6180]">
              Transparent plans tailored for single storefronts and growing agencies.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="mt-6 inline-flex items-center gap-1.5 p-1 rounded-full bg-[#F4F7FC] border border-[#2E3192]/10">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${billingCycle === 'monthly' ? 'bg-[#2E3192] text-white shadow-sm' : 'text-[#5A6180] hover:text-[#141833]'
                  }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${billingCycle === 'annual'
                  ? 'text-white shadow-sm'
                  : 'text-[#5A6180] hover:text-[#141833]'
                  }`}
                style={billingCycle === 'annual' ? { background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' } : {}}
              >
                <span>Annual</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#1FA971] text-white text-[9px] font-black uppercase">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch text-left">
            {/* Starter Plan */}
            <div className="bg-white rounded-3xl p-8 border border-[#2E3192]/15 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#2E3192]/10 text-[#2E3192] flex items-center justify-center mb-4">
                  <Compass size={20} strokeWidth={2} />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#141833]">Starter</h3>
                <p className="text-xs text-[#5A6180] mt-1">Single storefront business</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-heading font-extrabold text-4xl text-[#141833]">
                    {billingCycle === 'annual' ? '$23' : '$29'}
                  </span>
                  <span className="text-xs text-[#5A6180]">/mo</span>
                  <span className="text-[11px] text-[#8E97B8] ml-2 font-medium">$29 billed annually</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-xs text-[#5A6180]">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>1 location</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>20 keywords</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>review monitoring</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>monthly report</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/register"
                className="mt-8 w-full py-3 rounded-full bg-[#F4F7FC] hover:bg-[#E8EEFA] text-[#141833] text-xs font-bold text-center transition"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Growth Plan (Most Popular) */}
            <div className="bg-white rounded-3xl p-8 border-2 border-[#1CB5D6] shadow-xl shadow-[#1CB5D6]/10 flex flex-col justify-between relative">
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-sm"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              >
                MOST POPULAR
              </div>

              <div>
                <div className="w-10 h-10 rounded-xl bg-[#1CB5D6]/15 text-[#1CB5D6] flex items-center justify-center mb-4">
                  <ShieldCheck size={20} strokeWidth={2} />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#141833]">Growth</h3>
                <p className="text-xs text-[#5A6180] mt-1">Growing local practices</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-heading font-extrabold text-4xl text-[#141833]">
                    {billingCycle === 'annual' ? '$63' : '$79'}
                  </span>
                  <span className="text-xs text-[#5A6180]">/mo</span>
                  <span className="text-[11px] text-[#8E97B8] ml-2 font-medium">$79 billed annually</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-xs text-[#5A6180]">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span className="font-bold text-[#141833]">5 locations</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>100 keywords</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>citation builder</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>competitor tracking</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>AI posts</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/register"
                className="mt-8 w-full py-3 rounded-full text-white text-xs font-bold text-center shadow-md hover:opacity-95 transition flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              >
                <span>Start Free Trial</span>
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>

            {/* Agency Plan */}
            <div className="bg-white rounded-3xl p-8 border border-[#2E3192]/15 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#6366F1]/15 text-[#6366F1] flex items-center justify-center mb-4">
                  <Building2 size={20} strokeWidth={2} />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#141833]">Agency</h3>
                <p className="text-xs text-[#5A6180] mt-1">Agencies & franchises</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-heading font-extrabold text-4xl text-[#141833]">
                    {billingCycle === 'annual' ? '$159' : '$199'}
                  </span>
                  <span className="text-xs text-[#5A6180]">/mo</span>
                  <span className="text-[11px] text-[#8E97B8] ml-2 font-medium">$199 billed annually</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-xs text-[#5A6180]">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span className="font-bold text-[#141833]">unlimited locations</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>white-label reports</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>team seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-[#1FA971] shrink-0" />
                    <span>priority support</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/register"
                className="mt-8 w-full py-3 rounded-full bg-[#F4F7FC] hover:bg-[#E8EEFA] text-[#141833] text-xs font-bold text-center transition"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ("What our customers say") ───────────────────── */}
      <section className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
              What our customers say
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#5A6180]">
              Real outcomes from owners scaling their local search rank.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Testimonial 1 */}
            <div className="bg-white p-7 rounded-3xl border border-[#2E3192]/15 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex text-[#FFB800] gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#FFB800" strokeWidth={1.5} />
                  ))}
                </div>
                <p className="text-sm text-[#141833] leading-relaxed">
                  &ldquo;<strong className="text-[#141833]">We grew client call volume by 74% in sixty days.</strong> The geo-grid alone sells our retainers.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-[#2E3192]/10">
                <img
                  src="/avatar-1.webp"
                  alt="Marcus Thorne portrait"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="font-heading font-bold text-xs text-[#141833]">Marcus Thorne</div>
                  <div className="text-[11px] text-[#5A6180]">Founder, Apex Digital Agency</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-7 rounded-3xl border border-[#2E3192]/15 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex text-[#FFB800] gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#FFB800" strokeWidth={1.5} />
                  ))}
                </div>
                <p className="text-sm text-[#141833] leading-relaxed">
                  &ldquo;<strong className="text-[#141833]">Our practice jumped into the top 3 on Maps</strong> across twelve target suburbs. Inbound requests doubled.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-[#2E3192]/10">
                <img
                  src="/avatar-2.webp"
                  alt="Sarah Jenkins portrait"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="font-heading font-bold text-xs text-[#141833]">Sarah Jenkins</div>
                  <div className="text-[11px] text-[#5A6180]">Marketing Lead, Austin Wellness</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white p-7 rounded-3xl border border-[#2E3192]/15 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex text-[#FFB800] gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#FFB800" strokeWidth={1.5} />
                  ))}
                </div>
                <p className="text-sm text-[#141833] leading-relaxed">
                  &ldquo;<strong className="text-[#141833]">Managing sixteen service centers saved our team ten hours each week.</strong> Our visibility is at an all-time high.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-[#2E3192]/10">
                <img
                  src="/avatar-3.webp"
                  alt="David Chen portrait"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="font-heading font-bold text-xs text-[#141833]">David Chen</div>
                  <div className="text-[11px] text-[#5A6180]">VP Operations, Metro Auto</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Accordion (2 Columns Matching Screenshot) ─────────────── */}
      <section id="faq" className="py-20 bg-white border-t border-[#2E3192]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm text-[#5A6180]">
              Direct, transparent answers to help you get started.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
            {/* Left FAQ Column */}
            <div className="space-y-4">
              {faqsLeft.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-[#2E3192]/15 bg-white overflow-hidden shadow-2xs transition"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F4F7FC]/50 transition"
                    >
                      <span className="font-heading font-bold text-sm text-[#141833]">{faq.q}</span>
                      <ChevronDown
                        size={17}
                        strokeWidth={1.5}
                        className={`text-[#5A6180] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#2E3192]' : ''
                          }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs text-[#5A6180] leading-relaxed border-t border-[#2E3192]/5 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right FAQ Column */}
            <div className="space-y-4">
              {faqsRight.map((faq, index) => {
                const adjustedIndex = index + 10;
                const isOpen = activeFaq === adjustedIndex;
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-[#2E3192]/15 bg-white overflow-hidden shadow-2xs transition"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? null : adjustedIndex)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F4F7FC]/50 transition"
                    >
                      <span className="font-heading font-bold text-sm text-[#141833]">{faq.q}</span>
                      <ChevronDown
                        size={17}
                        strokeWidth={1.5}
                        className={`text-[#5A6180] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#2E3192]' : ''
                          }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs text-[#5A6180] leading-relaxed border-t border-[#2E3192]/5 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA Band (Gradient with White Button & Microtrust) ──── */}
      <section
        className="py-14 text-white text-left relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
      >
        {/* Subtle Right Dotted Pattern */}
        <div className="absolute right-0 top-0 bottom-0 w-80 opacity-20 bg-[radial-gradient(#FFFFFF_2px,transparent_2px)] bg-[size:16px_16px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              Ready to rank higher in your neighborhood?
            </h2>
            <p className="text-xs sm:text-sm text-white/90 mt-1">
              Join 1,200+ local businesses growing with Rankora.
            </p>
          </div>

          <div className="text-center md:text-right shrink-0">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white text-[#2E3192] text-xs sm:text-sm font-bold shadow-lg hover:bg-[#F4F7FC] transition hover:scale-105 active:scale-95"
            >
              <span>Start Your Free Trial</span>
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <p className="text-[11px] text-white/80 mt-1.5 font-medium">No credit card required</p>
          </div>
        </div>
      </section>

      {/* ── Enterprise Footer (Matching Mockup) ───────────────────────── */}
      <footer className="bg-white text-[#5A6180] py-14 text-xs border-t border-[#2E3192]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8 text-left">
          {/* Brand Col */}
          <div className="col-span-2 space-y-3">
            <Link to="/" className="group focus:outline-none inline-block">
              <RankoraLogo size="sm" showSubtitle={false} />
            </Link>
            <p className="text-xs text-[#5A6180] max-w-sm leading-relaxed">
              Rankora helps local businesses and marketing agencies climb Google Maps and dominate nearby searches.
            </p>
          </div>

          {/* Product Col */}
          <div className="space-y-2.5">
            <h4 className="font-heading font-bold text-[#141833] text-xs">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-[#2E3192] transition">Rank Tracking</a></li>
              <li><a href="#features" className="hover:text-[#2E3192] transition">GBP Manager</a></li>
              <li><a href="#features" className="hover:text-[#2E3192] transition">Review Management</a></li>
              <li><a href="#features" className="hover:text-[#2E3192] transition">Citation Builder</a></li>
              <li><a href="#pricing" className="hover:text-[#2E3192] transition">Pricing Plans</a></li>
            </ul>
          </div>

          {/* Company Col */}
          <div className="space-y-2.5">
            <h4 className="font-heading font-bold text-[#141833] text-xs">Company</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#case-studies" className="hover:text-[#2E3192] transition">Case Studies</a></li>
              <li><a href="#how-it-works" className="hover:text-[#2E3192] transition">About & Metrics</a></li>
              <li><Link to="/register" className="hover:text-[#2E3192] transition">Agency Partner Program</Link></li>
            </ul>
          </div>

          {/* Resources & Socials Col */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-[#141833] text-xs">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#faq" className="hover:text-[#2E3192] transition">Help</a></li>
              <li><Link to="/login" className="hover:text-[#2E3192] transition">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-[#2E3192] transition">Start Free Trial</Link></li>
            </ul>

            {/* Social Icons */}
            <div className="pt-2 flex items-center gap-2 text-[#5A6180]">
              <a href="#" className="w-7 h-7 rounded-full bg-[#F4F7FC] hover:bg-[#2E3192] hover:text-white flex items-center justify-center transition" aria-label="LinkedIn">
                <Linkedin size={13} strokeWidth={2} />
              </a>
              <a href="#" className="w-7 h-7 rounded-full bg-[#F4F7FC] hover:bg-[#2E3192] hover:text-white flex items-center justify-center transition" aria-label="Twitter">
                <Twitter size={13} strokeWidth={2} />
              </a>
              <a href="#" className="w-7 h-7 rounded-full bg-[#F4F7FC] hover:bg-[#2E3192] hover:text-white flex items-center justify-center transition" aria-label="Instagram">
                <Instagram size={13} strokeWidth={2} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-[#2E3192]/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#8E97B8]">
          <div>
            &copy; 2026 Rankora by Agumentik Software Private Limited. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-[#2E3192] transition">Terms of Service</Link>
            <span>&bull;</span>
            <Link to="/privacy" className="hover:text-[#2E3192] transition">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

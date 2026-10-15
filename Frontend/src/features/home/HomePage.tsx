import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Search,
  CheckCircle2,
  TrendingUp,
  Layers,
  ArrowRight,
  Globe2,
  MessageSquare,
  Cpu,
  Zap,
  ChevronRight,
  ChevronDown,
  Flame,
  Check,
  Sparkles,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'sunflower' | 'audit' | 'reviews' | 'competitors'>('sunflower');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // ROI Calculator State
  const [monthlyCustomers, setMonthlyCustomers] = useState(120);
  const [customerValue, setCustomerValue] = useState(75);
  const estimatedRevenueBoost = Math.round(monthlyCustomers * 0.45 * customerValue * 12);

  const sampleSuggestions = [
    'BLK-Max Super Speciality Hospital, Delhi',
    'Tress Trends Unisex Salon, Delhi',
    'Blue Tokai Coffee, Connaught Place',
    'Apollo Clinic, Gurgaon Sector 14',
  ];

  const handleSearchSubmit = (query?: string) => {
    const target = query || searchQuery;
    if (!target) return;
    if (isAuthenticated) {
      navigate(`/locations/add?search=${encodeURIComponent(target)}`);
    } else {
      navigate(`/register?search=${encodeURIComponent(target)}`);
    }
  };

  const faqs = [
    {
      q: 'Do I need access or login credentials for the Google Business Profile?',
      a: 'No. Rankora works completely without Google OAuth or owner credentials. You can audit, map, track, and benchmark any public Google Maps business profile in the world simply by searching its name or address.',
    },
    {
      q: 'How does the Sunflower Multi-Ring Geo-Grid work?',
      a: 'Our sunflower algorithm simulates local Google Maps queries across concentric rings radiating outward from the business center (covering 5 km to 25 km). It pinpoints your exact rank position across surrounding neighborhoods, suburbs, and regional towns.',
    },
    {
      q: 'Are the rankings and reviews real live Google data?',
      a: 'Yes, 100%. All rank scans and customer reviews are queried live directly from Google Maps Local Pack SERPs via SerpApi with authentic rankings, real star ratings, customer review text, and competitor data.',
    },
    {
      q: 'Can I track and audit direct competitors?',
      a: 'Yes. You can add any competitor to your dashboard, compare keyword visibility side-by-side, view their category taxonomy, and uncover the exact gaps keeping you out of the Top 3.',
    },
    {
      q: 'What is included in the 1,000 free scan credits?',
      a: 'New workspaces receive 1,000 scan credits automatically upon sign-up. Each multi-ring sunflower regional scan uses just 4 credits, giving you hundreds of complete regional position maps right out of the box.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden antialiased">
      {/* ── Top Announcement Banner ───────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-b border-blue-100/80 px-4 py-2 text-center text-xs font-semibold text-blue-950 flex items-center justify-center gap-2 relative z-50">
        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-xs">
          <Sparkles size={10} /> New
        </span>
        <span className="text-slate-700">Localo-style Multi-Ring Sunflower Coverage Maps are now live worldwide!</span>
        <a href="#sunflower-maps" className="text-blue-600 hover:text-blue-800 underline underline-offset-2 transition font-bold inline-flex items-center gap-0.5 ml-1">
          View Demo <ChevronRight size={12} />
        </a>
      </div>

      {/* ── Main Navigation Bar ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              R
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-slate-900">
                Rankora<span className="text-blue-600">.</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-[10px] font-black text-blue-700 uppercase tracking-wider border border-blue-200">
                PRO
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition">Features</a>
            <a href="#interactive-demo" className="hover:text-blue-600 transition">Live Studio</a>
            <a href="#calculator" className="hover:text-blue-600 transition">ROI Calculator</a>
            <a href="#pricing" className="hover:text-blue-600 transition">Pricing</a>
            <a href="#faq" className="hover:text-blue-600 transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:shadow-blue-600/35 transition flex items-center gap-1.5"
                >
                  <span>Start Free Audit</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className="relative pt-14 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-slate-50/70 via-white to-white">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-100/60 via-indigo-50/40 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-700 text-xs font-bold mb-6 shadow-xs">
            <Flame size={14} className="text-amber-500 fill-amber-500" />
            <span>Outrank #1 Competitors on Google Maps in 30 Days</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.14]">
            Dominate Google Local Pack with{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              Sunflower Heatmaps & AI.
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Multi-ring regional position maps, automated 5-pillar SEO audits, public review intelligence, and step-by-step checklists for any local business on Earth.
          </p>

          {/* Search Audit Form */}
          <div className="mt-8 max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSubmit();
              }}
              className="relative flex items-center p-2 rounded-2xl bg-white border border-slate-300 focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/20 shadow-xl shadow-slate-200/60 transition"
            >
              <div className="pl-3 pr-2 text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter any business name or Google Maps location..."
                className="w-full py-2 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Audit Free</span>
                <ArrowRight size={14} />
              </button>
            </form>

            {/* Clickable Quick Autocomplete Suggestions */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
              <span className="font-bold text-slate-400">Try searching:</span>
              {sampleSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setSearchQuery(suggestion);
                    handleSearchSubmit(suggestion);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition font-medium cursor-pointer truncate max-w-[220px]"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Trust Points */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-600" /> Real Google SERPs</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-600" /> No Google Login Needed</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-600" /> 1,000 Free Credits</span>
            </div>
          </div>

          {/* Hero Realistic Localo Browser Mockup Window */}
          <div className="mt-12 max-w-5xl mx-auto rounded-2xl border border-slate-300/80 bg-white shadow-2xl shadow-slate-300/60 overflow-hidden text-left">
            {/* Browser Header Bar */}
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>

              <div className="flex items-center gap-2 px-4 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 font-mono w-80 justify-center shadow-2xs">
                <span className="text-emerald-600 font-bold">https://</span>
                <span className="text-slate-700">rankora.app/rank-tracking</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live SERP Data</span>
              </div>
            </div>

            {/* Split Screen App Interface */}
            <div className="grid grid-cols-1 md:grid-cols-12 bg-white text-slate-900 min-h-[420px]">
              {/* Left Sidebar */}
              <div className="md:col-span-4 p-4 bg-slate-50/80 border-r border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Keywords Pill Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Tracked Keywords</span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs">
                        hospital in delhi private
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-xs shadow-2xs">
                        hospital near me
                      </span>
                    </div>
                  </div>

                  {/* Target Profile Card */}
                  <div className="p-3.5 rounded-xl bg-white border border-blue-200 shadow-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">R</span>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">BLK-Max Super Speciality</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] border border-emerald-200">
                        RANK #1
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">Pusa Rd, Rajinder Nagar, New Delhi</p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Visibility: <strong className="text-blue-600 font-bold">94.8%</strong></span>
                      <span className="text-slate-600 font-medium">Rating: <strong className="text-amber-500 font-bold">4.9★ (8.8k)</strong></span>
                    </div>
                  </div>

                  {/* Competitor Mini Pack */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Top Competitors</span>
                    <div className="space-y-1.5">
                      <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center">1</span>
                          <span className="font-bold text-slate-800 truncate max-w-[130px]">BLK-Max Hospital</span>
                        </div>
                        <span className="font-bold text-amber-500">4.9★</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 font-extrabold text-[10px] flex items-center justify-center">2</span>
                          <span className="font-medium text-slate-700 truncate max-w-[130px]">Max Hospital Saket</span>
                        </div>
                        <span className="text-slate-500">4.7★</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>Area Difficulty: <strong className="text-emerald-600 font-bold">LOW</strong></span>
                  <span className="text-blue-600 font-bold">31 Map Points</span>
                </div>
              </div>

              {/* Right Map Preview Area */}
              <div className="md:col-span-8 relative bg-[#f8fafc] overflow-hidden min-h-[340px] flex items-center justify-center">
                {/* Simulated Clean Light Vector Map Grid */}
                <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:40px_40px]" />

                {/* Simulated City Labels */}
                <span className="absolute top-8 left-12 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Karol Bagh</span>
                <span className="absolute bottom-8 left-16 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Pusa Road</span>
                <span className="absolute top-10 right-14 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Connaught Place</span>
                <span className="absolute bottom-10 right-14 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Rajinder Nagar</span>

                {/* Floating Date Navigator */}
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 flex items-center gap-2 backdrop-blur-xs z-10">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Live Regional Grid · 15 km Radius</span>
                </div>

                {/* Concentric Sunflower Heatmap Auras */}
                <div className="absolute w-[290px] h-[290px] rounded-full bg-rose-500/10 border border-rose-400/20" />
                <div className="absolute w-[200px] h-[200px] rounded-full bg-amber-500/15 border border-amber-400/30" />
                <div className="absolute w-[120px] h-[120px] rounded-full bg-emerald-500/25 border border-emerald-400/40" />

                {/* Rank Badges Across Concentric Rings */}
                {/* Center Node */}
                <div className="relative z-10 w-10 h-10 rounded-full bg-emerald-500 text-white font-black text-sm flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition">
                  1
                </div>

                {/* Ring 1 Inner Nodes */}
                <div className="absolute top-[38%] left-[40%] w-7 h-7 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  2
                </div>
                <div className="absolute bottom-[38%] right-[40%] w-7 h-7 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  1
                </div>
                <div className="absolute top-[44%] left-[34%] w-7 h-7 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  3
                </div>
                <div className="absolute top-[44%] right-[34%] w-7 h-7 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  4
                </div>

                {/* Ring 2 Middle Nodes */}
                <div className="absolute top-[28%] left-[32%] w-7 h-7 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  6
                </div>
                <div className="absolute bottom-[28%] right-[32%] w-7 h-7 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  8
                </div>
                <div className="absolute top-[50%] left-[24%] w-7 h-7 rounded-full bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  12
                </div>
                <div className="absolute top-[50%] right-[24%] w-7 h-7 rounded-full bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  14
                </div>

                {/* Ring 3 Outer Nodes */}
                <div className="absolute top-[16%] left-[20%] px-2.5 py-0.5 rounded-full bg-[#881337] text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs border border-white">
                  20+
                </div>
                <div className="absolute bottom-[16%] right-[20%] px-2.5 py-0.5 rounded-full bg-[#881337] text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs border border-white">
                  20+
                </div>
                <div className="absolute top-[18%] right-[20%] w-7 h-7 rounded-full bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs border-2 border-white">
                  18
                </div>
                <div className="absolute bottom-[18%] left-[20%] px-2.5 py-0.5 rounded-full bg-[#881337] text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs border border-white">
                  20+
                </div>

                {/* Floating Bottom Info Tag */}
                <div className="absolute bottom-3 left-4 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-xs">
                  15 km Multi-Ring Regional Coverage
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof & Metrics Counter Bar ────────────────────────── */}
      <section className="py-12 border-y border-slate-200/80 bg-slate-50/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">2,400,000+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Google Ranks Tracked
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-blue-600">850,000+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                5-Pillar Audits Run
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">99.4%</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                SERP Accuracy
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-500">14,200+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Active Businesses
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6 Core Feature Grid ───────────────────────────────────────── */}
      <section id="features" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-xs font-extrabold tracking-widest uppercase text-blue-600">Platform Capabilities</h2>
          <p className="mt-2 text-3xl font-black text-slate-900">
            The Complete Local SEO Engine
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Audit, track, and outrank without needing Google OAuth or credentials.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div id="sunflower-maps" className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition duration-200 space-y-3 group">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-105 transition">
              <Layers size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Sunflower Geo-Grid Heatmaps</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Multi-ring radial coverage capturing the target center and surrounding towns from 5 km up to 25 km with soft aura heatmaps and exact rankings.
            </p>
          </div>

          {/* Card 2 */}
          <div id="seo-audit" className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/5 transition duration-200 space-y-3 group">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition">
              <Cpu size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">5-Pillar Automated Audits</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instant audit analyzing Profile Completeness, Keyword Density, Review Health, Media/Photos, and Citations with a step-by-step checklist.
            </p>
          </div>

          {/* Card 3 */}
          <div id="reviews-ai" className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/5 transition duration-200 space-y-3 group">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 group-hover:scale-105 transition">
              <MessageSquare size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Live Reviews & AI Reply Studio</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ingest real Google customer reviews, sentiment categorization, and 1-click AI review replies packed with local ranking keywords.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/5 transition duration-200 space-y-3 group">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-105 transition">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Competitor Gap Intelligence</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Benchmark side-by-side against the top 3 leaders in your city to uncover winning primary categories, review velocities, and visibility advantages.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5 transition duration-200 space-y-3 group">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-105 transition">
              <Globe2 size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Global Business Discovery</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Add and analyze any business anywhere on Earth by name or address. No authorization or verification required.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/5 transition duration-200 space-y-3 group">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:scale-105 transition">
              <Zap size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Live SERP Provider Ingestion</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Real-time Google Maps Local Pack data via SerpApi with automated credit replenishment so your scans are always active and authentic.
            </p>
          </div>
        </div>
      </section>

      {/* ── Interactive Tabs Section ──────────────────────────────────── */}
      <section id="interactive-demo" className="py-20 bg-slate-50/80 border-t border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-extrabold tracking-widest uppercase text-blue-600">Interactive Studio</h2>
            <p className="mt-2 text-3xl font-black text-slate-900">
              Explore the Growth Workflows
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-xl mx-auto">
            {[
              { key: 'sunflower', label: 'Sunflower Maps', icon: Layers },
              { key: 'audit', label: '5-Pillar Audit', icon: Cpu },
              { key: 'reviews', label: 'Review AI Studio', icon: MessageSquare },
              { key: 'competitors', label: 'Competitor Intel', icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="mt-10 rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 p-8">
            {activeTab === 'sunflower' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                    <Layers size={12} /> Concentric Radial Coverage
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Multi-Ring Sunflower Position Heatmaps
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Scans the target center, inner neighborhood, middle district, and outer regional suburbs (5 km to 25 km) to show where customers actually find you.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    <li className="flex items-center gap-2">
                      <Check size={15} className="text-emerald-600 shrink-0" /> Translucent aura circles showing localized ranking intensity.
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={15} className="text-emerald-600 shrink-0" /> Dark burgundy 20+ badges for out-of-top-20 expansion zones.
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={15} className="text-emerald-600 shrink-0" /> Real-time coordinate pins with live SERP query results.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-200 pb-3">
                    <span>Node (1, 3) · 3.5 km Radius</span>
                    <span className="text-emerald-600 font-extrabold">Rank #2 in Local Pack</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-black text-xs flex items-center justify-center">1</span>
                        <span className="text-xs font-bold text-slate-900">Your Target Business</span>
                      </div>
                      <span className="text-xs font-bold text-amber-500">4.9 ★ (840)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">2</span>
                        <span className="text-xs font-bold text-slate-800">City Medical Centre</span>
                      </div>
                      <span className="text-xs font-bold text-amber-500">4.6 ★ (320)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                    <Cpu size={12} /> 5-Pillar Analysis
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Automated SEO Audits & Growth Tasks
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Audits Profile Completeness, Keyword Density, Review Velocity, Photos/Media, and NAP Citations with exact instructions on what to change on Google.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-3 shadow-2xs">
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px] shrink-0 border border-rose-200">HIGH</span>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">Add Secondary Category &quot;Emergency Care Service&quot;</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">Top 3 competitors have this category configured.</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-3 shadow-2xs">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px] shrink-0 border border-amber-200">MEDIUM</span>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">Include Target Keyword &quot;Private Hospital Delhi&quot; in Description</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">Boosts search keyword density score by +18%.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
                    <MessageSquare size={12} /> AI Reply Studio
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Live Reviews & AI SEO Replies
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Ingest real customer reviews, analyze sentiment, and generate 1-click replies enriched with local SEO keywords.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">Rohit Sharma</span>
                      <span className="text-amber-500 font-bold">5.0 ★</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      &quot;Best hospital in Delhi NCR! The doctors and nursing staff took extraordinary care of my father.&quot;
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase text-purple-700">AI Drafted Reply (Keyword-Optimized)</span>
                    <p className="text-xs text-slate-800">
                      &quot;Thank you Rohit for choosing BLK-Max as your private hospital in Delhi. Glad your father received great care!&quot;
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'competitors' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                    <TrendingUp size={12} /> Competitive Intelligence
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Local Competitor Gap Analysis
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    See the exact competitors outranking you across the city with side-by-side reviews, ratings, and visibility comparisons.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2 text-xs">
                  <div className="grid grid-cols-3 font-bold text-slate-500 border-b border-slate-200 pb-2 text-xs">
                    <span>Business</span>
                    <span className="text-center">Reviews</span>
                    <span className="text-right">Visibility</span>
                  </div>
                  <div className="grid grid-cols-3 items-center py-2 font-bold text-slate-900 border-b border-slate-200 text-xs">
                    <span className="truncate">1. BLK-Max Hospital</span>
                    <span className="text-center text-amber-500">4.9 ★ (8.8k)</span>
                    <span className="text-right text-emerald-600">94.8%</span>
                  </div>
                  <div className="grid grid-cols-3 items-center py-2 text-slate-600 text-xs">
                    <span className="truncate">2. Max Hospital Saket</span>
                    <span className="text-center">4.7 ★ (6.2k)</span>
                    <span className="text-right">88.2%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Interactive ROI Calculator ────────────────────────────────── */}
      <section id="calculator" className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-xs font-extrabold tracking-widest uppercase text-blue-600">Revenue Impact</h2>
            <p className="mt-2 text-3xl font-black text-slate-900">
              Calculate Your Local SEO ROI
            </p>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Businesses moving into the Google Maps Top 3 see an average +45% increase in calls and foot traffic.
            </p>
          </div>

          <div className="mt-10 p-8 rounded-3xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 items-center shadow-xl shadow-slate-200/50">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 mb-2">
                  <span>Current Monthly Customers / Calls</span>
                  <span className="text-blue-600 font-black text-base">{monthlyCustomers}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={monthlyCustomers}
                  onChange={(e) => setMonthlyCustomers(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 mb-2">
                  <span>Average Customer Value ($)</span>
                  <span className="text-blue-600 font-black text-base">${customerValue}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={customerValue}
                  onChange={(e) => setCustomerValue(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-center space-y-2 shadow-xl shadow-blue-600/20">
              <div className="text-xs uppercase font-bold tracking-wider text-blue-100">
                Estimated Annual Revenue Increase
              </div>
              <div className="text-4xl font-black text-white tracking-tight">
                +${estimatedRevenueBoost.toLocaleString()}
              </div>
              <p className="text-xs text-blue-100">
                Based on moving from unranked to Top 3 in your primary service zone.
              </p>
              <Link
                to="/register"
                className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-blue-700 text-xs font-bold shadow-md transition"
              >
                Claim Your Growth Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Tiers ─────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-xs font-extrabold tracking-widest uppercase text-blue-600">Predictable Pricing</h2>
          <p className="mt-2 text-3xl font-black text-slate-900">
            Plans for Single Businesses & Agencies
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Starter</h3>
              <p className="text-xs text-slate-500 mt-1">Single local business owner.</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">$29</span>
                <span className="text-xs text-slate-500">/mo</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> 1 Business Profile</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> 200 Scan Credits / mo</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Sunflower Regional Heatmaps</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> 5-Pillar SEO Audits</li>
              </ul>
            </div>
            <Link
              to="/register"
              className="mt-8 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold text-center transition"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Growth Agency */}
          <div className="p-7 rounded-3xl bg-white border-2 border-blue-600 flex flex-col justify-between relative shadow-xl shadow-blue-600/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
              Most Popular
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Growth Agency</h3>
              <p className="text-xs text-slate-500 mt-1">Marketing consultants & agencies.</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">$79</span>
                <span className="text-xs text-slate-500">/mo</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> 10 Business Profiles</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> 1,000 Scan Credits / mo</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> AI Review Reply Studio</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Competitor Gap Intelligence</li>
              </ul>
            </div>
            <Link
              to="/register"
              className="mt-8 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center shadow-md shadow-blue-600/25 transition"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Enterprise */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Enterprise Scale</h3>
              <p className="text-xs text-slate-500 mt-1">Multi-location franchise brands.</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">$199</span>
                <span className="text-xs text-slate-500">/mo</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Unlimited Profiles</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> 5,000 Scan Credits / mo</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> White-Label PDF Export</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Multi-Seat Team Access</li>
              </ul>
            </div>
            <Link
              to="/register"
              className="mt-8 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold text-center transition"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ Accordion ─────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-slate-50/80 border-t border-slate-200/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xs font-extrabold tracking-widest uppercase text-blue-600">Got Questions?</h2>
            <p className="mt-2 text-3xl font-black text-slate-900">Frequently Asked Questions</p>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden transition"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-5 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="text-sm font-bold text-slate-900">{faq.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>



      {/* ── Compact Enterprise Footer ─────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-slate-950 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-sm">
                R
              </div>
              <span className="text-base font-black tracking-tight text-white">
                Rankora<span className="text-blue-500">.</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              The next-generation Local SEO platform providing multi-ring sunflower heatmaps, 5-pillar audits, and AI review automation.
            </p>
            <div className="text-xs text-slate-500">
              © {new Date().getFullYear()} Rankora Intelligence Inc. All rights reserved.
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-xs">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#sunflower-maps" className="hover:text-white transition">Sunflower Heatmaps</a></li>
              <li><a href="#seo-audit" className="hover:text-white transition">5-Pillar Audits</a></li>
              <li><a href="#reviews-ai" className="hover:text-white transition">AI Review Replies</a></li>
              <li><a href="#interactive-demo" className="hover:text-white transition">Competitor Intel</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-xs">Solutions</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/register" className="hover:text-white transition">For Local Agencies</Link></li>
              <li><Link to="/register" className="hover:text-white transition">For Multi-Location Brands</Link></li>
              <li><Link to="/register" className="hover:text-white transition">For Franchise Networks</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-xs">Account</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/login" className="hover:text-white transition">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-white transition">Start Free Trial</Link></li>
              <li><Link to="/dashboard" className="hover:text-white transition">Dashboard</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

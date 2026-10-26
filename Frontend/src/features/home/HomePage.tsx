import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { RankoraLogo } from '../../components/ui/RankoraLogo';

interface AnimatedStatProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}

const AnimatedStat: React.FC<AnimatedStatProps> = ({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  duration = 1600,
}) => {
  const [displayValue, setDisplayValue] = useState(
    decimals > 0 ? (0).toFixed(decimals) : '0'
  );
  const ref = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !animatedRef.current) {
          animatedRef.current = true;
          const startTime = performance.now();

          const updateCounter = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic easing for smooth deceleration
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentNumber = easeOut * value;

            setDisplayValue(currentNumber.toFixed(decimals));

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            } else {
              setDisplayValue(value.toFixed(decimals));
            }
          };

          requestAnimationFrame(updateCounter);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [value, decimals, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
};
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
  ChevronLeft,
  ChevronRight,
  Quote,
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
  const [testimonialSlide, setTestimonialSlide] = useState(0);
  const [isTestimonialHovered, setIsTestimonialHovered] = useState(false);

  const testimonials = [
    {
      id: 1,
      name: 'Marcus Thorne',
      role: 'Founder & CEO',
      company: 'Apex Digital Agency',
      location: 'Austin, TX',
      metric: '+74% Call Volume',
      metricBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      avatar: '/testimonials/marcus.jpg',
      stars: 5,
      headline: 'We grew client call volume by 74% in sixty days.',
      quote:
        'The geo-grid scan alone sells our monthly agency retainers. Clients instantly see why their competitors outrank them pin-by-pin and approve our optimization roadmaps on the spot without hesitation.',
      verifiedType: 'Verified Agency Partner',
      managedLocations: '14 Client Profiles',
    },
    {
      id: 2,
      name: 'Dr. Elena Rostova',
      role: 'Clinic Director',
      company: 'Dental Excellence Clinic',
      location: 'Seattle, WA',
      metric: '#1 on Google Maps',
      metricBg: 'bg-blue-50 text-[#2E3192] border-blue-200/80',
      avatar: '/testimonials/elena.jpg',
      stars: 5,
      headline: 'Our practice jumped into the top 3 on Maps across twelve suburbs.',
      quote:
        'Rankora’s AI Review Copilot saves our front desk 2 hours every day while generating thoughtful, HIPAA-conscious replies. New patient inbound calls from Google Maps doubled within two months.',
      verifiedType: 'Verified Healthcare Listing',
      managedLocations: '2 Practice Locations',
    },
    {
      id: 3,
      name: 'David Chen',
      role: 'VP Operations',
      company: 'Metro Auto Services Group',
      location: 'Chicago, IL',
      metric: '10 hrs saved / week',
      metricBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      avatar: '/testimonials/david.jpg',
      stars: 5,
      headline: 'Managing sixteen service centers saved our team ten hours each week.',
      quote:
        'Multi-location visibility was a continuous nightmare before Rankora. The automated 17-point audit keeps every service center 100% compliant, active, and consistently ranking at the top.',
      verifiedType: 'Multi-Location Enterprise',
      managedLocations: '16 Centers Managed',
    },
    {
      id: 4,
      name: 'Sarah Jenkins',
      role: 'Marketing Lead',
      company: 'Austin Wellness & Longevity',
      location: 'Austin, TX',
      metric: '3.2x Walk-in Bookings',
      metricBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      avatar: '/testimonials/sarah.jpg',
      stars: 5,
      headline: 'Dominated high-intent wellness searches within forty-five days.',
      quote:
        'The competitor gap analysis pinpointed the exact missing categories and attributes holding us back. Once updated, our walk-in appointments hit an all-time company record.',
      verifiedType: 'Verified Business Owner',
      managedLocations: '1 Flagship Facility',
    },
    {
      id: 5,
      name: 'Liam Gallagher',
      role: 'Owner & Operator',
      company: 'Liam’s HVAC Solutions',
      location: 'Denver, CO',
      metric: '$120K Inbound Pipeline',
      metricBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      avatar: '/testimonials/liam.jpg',
      stars: 5,
      headline: 'Emergency service calls skyrocketed directly from local Maps pins.',
      quote:
        'During our freezing season, the heatmap showed us ranking poorly in high-income suburbs just 3 miles away. Fixing citations and keyword signals generated over $120,000 in booked furnace jobs.',
      verifiedType: 'Licensed Contractor',
      managedLocations: 'Denver Metro Area',
    },
    {
      id: 6,
      name: 'Priya Sharma',
      role: 'Founder & Managing Director',
      company: 'Saffron & Spice Hospitality',
      location: 'San Francisco, CA',
      metric: '4.9★ Average Rating',
      metricBg: 'bg-purple-50 text-purple-700 border-purple-200/80',
      avatar: '/testimonials/priya.jpg',
      stars: 5,
      headline: 'Turned our review reputation into our strongest dining attraction.',
      quote:
        'Negative review alerts reach our general managers within minutes so issues are solved before guests walk out. Our rating climbed from 4.2 to 4.9 across all three downtown restaurant locations.',
      verifiedType: 'Verified Restaurant Group',
      managedLocations: '3 Prime Venues',
    },
  ];

  const totalTestimonialSlides = Math.ceil(testimonials.length / 3);

  useEffect(() => {
    if (isTestimonialHovered) return;
    const interval = setInterval(() => {
      setTestimonialSlide((prev) => (prev + 1) % totalTestimonialSlides);
    }, 6000);
    return () => clearInterval(interval);
  }, [isTestimonialHovered, totalTestimonialSlides]);

  const timelineSteps = [
    {
      step: 1,
      phase: 'Phase 1 • Setup',
      title: 'Connect or Search',
      subtitle: 'Instant Profile Link',
      description:
        'Link your Google Business Profile via 1-click OAuth, or enter any business name or Google Maps Place ID to track immediately without API limits.',
      color: 'bg-[#2E3192]',
      border: 'border-[#2E3192]',
      badge: 'bg-[#2E3192]/10 text-[#2E3192]',
      glow: 'shadow-[#2E3192]/25',
    },
    {
      step: 2,
      phase: 'Phase 2 • Audit',
      title: '17-Point Audit',
      subtitle: 'Listing Diagnosis',
      description:
        'Rankora instantly audits 17 ranking factors—categories, NAP consistency, hours, photo volume, and citations—scoring your listing readiness.',
      color: 'bg-[#0284C7]',
      border: 'border-[#0284C7]',
      badge: 'bg-[#0284C7]/10 text-[#0284C7]',
      glow: 'shadow-[#0284C7]/25',
    },
    {
      step: 3,
      phase: 'Phase 3 • Heatmap',
      title: 'GeoGrid Scan',
      subtitle: 'Street-Level Pins',
      description:
        'Run 9, 25, or 49-pin local heatmaps across your target radius. Uncover your true Average Rank (ATRP) and Share of Local Voice (SoLV) street-by-street.',
      color: 'bg-[#7C3AED]',
      border: 'border-[#7C3AED]',
      badge: 'bg-[#7C3AED]/10 text-[#7C3AED]',
      glow: 'shadow-[#7C3AED]/25',
    },
    {
      step: 4,
      phase: 'Phase 4 • Rivalry',
      title: 'Competitor Matrix',
      subtitle: 'Top 20 Benchmark',
      description:
        'Mine the top 20 Google Maps rivals. Reveal exactly how many 5-star reviews, citations, or category adjustments are required to overtake the #1 rank.',
      color: 'bg-[#E11D48]',
      border: 'border-[#E11D48]',
      badge: 'bg-[#E11D48]/10 text-[#E11D48]',
      glow: 'shadow-[#E11D48]/25',
    },
    {
      step: 5,
      phase: 'Phase 5 • Copilot',
      title: 'AI Reviews & Posts',
      subtitle: 'Autonomous CRM',
      description:
        'Generate AI review replies in 3 tones (Professional, Friendly, Empathetic). Real-time negative review alerts safeguard your reputation instantly.',
      color: 'bg-[#F59E0B]',
      border: 'border-[#F59E0B]',
      badge: 'bg-[#F59E0B]/10 text-[#D97706]',
      glow: 'shadow-[#F59E0B]/25',
    },
    {
      step: 6,
      phase: 'Phase 6 • Growth',
      title: 'Rank Dominance',
      subtitle: 'Top 3-Pack Lock',
      description:
        'Automated weekly scans track rank climbs, flag sudden competitor movements, and deliver proactive tasks to keep your business in the Top 3.',
      color: 'bg-[#10B981]',
      border: 'border-[#10B981]',
      badge: 'bg-[#10B981]/10 text-[#059669]',
      glow: 'shadow-[#10B981]/25',
    },
  ];

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

            {/* ── Real Geo-Grid Dashboard Showcase Window ──── */}
            <div className="pt-10 sm:pt-14 w-full max-w-5xl mx-auto">
              <div className="relative rounded-2xl sm:rounded-3xl border border-[#2E3192]/20 bg-slate-900 shadow-2xl shadow-[#2E3192]/25 overflow-hidden ring-1 ring-black/5">
                {/* Window Chrome Header */}
                <div className="px-4 py-3 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    </div>
                    <span className="text-slate-600 ml-1">|</span>
                    <span className="font-heading font-bold text-xs text-slate-200 ml-1">Rankora Live Geo-Grid Platform</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 shadow-2xs">
                    <Search size={11} className="text-[#1CB5D6]" />
                    <span className="font-medium text-white">Best Coffee Shops Near Me</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-emerald-400 font-semibold">13x13 Grid (169 Pins)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10.5px] font-semibold border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Scan Active
                    </span>
                  </div>
                </div>

                {/* Real High-Resolution Geo-Grid Dashboard Screenshot */}
                <div className="relative bg-slate-950 overflow-hidden">
                  <img
                    src="/rankora-real-geogrid.jpg"
                    alt="Rankora Live Geo-Grid Rank Tracker Interface showing real Google Maps local ranking pins and competitor analytics"
                    width={1920}
                    height={1080}
                    className="w-full h-auto object-cover block"
                    loading="eager"
                  />
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

      {/* ── Stats Section (Cardless, Compact & Running Animated Numbers) ───────────────── */}
      <section className="py-10 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 items-center text-center">
            {/* Stat 1 - Visibility */}
            <div className="flex flex-col items-center group">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, rgba(46, 49, 146, 0.12) 0%, rgba(28, 181, 214, 0.18) 100%)' }}
              >
                <TrendingUp size={20} strokeWidth={2.2} className="text-[#2E3192]" />
              </div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#141833] tracking-tight">
                <AnimatedStat value={3.2} decimals={1} suffix="x" />
              </div>
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6180]">
                more local visibility
              </p>
              <div
                className="mt-3.5 w-12 sm:w-14 h-[3px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              />
            </div>

            {/* Stat 2 - Calls */}
            <div className="flex flex-col items-center group">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, rgba(46, 49, 146, 0.12) 0%, rgba(28, 181, 214, 0.18) 100%)' }}
              >
                <Phone size={20} strokeWidth={2.2} className="text-[#1CB5D6]" />
              </div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#141833] tracking-tight">
                <AnimatedStat value={68} decimals={0} suffix="%" />
              </div>
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6180]">
                more calls from Google
              </p>
              <div
                className="mt-3.5 w-12 sm:w-14 h-[3px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              />
            </div>

            {/* Stat 3 - Rating */}
            <div className="flex flex-col items-center group">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, rgba(46, 49, 146, 0.12) 0%, rgba(28, 181, 214, 0.18) 100%)' }}
              >
                <Star size={20} fill="#2E3192" strokeWidth={2} className="text-[#2E3192]" />
              </div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#141833] tracking-tight">
                <AnimatedStat value={4.8} decimals={1} suffix="★" />
              </div>
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6180]">
                average review rating
              </p>
              <div
                className="mt-3.5 w-12 sm:w-14 h-[3px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              />
            </div>

            {/* Stat 4 - Speed */}
            <div className="flex flex-col items-center group">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, rgba(46, 49, 146, 0.12) 0%, rgba(28, 181, 214, 0.18) 100%)' }}
              >
                <Calendar size={20} strokeWidth={2.2} className="text-[#1CB5D6]" />
              </div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#141833] tracking-tight">
                <AnimatedStat value={14} decimals={0} suffix=" days" />
              </div>
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#5A6180]">
                to first ranking gains
              </p>
              <div
                className="mt-3.5 w-12 sm:w-14 h-[3px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #2E3192 0%, #1CB5D6 100%)' }}
              />
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

      {/* ── How It Works (Connected Horizontal Timeline Journey) ───────── */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-white via-[#F8FAFC] to-white border-t border-[#2E3192]/10 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-[#2E3192]/5 blur-3xl pointer-events-none -z-10 rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2E3192]/5 border border-[#2E3192]/15 text-[#2E3192] text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles size={13} className="text-[#1CB5D6]" />
              <span>TIMELINE • THE 6-STEP BLUEPRINT</span>
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
              The Journey to Google Maps Top 3
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5A6180] leading-relaxed">
              From initial profile connection to automated neighborhood dominance — here is how Rankora scales your local search revenue.
            </p>
          </div>

          {/* Desktop Connected Horizontal Timeline (lg and up) */}
          <div className="hidden lg:block relative pt-4 pb-8">
            {/* The Connecting Track Line running behind circles */}
            <div className="absolute top-[38px] left-[5%] right-[5%] h-[3px] bg-gradient-to-r from-[#2E3192] via-[#0284C7] via-[#7C3AED] via-[#E11D48] via-[#F59E0B] to-[#10B981] rounded-full z-0 opacity-40 shadow-sm" />

            <div className="grid grid-cols-6 gap-4 relative z-10">
              {timelineSteps.map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center group">
                  {/* Number Circle Badge on the timeline */}
                  <div
                    className={`w-14 h-14 rounded-full ${item.color} text-white font-heading font-black text-lg flex items-center justify-center shadow-lg ${item.glow} ring-4 ring-white group-hover:scale-110 transition-transform duration-300 relative cursor-default`}
                  >
                    <span>{item.step}</span>
                  </div>

                  {/* Step Card Below */}
                  <div className="mt-6 p-4 rounded-2xl bg-white border border-[#2E3192]/10 shadow-sm hover:shadow-xl hover:border-[#2E3192]/25 transition-all duration-300 w-full flex flex-col justify-between h-full">
                    <div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badge} mb-2`}>
                        {item.phase}
                      </span>
                      <h3 className="font-heading font-extrabold text-sm text-[#141833] leading-snug">
                        {item.title}
                      </h3>
                      <div className="text-[11px] font-semibold text-[#2E3192] mt-0.5 mb-2">
                        {item.subtitle}
                      </div>
                      <p className="text-[11px] text-[#5A6180] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile & Tablet Vertical Connected Timeline (below lg) */}
          <div className="lg:hidden relative pl-8 sm:pl-10 space-y-8 before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[3px] before:bg-gradient-to-b before:from-[#2E3192] before:via-[#7C3AED] before:to-[#10B981] before:rounded-full">
            {timelineSteps.map((item) => (
              <div key={item.step} className="relative flex items-start gap-4">
                {/* Number Circle Badge on vertical line */}
                <div
                  className={`-ml-8 sm:-ml-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full ${item.color} text-white font-heading font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-md ring-4 ring-white`}
                >
                  {item.step}
                </div>

                {/* Card Content */}
                <div className="bg-white p-5 rounded-2xl border border-[#2E3192]/10 shadow-sm flex-1 space-y-2 text-left hover:shadow-md transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${item.badge}`}>
                      {item.phase}
                    </span>
                    <span className="text-[11px] font-semibold text-[#2E3192]">
                      {item.subtitle}
                    </span>
                  </div>
                  <h3 className="font-heading font-extrabold text-base text-[#141833]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#5A6180] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
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

      {/* ── Case Study Section (Fixed Agency Team BG with Centered Details) ─ */}
      <section
        id="case-studies"
        className="relative py-24 sm:py-32 bg-fixed bg-cover bg-center overflow-hidden border-t border-[#2E3192]/20"
        style={{ backgroundImage: "url('/agency-team-bg.jpg')" }}
      >
        {/* Dark cinematic backdrop overlay for crisp contrast */}
        <div className="absolute inset-0 bg-[#0B0F28]/75 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F28] via-transparent to-[#0B0F28]/80" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Glassmorphic Centered Case Study Card */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/50 shadow-2xl shadow-black/40 text-center space-y-7 relative">
            {/* Verified Case Study Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2E3192]/10 border border-[#2E3192]/20 text-[#2E3192] text-xs font-bold uppercase tracking-wider">
              <Star size={13} fill="#FFB800" stroke="#FFB800" />
              <span>Verified Case Study • Vance Family Dental</span>
            </div>

            {/* The Main Quote */}
            <blockquote className="font-heading font-extrabold text-2xl sm:text-3xl md:text-4xl text-[#141833] leading-snug tracking-tight max-w-2xl mx-auto">
              &ldquo;Within three months we moved from page two to the <span className="text-[#2E3192]">top three on Maps</span>, and phone calls nearly doubled.&rdquo;
            </blockquote>

            {/* Author Profile Information */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <div className="relative">
                <img
                  src="/dr-vance-real.jpg"
                  alt="Dr. Jennifer Vance, Founder of Vance Family Dental"
                  width={60}
                  height={60}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-4 ring-[#2E3192]/20 shadow-md"
                  loading="lazy"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                  <Check size={9} strokeWidth={3} className="text-white" />
                </span>
              </div>
              <div className="text-center sm:text-left">
                <div className="font-heading font-extrabold text-base sm:text-lg text-[#141833]">
                  Dr. Jennifer Vance
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#2E3192]">
                  Owner & Lead Surgeon, Vance Family Dental
                </div>
                <div className="text-[11px] text-[#5A6180]">
                  Denver Metro Area • Verified Google Business Profile
                </div>
              </div>
            </div>

            {/* Centered Business Outcome Metrics */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 border-t border-[#2E3192]/10">
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-bold border border-emerald-200/80 flex items-center gap-2 shadow-sm">
                <Phone size={15} strokeWidth={2.5} />
                <span>+112% Inbound Calls</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-bold border border-indigo-200/80 flex items-center gap-2 shadow-sm">
                <MapPin size={15} strokeWidth={2.5} />
                <span>#1 Map Pack Ranking</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-700 text-xs sm:text-sm font-bold border border-amber-200/80 flex items-center gap-2 shadow-sm">
                <Star size={15} fill="#FFB800" stroke="#FFB800" />
                <span>+86 Reviews</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-blue-50 text-[#0284C7] text-xs sm:text-sm font-bold border border-blue-200/80 flex items-center gap-2 shadow-sm">
                <TrendingUp size={15} strokeWidth={2.5} />
                <span>2.8x New Patients</span>
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
      <section className="py-24 bg-gradient-to-b from-white via-[#F8FAFC] to-white border-t border-[#2E3192]/10 relative overflow-hidden">
        {/* Subtle background glow decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[#2E3192]/5 blur-3xl pointer-events-none -z-10 rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header with Trust Badges */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2E3192]/5 border border-[#2E3192]/15 text-[#2E3192] text-xs font-semibold mb-4">
                <Star size={13} fill="#FFB800" stroke="#FFB800" />
                <span>Rated 4.9 / 5 by 1,200+ Local Businesses & Agencies</span>
              </div>
              <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#141833] tracking-tight">
                What our customers say
              </h2>
              <p className="mt-2 text-base text-[#5A6180]">
                Real results from business owners and agency directors dominating their local Google Maps rankings.
              </p>
            </div>

            {/* Carousel Navigation Controls */}
            <div className="flex items-center gap-3 self-start md:self-end">
              <span className="text-xs font-medium text-[#5A6180] mr-2 hidden sm:inline">
                {testimonialSlide * 3 + 1}–{Math.min((testimonialSlide + 1) * 3, testimonials.length)} of {testimonials.length} reviews
              </span>
              <button
                type="button"
                onClick={() => setTestimonialSlide((prev) => (prev === 0 ? totalTestimonialSlides - 1 : prev - 1))}
                aria-label="Previous testimonials"
                className="w-10 h-10 rounded-full border border-[#2E3192]/20 bg-white hover:bg-[#2E3192] hover:text-white text-[#141833] shadow-sm hover:shadow transition flex items-center justify-center cursor-pointer group"
              >
                <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <button
                type="button"
                onClick={() => setTestimonialSlide((prev) => (prev + 1) % totalTestimonialSlides)}
                aria-label="Next testimonials"
                className="w-10 h-10 rounded-full border border-[#2E3192]/20 bg-white hover:bg-[#2E3192] hover:text-white text-[#141833] shadow-sm hover:shadow transition flex items-center justify-center cursor-pointer group"
              >
                <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Testimonials Carousel Cards Container */}
          <div
            className="relative"
            onMouseEnter={() => setIsTestimonialHovered(true)}
            onMouseLeave={() => setIsTestimonialHovered(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
              {testimonials
                .slice(testimonialSlide * 3, testimonialSlide * 3 + 3)
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-7 rounded-3xl border border-[#2E3192]/15 shadow-sm hover:shadow-xl hover:border-[#2E3192]/30 transition-all duration-300 flex flex-col justify-between space-y-6 relative group"
                  >
                    {/* Top Row: Rating & Metric Pill */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex text-[#FFB800] gap-1">
                          {[...Array(item.stars)].map((_, i) => (
                            <Star key={i} size={16} fill="#FFB800" stroke="#FFB800" />
                          ))}
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${item.metricBg}`}>
                          {item.metric}
                        </span>
                      </div>

                      {/* Headline Quote */}
                      <p className="text-base font-bold text-[#141833] leading-snug">
                        &ldquo;{item.headline}&rdquo;
                      </p>

                      {/* Detailed Quote */}
                      <p className="text-xs sm:text-[13px] text-[#5A6180] leading-relaxed">
                        {item.quote}
                      </p>
                    </div>

                    {/* Author Information with Photorealistic Avatar */}
                    <div className="pt-4 border-t border-[#2E3192]/10 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          <img
                            src={item.avatar}
                            alt={`${item.name} portrait`}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-[#2E3192]/20 shadow-sm"
                            loading="lazy"
                          />
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                            <Check size={9} strokeWidth={3} className="text-white" />
                          </span>
                        </div>
                        <div>
                          <div className="font-heading font-extrabold text-xs sm:text-sm text-[#141833] flex items-center gap-1.5">
                            {item.name}
                          </div>
                          <div className="text-[11px] font-medium text-[#2E3192]">
                            {item.role}
                          </div>
                          <div className="text-[10px] text-[#5A6180]">
                            {item.company} • {item.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Pagination Indicator Dots */}
            <div className="flex justify-center items-center gap-2 mt-10">
              {[...Array(totalTestimonialSlides)].map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTestimonialSlide(idx)}
                  aria-label={`Go to testimonial slide ${idx + 1}`}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    testimonialSlide === idx ? 'w-8 bg-[#2E3192]' : 'w-2.5 bg-[#2E3192]/20 hover:bg-[#2E3192]/40'
                  }`}
                />
              ))}
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

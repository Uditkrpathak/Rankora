import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Star,
  ExternalLink,
  Sparkles,
  Palette,
  Layout,
  MessageSquareHeart,
  QrCode as QrIcon,
  Sliders,
  Eye,
  Store,
  Layers,
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

export interface ReviewBoosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: {
    _id?: string;
    name: string;
    address?: string;
    city?: string;
    placeId?: string | null;
    mapsCid?: string | null;
    averageRating?: number | null;
    totalReviewCount?: number | null;
    primaryCategory?: any;
    phone?: string;
  };
}

export type FlyerLayout = 'standee' | 'table_tent' | 'badge';
export type FlyerTheme = 'google' | 'midnight' | 'emerald';

export const ReviewBoosterModal: React.FC<ReviewBoosterModalProps> = ({
  isOpen,
  onClose,
  location,
}) => {
  const toast = useToast();
  const [activeMobileTab, setActiveMobileTab] = useState<'customize' | 'preview'>('customize');
  const [layout, setLayout] = useState<FlyerLayout>('standee');
  const [theme, setTheme] = useState<FlyerTheme>('google');
  const [headline, setHeadline] = useState('Loved our service?');
  const [subheadline, setSubheadline] = useState('Scan to leave us a quick 5-star review on Google!');
  const [customNote, setCustomNote] = useState('Your feedback supports our local business ❤️');
  const [showRating, setShowRating] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const printCanvasRef = useRef<HTMLDivElement>(null);

  // Compute official direct review submission URL
  const reviewUrl = location.placeId
    ? `https://search.google.com/local/writereview?placeid=${location.placeId}`
    : location.mapsCid
    ? `https://maps.google.com/?cid=${location.mapsCid}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location.name + ' ' + (location.address || '')
      )}`;

  // Generate crisp QR code on URL or theme changes
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(reviewUrl, {
      width: 900,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: theme === 'midnight' ? '#0f172a' : '#1e293b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate review QR code:', err));
  }, [isOpen, reviewUrl, theme]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reviewUrl);
    setCopiedLink(true);
    toast.success('Direct Google review link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${location.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-google-review-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR Code image downloaded (900x900 PNG)');
  };

  const handlePrint = () => {
    window.print();
  };

  const ratingVal =
    typeof location.averageRating === 'number' && location.averageRating > 0
      ? location.averageRating.toFixed(1)
      : '5.0';
  const reviewsCount =
    typeof location.totalReviewCount === 'number' && location.totalReviewCount > 0
      ? location.totalReviewCount
      : 16;

  return (
    <>
      {/* Print-specific style tag: ensures only the flyer prints full-page */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #review-booster-print-target,
          #review-booster-print-target * {
            visibility: visible !important;
          }
          #review-booster-print-target {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/65 backdrop-blur-xs no-print overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg border border-slate-200 w-full max-w-5xl h-[92vh] sm:h-[88vh] max-h-[860px] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <QrIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    Review Booster & Standee
                  </h2>
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    Localo Pro
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate hidden xs:block">
                  Generate table tents & counter flyers that direct customers to your Google review box
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition shrink-0 ml-2"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile / Tablet Segmented Tab Bar (Visible on screens < lg) */}
          <div className="flex lg:hidden border-b border-slate-200 bg-slate-100/70 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveMobileTab('customize')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeMobileTab === 'customize'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sliders size={13} />
              <span>Customize Standee</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('preview')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeMobileTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Eye size={13} />
              <span>Live Standee Preview</span>
            </button>
          </div>

          {/* Main Body (Left: Customizer, Right: Live Canvas Preview) */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Left Column: Controls (scrolls independently) */}
            <div
              className={`w-full lg:w-[48%] xl:w-[44%] p-4 sm:p-6 space-y-5 bg-slate-50/50 overflow-y-auto shrink-0 ${
                activeMobileTab === 'customize' ? 'block' : 'hidden lg:block'
              }`}
            >
              {/* 1. Layout Type */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-brand-600" />
                  Standee Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'standee', label: 'L-Standee', desc: 'A4 / Acrylic' },
                    { id: 'table_tent', label: 'Table Tent', desc: 'Foldable 2-Sided' },
                    { id: 'badge', label: 'Mini Decal', desc: 'Counter Sticker' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLayout(item.id as FlyerLayout)}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                        layout === item.id
                          ? 'bg-white border-brand-500 shadow-xs ring-2 ring-brand-500/20 text-brand-700'
                          : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Color Theme */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-brand-600" />
                  Visual Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'google', label: 'Google Clean', border: 'border-blue-400', color: 'bg-blue-500' },
                    { id: 'midnight', label: 'Dark Obsidian', border: 'border-slate-800', color: 'bg-slate-900' },
                    { id: 'emerald', label: 'Trust Emerald', border: 'border-emerald-500', color: 'bg-emerald-600' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id as FlyerTheme)}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                        theme === t.id
                          ? 'bg-white border-slate-900 shadow-xs ring-2 ring-slate-900/15 font-bold text-slate-900'
                          : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${t.color} shrink-0`} />
                      <span className="text-xs truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Text Customization */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquareHeart className="w-3.5 h-3.5 text-brand-600" />
                  Customize Messaging
                </label>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Headline</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Loved our service?"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Call to Action</label>
                    <input
                      type="text"
                      value={subheadline}
                      onChange={(e) => setSubheadline(e.target.value)}
                      placeholder="e.g. Scan to leave us a quick 5-star review on Google!"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Footer Note</label>
                    <input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="e.g. Your feedback supports our local business ❤️"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Display Toggles */}
              <div className="pt-2 border-t border-slate-200/60">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100/50 transition">
                  <div className="flex items-center gap-1.5">
                    <Star size={13} className="text-amber-500 fill-amber-500" />
                    <span>Display Google Rating ({ratingVal} ★)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showRating}
                    onChange={(e) => setShowRating(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Direct Review Link Card */}
              <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Store size={13} className="text-brand-600" />
                    Direct Google Review Link
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={reviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                      title="Open review URL in new tab"
                    >
                      <span>Test</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-brand-50 transition"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60 select-all">
                  {reviewUrl}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  💡 Send this direct link to customers on WhatsApp, SMS or invoices!
                </p>
              </div>
            </div>

            {/* Right Column: Live Printable Flyer Preview */}
            <div
              className={`w-full lg:w-[52%] xl:w-[56%] p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center bg-gradient-to-b from-slate-100/80 via-slate-50/60 to-slate-100/90 overflow-y-auto ${
                activeMobileTab === 'preview' ? 'block' : 'hidden lg:flex'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Live Standee Preview (Ready to Print)
              </div>

              {/* Realistic Physical Standee Card Canvas */}
              <div
                id="review-booster-print-target"
                ref={printCanvasRef}
                className={`w-full max-w-[340px] sm:max-w-[360px] p-6 sm:p-7 shadow-xl border transition-all duration-300 relative flex flex-col items-center text-center ${
                  layout === 'badge' ? 'rounded-[2.5rem]' : 'rounded-3xl'
                } ${
                  theme === 'midnight'
                    ? 'bg-slate-900 border-slate-800 text-white shadow-slate-900/30'
                    : theme === 'emerald'
                    ? 'bg-emerald-950 border-emerald-900 text-white shadow-emerald-950/30'
                    : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-300/50'
                }`}
              >
                {/* Table Tent Fold Guide Indicator */}
                {layout === 'table_tent' && (
                  <div className="w-full border-b-2 border-dashed border-slate-300 my-2 pb-2 text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                    ✂️ Fold along dotted line (Table Tent)
                  </div>
                )}

                {/* Google Multi-Color Top Pill Bar */}
                <div className="flex items-center gap-1 mb-3.5">
                  <div className="w-6 h-1.5 rounded-full bg-[#4285F4]" />
                  <div className="w-6 h-1.5 rounded-full bg-[#EA4335]" />
                  <div className="w-6 h-1.5 rounded-full bg-[#FBBC05]" />
                  <div className="w-6 h-1.5 rounded-full bg-[#34A853]" />
                </div>

                {/* Business Name */}
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-1 max-w-full px-2 line-clamp-2">
                  {location.name}
                </h3>
                <p
                  className={`text-[11px] line-clamp-1 mb-3.5 px-2 ${
                    theme === 'google' ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {location.address || 'Local Google Business Profile'}
                </p>

                {/* Star Rating Badge */}
                {showRating && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3.5 shadow-2xs ${
                      theme === 'google'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200/80'
                        : 'bg-white/10 text-amber-300 border border-white/20'
                    }`}
                  >
                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span>{ratingVal} ★</span>
                    <span className="text-[10px] opacity-80">({reviewsCount} reviews)</span>
                  </div>
                )}

                {/* Headline & Call to Action */}
                <div className="mb-4 max-w-xs space-y-1 px-2">
                  <h4 className="text-base sm:text-lg font-extrabold tracking-tight leading-snug">
                    {headline || 'Loved our service?'}
                  </h4>
                  <p
                    className={`text-xs ${
                      theme === 'google' ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    {subheadline || 'Scan to leave us a quick 5-star review on Google!'}
                  </p>
                </div>

                {/* QR Code Graphic Frame */}
                <div className="relative p-3.5 sm:p-4 rounded-2xl bg-white shadow-md border border-slate-200/90 mb-3.5">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Google Review QR Code"
                      className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center text-slate-300">
                      <QrIcon className="w-12 h-12 animate-pulse" />
                    </div>
                  )}

                  {/* Centered Google Icon Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center">
                      <span className="font-black text-sm text-[#4285F4]">G</span>
                    </div>
                  </div>
                </div>

                {/* 3 Step Instruction */}
                <div
                  className={`w-full grid grid-cols-3 gap-1.5 text-[10px] py-2 px-2.5 rounded-xl border mb-2.5 ${
                    theme === 'google'
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-brand-600">1. Open</span>
                    Camera
                  </div>
                  <div>
                    <span className="font-bold block text-brand-600">2. Scan</span>
                    QR Code
                  </div>
                  <div>
                    <span className="font-bold block text-brand-600">3. Rate</span>
                    5 Stars
                  </div>
                </div>

                {/* Footer Note */}
                <p
                  className={`text-[11px] font-medium tracking-tight px-2 ${
                    theme === 'google' ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {customNote}
                </p>

                {/* Acrylic Base Mockup Foot for L-Standee */}
                {layout === 'standee' && (
                  <div className="mt-3 w-4/5 h-2 rounded-full bg-slate-300/40 shadow-inner no-print" />
                )}

                {/* Subtle verified badge */}
                <div className="mt-2 text-[9px] uppercase tracking-widest text-slate-400/80">
                  Google Verified • Instant Review
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white shrink-0">
            <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span>Ready for acrylic counter stands, dining tables & front desks.</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200/90 text-xs font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-bold shadow-sm hover:shadow transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / PDF Flyer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

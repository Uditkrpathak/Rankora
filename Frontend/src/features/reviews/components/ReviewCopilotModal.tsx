import React, { useState, useEffect } from 'react';
import {
  ReviewCopilotTonesResponse,
  ReviewCopilotTone,
} from '../../../store/api/reviewApi';
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  X,
  Star,
  Briefcase,
  Heart,
  TrendingUp,
  Tag,
  MessageSquare,
  SendHorizontal,
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

interface ReviewCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  copilotData: ReviewCopilotTonesResponse | null;
  onInsertToInput?: (text: string) => void;
}

export const ReviewCopilotModal: React.FC<ReviewCopilotModalProps> = ({
  isOpen,
  onClose,
  copilotData,
  onInsertToInput,
}) => {
  const toast = useToast();
  const [activeTone, setActiveTone] = useState<'seo_optimized' | 'professional' | 'friendly'>('seo_optimized');
  const [copiedTone, setCopiedTone] = useState<string | null>(null);
  const [customReplies, setCustomReplies] = useState<Record<string, string>>({});

  // Reset custom replies when new copilot data loads
  useEffect(() => {
    if (copilotData) {
      setCustomReplies({
        seo_optimized: copilotData.tones.seo_optimized.replyText,
        professional: copilotData.tones.professional.replyText,
        friendly: copilotData.tones.friendly.replyText,
      });
      setActiveTone('seo_optimized');
    }
  }, [copilotData]);

  if (!isOpen || !copilotData) return null;

  const currentToneData: ReviewCopilotTone = copilotData.tones[activeTone];
  const activeReplyText = customReplies[activeTone] ?? currentToneData.replyText;

  // Determine Google target URL
  const googlePanelUrl =
    copilotData.googleMapsReviewUrl ||
    (copilotData.placeId
      ? `https://search.google.com/local/reviews?placeid=${copilotData.placeId}`
      : 'https://business.google.com/reviews');

  // 1-Click Copy & Open Google Review Panel
  const handleCopyAndOpenGoogle = () => {
    navigator.clipboard.writeText(activeReplyText);
    setCopiedTone(activeTone);
    toast.success('AI reply copied! Opening Google review panel in a new tab...');
    window.open(googlePanelUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => setCopiedTone(null), 3000);
  };

  // Copy text only
  const handleCopyOnly = () => {
    navigator.clipboard.writeText(activeReplyText);
    setCopiedTone(activeTone);
    toast.success('Reply copied to clipboard!');
    setTimeout(() => setCopiedTone(null), 2500);
  };

  const tonesList: Array<{
    key: 'seo_optimized' | 'professional' | 'friendly';
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    tag: string;
    badgeColor: string;
  }> = [
    {
      key: 'seo_optimized',
      label: 'Promotional / Local SEO',
      sublabel: 'Weaves keywords for Google ranking',
      icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
      tag: 'Google 3-Pack Boost',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      key: 'professional',
      label: 'Professional & Polished',
      sublabel: 'Formal, respectful, corporate standard',
      icon: <Briefcase className="w-4 h-4 text-blue-600" />,
      tag: 'Corporate & Formal',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      key: 'friendly',
      label: 'Polite & Warm',
      sublabel: 'Heartfelt, personal, empathetic',
      icon: <Heart className="w-4 h-4 text-rose-500" />,
      tag: 'Casual & Welcoming',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
              <Sparkles className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  AI Review Reply Generator
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                  Zero-GBP Required
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                  Localo Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Generate 3 tailored response tones & copy directly into Google in 1 click.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-white">
          {/* Review Context Box */}
          <div className="p-4 rounded-lg bg-slate-50/90 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-slate-900">
                  {copilotData.reviewerName || 'Google Customer'}
                </span>
                <div className="flex text-amber-500">
                  {[...Array(copilotData.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                {copilotData.languageLabel && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold flex items-center gap-1">
                    🌐 {copilotData.languageLabel}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                Customer Feedback
              </span>
            </div>
            <p className="text-xs text-slate-700 italic bg-white p-3.5 rounded-lg border border-slate-200 leading-relaxed font-medium">
              "{copilotData.reviewText || '5-star rating without written comment'}"
            </p>
          </div>

          {/* Tone Selector Tabs (3 Variations) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Select AI Response Tone (3 Variations)</span>
              <span className="text-[11px] text-slate-400 font-normal">Choose best fit for your audience</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {tonesList.map((tone) => {
                const isSelected = activeTone === tone.key;
                return (
                  <button
                    key={tone.key}
                    type="button"
                    onClick={() => setActiveTone(tone.key)}
                    className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50/50 border-brand-500 ring-2 ring-brand-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span className="p-1.5 rounded-md bg-slate-100">{tone.icon}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${tone.badgeColor}`}>
                        {tone.tag}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block mt-1">
                        {tone.label}
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        {tone.sublabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Tone Output Box (Editable) */}
          <div className="p-4 sm:p-5 rounded-lg bg-white border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span>{currentToneData.title}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  {currentToneData.description} (You can edit text directly below)
                </p>
              </div>

              <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {activeReplyText.length} chars
              </span>
            </div>

            {/* Editable Response Textarea */}
            <div className="relative">
              <textarea
                value={activeReplyText}
                onChange={(e) =>
                  setCustomReplies((prev) => ({
                    ...prev,
                    [activeTone]: e.target.value,
                  }))
                }
                rows={4}
                className="w-full p-3.5 text-xs text-slate-800 bg-slate-50/60 border border-slate-200 rounded-xl leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>

            {/* Keyword Chips for Promotional / SEO Tone */}
            {activeTone === 'seo_optimized' && currentToneData.targetKeywords && (
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Tag className="w-3 h-3 text-emerald-600" />
                  Target Keywords Weaved For Google Ranking Signal:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentToneData.targetKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: 1-Click Copy & Open Google Review Panel */}
        <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onInsertToInput && (
              <button
                type="button"
                onClick={() => {
                  onInsertToInput(activeReplyText);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                <span>Insert to Reply Box</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyOnly}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Copy Text Only</span>
            </button>
          </div>

          {/* The Localo-Style Killer Action Button */}
          <button
            type="button"
            onClick={handleCopyAndOpenGoogle}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition cursor-pointer ${
              copiedTone === activeTone
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white'
            }`}
          >
            {copiedTone === activeTone ? (
              <>
                <Check className="w-4 h-4 animate-scale" />
                <span>Copied! Opening Google...</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy & Open Google Review Panel</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

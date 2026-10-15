import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useListLocationsQuery } from '../../store/api/locationApi';
import {
  useSendChatMessageMutation,
  useGetBusinessDossierQuery,
} from '../../store/api/chatApi';
import {
  Send,
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  Building2,
  Star,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  Loader2,
  ArrowRight,
  Clock,
  ShieldCheck,
  BarChart3,
  Activity,
  ArrowUp,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'deterministic' | 'cache' | 'llm' | 'fallback' | 'blocked';
  badge?: string | null;
  suggestions?: string[];
  intent?: string;
  isRateLimit?: boolean;
  retryAfter?: number;
  isQuotaExceeded?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  'What are customers saying about my service?',
  'How do I compare to my top competitors?',
  'Which keywords should I focus on?',
  'Draft an SEO update post for Google Maps',
];

export const BusinessChatbot: React.FC = () => {
  const { activeWorkspace, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const { data: locationsData } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId || !isAuthenticated }
  );
  const locations = locationsData?.locations || [];

  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rate limit countdown effect
  useEffect(() => {
    if (rateLimitSeconds === null || rateLimitSeconds <= 0) return;
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  useEffect(() => {
    if (locations.length > 0 && (!selectedLocationId || !locations.some((l) => l._id === selectedLocationId))) {
      setSelectedLocationId(locations[0]._id);
    }
  }, [locations, selectedLocationId]);

  const activeLocation = locations.find((l) => l._id === selectedLocationId);

  const { data: dossierData } = useGetBusinessDossierQuery(
    { workspaceId, locationId: selectedLocationId },
    { skip: !workspaceId || !selectedLocationId || !isOpen }
  );

  const [sendChatMessage, { isLoading: isSending }] = useSendChatMessageMutation();

  // Initialize professional greeting on open (zero emojis, analytical framing)
  useEffect(() => {
    if (isOpen && messages.length === 0 && activeLocation) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `**Local Intelligence Summary** for **${activeLocation.name}**\n\nVerified Google Business Profile and local search ranking data are loaded. You can query customer review sentiment, inspect competitive ranking positions, or generate communications grounded in your live business metrics.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'deterministic',
          badge: 'Verified Rankora Live Data',
          suggestions: DEFAULT_SUGGESTIONS,
        },
      ]);
    }
  }, [isOpen, activeLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  if (!isAuthenticated) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending || !workspaceId || !selectedLocationId) return;
    if (rateLimitSeconds !== null && rateLimitSeconds > 0) return;

    // Enforce 300 character client boundary
    const trimmedText = text.slice(0, 300);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content.length > 1000 ? m.content.slice(0, 1000) : m.content,
      }));

      const res = await sendChatMessage({
        workspaceId,
        locationId: selectedLocationId,
        message: trimmedText,
        conversationHistory: history,
      }).unwrap();

      if (res.data) {
        if (typeof res.data.remainingQuota === 'number') {
          setRemainingQuota(res.data.remainingQuota);
        }

        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.answer || res.data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: res.data.source,
          badge: res.data.badge,
          suggestions: res.data.suggestions,
          intent: res.data.intent,
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err: any) {
      const errCode = err?.data?.error?.code;
      const retryAfter = err?.data?.error?.retryAfter;

      // Rate limit detection strictly by error code RATE_LIMIT_EXCEEDED
      if (errCode === 'RATE_LIMIT_EXCEEDED') {
        const seconds = typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : 60;
        setRateLimitSeconds(seconds);
        const rateLimitMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `**Request limit reached.** You have submitted multiple requests in a short interval. Please wait **${seconds} seconds** before submitting another query.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isRateLimit: true,
          retryAfter: seconds,
          source: 'blocked',
          badge: null,
        };
        setMessages((prev) => [...prev, rateLimitMsg]);
        return;
      }

      // Quota exceeded detection strictly by error code QUOTA_EXCEEDED
      if (errCode === 'QUOTA_EXCEEDED') {
        setRemainingQuota(0);
        const resetsAt = err?.data?.error?.resetsAt;
        const resetFormatted = resetsAt ? new Date(resetsAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'the start of next month';
        const quotaMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `**Monthly Query Limit Reached.** You have utilized all allocated intelligence queries for this location. Quota resets on **${resetFormatted}**. Upgrade your subscription or contact your administrator for additional capacity.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isQuotaExceeded: true,
          source: 'blocked',
          badge: null,
        };
        setMessages((prev) => [...prev, quotaMsg]);
        return;
      }

      // Standard error fallback
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Unable to complete request: ${err?.data?.error?.message || err?.message || 'Server error'}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'fallback',
        badge: null,
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'reset',
        role: 'assistant',
        content: `Conversation reset. Select a topic below or enter a query regarding **${activeLocation?.name || 'your business'}**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: DEFAULT_SUGGESTIONS,
      },
    ]);
  };

  return (
    <>
      {/* ── Floating Launcher Button (Clean Executive SaaS Dock) ─────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full border border-slate-750 shadow-xl shadow-slate-950/20 hover:shadow-2xl hover:border-slate-600 transition-all duration-200 cursor-pointer group"
          aria-label="Open Rankora Assistant"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 border border-slate-700 text-slate-200 group-hover:text-white transition">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-100 tracking-tight">Rankora Assistant</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Live Data
            </span>
          </div>
        </button>
      )}

      {/* ── Assistant Window ─────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-white border border-slate-200 shadow-2xl transition-all duration-300 overflow-hidden font-sans ${
            isFullScreen
              ? 'inset-4 md:inset-8 rounded-2xl'
              : 'bottom-6 right-6 w-[95vw] sm:w-[440px] h-[640px] max-h-[88vh] rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-white tracking-tight">Rankora Assistant</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Live Data
                  </span>
                </div>
                {/* Location Switcher */}
                {locations.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => {
                        setSelectedLocationId(e.target.value);
                        setMessages([]);
                      }}
                      className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-[11px] font-medium rounded px-1.5 py-0.5 outline-none border border-slate-700 cursor-pointer truncate max-w-[200px]"
                    >
                      {locations.map((loc) => (
                        <option key={loc._id} value={loc._id} className="bg-slate-900 text-white">
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0 ml-2">
              <button
                onClick={handleClearHistory}
                title="Reset Conversation"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Business KPI Strip (Clean Tabular Numbers, No Emojis) */}
          {dossierData?.data && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 overflow-x-auto shrink-0 gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="font-semibold text-slate-800">{dossierData.data.reviews.averageRating.toFixed(1)}</span>
                <span className="text-slate-400">({dossierData.data.reviews.total.toLocaleString()} reviews)</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium text-slate-700">{dossierData.data.rankings.totalTrackedKeywords} Keywords</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                <span className={`font-medium ${dossierData.data.reviews.unrepliedCount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                  {dossierData.data.reviews.unrepliedCount} Unreplied
                </span>
              </div>
              {remainingQuota !== null && (
                <div className="flex items-center gap-1 shrink-0 text-slate-500 font-medium">
                  <Activity className="w-3 h-3 text-slate-400" />
                  <span>{remainingQuota} remaining</span>
                </div>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                <div
                  className={`max-w-[88%] rounded-xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white font-normal'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Message Content with Markdown formatting */}
                  <div className="whitespace-pre-wrap space-y-1.5">
                    {msg.content.split('\n\n').map((para, i) => {
                      if (para.startsWith('### ')) {
                        return <h4 key={i} className="font-semibold text-xs text-slate-900 mt-1 uppercase tracking-wider">{para.replace('### ', '')}</h4>;
                      }
                      if (para.startsWith('#### ')) {
                        return <h5 key={i} className="font-semibold text-xs text-slate-900 mt-1">{para.replace('#### ', '')}</h5>;
                      }
                      if (para.startsWith('> ')) {
                        return (
                          <div key={i} className="p-2.5 bg-slate-50 border-l-2 border-slate-400 text-slate-700 italic rounded-r">
                            {para.replaceAll('> ', '')}
                          </div>
                        );
                      }
                      return <p key={i}>{para}</p>;
                    })}
                  </div>

                  {/* Verified Source Badge (Clean Neutral Badge, Zero Emojis) */}
                  {msg.role === 'assistant' && msg.badge && msg.source !== 'blocked' && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium tracking-tight">
                        <ShieldCheck className="w-3 h-3 text-slate-500" />
                        {msg.badge}
                      </span>
                      {msg.source === 'cache' && (
                        <span className="text-[9px] text-slate-400 font-mono">(cached)</span>
                      )}
                    </div>
                  )}

                  {/* Rate Limit Active Notice */}
                  {msg.isRateLimit && (
                    <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Cooldown active: <strong>{rateLimitSeconds || msg.retryAfter}s</strong> remaining before next request.</span>
                    </div>
                  )}

                  {/* Quota Exceeded Callout */}
                  {msg.isQuotaExceeded && (
                    <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-[11px] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Monthly query allocation reached.</span>
                      </div>
                      <span className="font-semibold text-slate-900 hover:underline cursor-pointer">Upgrade Plan</span>
                    </div>
                  )}

                  {/* Copy button & Timestamp */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between mt-2 pt-1.5 text-[10px] text-slate-400">
                      <span>{msg.timestamp}</span>
                      <button
                        onClick={() => copyToClipboard(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Suggestions Pills (Clean Enterprise Action Chips) */}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendMessage(sug)}
                        disabled={isSending || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 hover:border-slate-300 border border-slate-200 rounded-lg px-2.5 py-1 transition cursor-pointer disabled:opacity-50"
                      >
                        <span>{sug}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 w-max text-xs text-slate-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                <span>Retrieving verified business data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-1.5">
            {rateLimitSeconds !== null && rateLimitSeconds > 0 && (
              <div className="flex items-center justify-between px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 font-medium">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Request cooldown active
                </span>
                <span className="font-mono font-bold">{rateLimitSeconds}s</span>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                maxLength={300}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  rateLimitSeconds !== null && rateLimitSeconds > 0
                    ? `Please wait ${rateLimitSeconds}s...`
                    : `Ask about reviews, rankings, competitors, or drafts...`
                }
                disabled={isSending || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-slate-500 focus:bg-white transition disabled:opacity-60 text-slate-900"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                className="p-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                title="Send query"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </form>
            {/* Helper line & Counter */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
              <span>Grounded in live Google Business Profile and local search data</span>
              <span
                className={`font-mono text-[10px] ${
                  inputMessage.length >= 280
                    ? 'text-rose-600 font-bold'
                    : inputMessage.length >= 240
                    ? 'text-amber-600 font-medium'
                    : 'text-slate-400'
                }`}
              >
                {inputMessage.length}/300
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

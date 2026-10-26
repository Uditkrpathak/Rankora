import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useListLocationsQuery } from '../../store/api/locationApi';
import { useSendChatMessageMutation } from '../../store/api/chatApi';
import {
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  Copy,
  Check,
  Building2,
  Loader2,
  ArrowRight,
  Clock,
  Send,
  Plus,
  Bot,
  MessageSquare,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'deterministic' | 'cache' | 'llm' | 'fallback' | 'blocked';
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

const NO_BUSINESS_SUGGESTIONS = [
  'Add your business profile',
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

  const [sendChatMessage, { isLoading: isSending }] = useSendChatMessageMutation();

  // Initialize greeting on open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      if (activeLocation) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Hi! How can I help you analyze, optimize, or grow **${activeLocation.name}** today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'deterministic',
            suggestions: DEFAULT_SUGGESTIONS,
          },
        ]);
      } else if (locations.length === 0) {
        setMessages([
          {
            id: 'welcome-no-business',
            role: 'assistant',
            content: `Welcome to Rankora Assistant. Please connect your first business profile to unlock local search analytics, review intelligence, and competitor comparisons.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'deterministic',
            suggestions: NO_BUSINESS_SUGGESTIONS,
          },
        ]);
      }
    }
  }, [isOpen, activeLocation, locations.length, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const location = useLocation();
  if (!isAuthenticated || location.pathname.startsWith('/admin')) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending || !workspaceId) return;

    if (locations.length === 0 || !selectedLocationId || text.includes('Add your business profile')) {
      navigate('/locations/add');
      setIsOpen(false);
      return;
    }

    if (rateLimitSeconds !== null && rateLimitSeconds > 0) return;

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
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.answer || res.data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: res.data.source,
          suggestions: res.data.suggestions,
          intent: res.data.intent,
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err: any) {
      const errCode = err?.data?.error?.code;
      const retryAfter = err?.data?.error?.retryAfter;

      if (errCode === 'RATE_LIMIT_EXCEEDED') {
        const seconds = typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : 60;
        setRateLimitSeconds(seconds);
        const rateLimitMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Request limit reached. Please wait ${seconds} seconds before sending another message.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isRateLimit: true,
          retryAfter: seconds,
          source: 'blocked',
        };
        setMessages((prev) => [...prev, rateLimitMsg]);
        return;
      }

      if (errCode === 'QUOTA_EXCEEDED') {
        const resetsAt = err?.data?.error?.resetsAt;
        const resetFormatted = resetsAt
          ? new Date(resetsAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          : 'next month';
        const quotaMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Monthly query limit reached. Your quota resets on ${resetFormatted}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isQuotaExceeded: true,
          source: 'blocked',
        };
        setMessages((prev) => [...prev, quotaMsg]);
        return;
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Unable to complete request: ${err?.data?.error?.message || err?.message || 'Server error'}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'fallback',
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
    if (locations.length === 0) {
      setMessages([
        {
          id: 'reset-no-business',
          role: 'assistant',
          content: `No business connected yet. Please add a business profile to activate Rankora Assistant.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: NO_BUSINESS_SUGGESTIONS,
        },
      ]);
      return;
    }
    setMessages([
      {
        id: 'reset',
        role: 'assistant',
        content: `Conversation reset. How can I help you with **${activeLocation?.name || 'your business'}**?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: DEFAULT_SUGGESTIONS,
      },
    ]);
  };

  return (
    <>
      {/* ── Floating Launcher Button ────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 text-white rounded-full bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group"
          aria-label="Open Rankora Assistant"
          title="Rankora Assistant"
        >
          <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-200" />
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5" title="Online">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-white"></span>
          </span>
        </button>
      )}

      {/* ── Assistant Window ─────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-white border border-slate-200 shadow-xl transition-all duration-300 overflow-hidden font-sans ${
            isFullScreen
              ? 'inset-4 md:inset-8 rounded-2xl'
              : 'bottom-6 right-6 w-[95vw] sm:w-[420px] h-[600px] max-h-[85vh] rounded-2xl'
          }`}
        >
          {/* Header - Clean, Flat Pure White Header with #006EEE Accent */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#006EEE] shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">Rankora Assistant</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Live
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
                      className="bg-transparent text-slate-600 hover:text-slate-900 text-[11px] font-medium outline-none cursor-pointer truncate max-w-[200px]"
                    >
                      {locations.map((loc) => (
                        <option key={loc._id} value={loc._id} className="text-slate-900 bg-white">
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={handleClearHistory}
                title="Reset Conversation"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#006EEE] text-white rounded-tr-xs font-normal'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  {/* Message Content */}
                  <div className="whitespace-pre-wrap space-y-1.5">
                    {msg.content.split('\n\n').map((para, i) => {
                      if (para.startsWith('### ')) {
                        return (
                          <h4 key={i} className="font-bold text-xs text-slate-900 mt-1 uppercase tracking-wider">
                            {para.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (para.startsWith('#### ')) {
                        return (
                          <h5 key={i} className="font-semibold text-xs text-slate-900 mt-1">
                            {para.replace('#### ', '')}
                          </h5>
                        );
                      }
                      if (para.startsWith('> ')) {
                        return (
                          <div key={i} className="p-2.5 bg-slate-50 border-l-2 border-[#006EEE] text-slate-700 italic rounded-r">
                            {para.replaceAll('> ', '')}
                          </div>
                        );
                      }
                      return <p key={i}>{para}</p>;
                    })}
                  </div>

                  {/* Rate Limit Active Notice */}
                  {msg.isRateLimit && (
                    <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Please wait <strong>{rateLimitSeconds || msg.retryAfter}s</strong> before next request.</span>
                    </div>
                  )}

                  {/* Quota Exceeded Callout */}
                  {msg.isQuotaExceeded && (
                    <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-[11px] flex items-center justify-between gap-2">
                      <span>Monthly query allocation reached.</span>
                      <span
                        onClick={() => navigate('/settings/billing')}
                        className="font-semibold text-[#006EEE] hover:underline cursor-pointer"
                      >
                        Upgrade
                      </span>
                    </div>
                  )}

                  {/* Copy button & Timestamp */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between mt-2 pt-1.5 text-[10px] text-slate-400 border-t border-slate-100">
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

                {/* Suggestions Pills - Clean Modern Chips */}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendMessage(sug)}
                        disabled={isSending || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 hover:border-slate-300 border border-slate-200 rounded-lg px-2.5 py-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <span>{sug}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {locations.length === 0 && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center space-y-3 my-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 text-[#006EEE] flex items-center justify-center mx-auto">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">Track your first business</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                    Add a business profile to analyze customer reviews, track keyword rankings, and get AI insights.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/locations/add');
                    setIsOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Business Profile</span>
                </button>
              </div>
            )}

            {isSending && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 w-max text-xs text-slate-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#006EEE]" />
                <span>Analyzing business data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer - Clean, Focused, No Extra Clutter */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            {rateLimitSeconds !== null && rateLimitSeconds > 0 && (
              <div className="flex items-center justify-between px-2.5 py-1 mb-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 font-medium">
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
                  locations.length === 0
                    ? 'Add a business to start chatting...'
                    : rateLimitSeconds !== null && rateLimitSeconds > 0
                    ? `Please wait ${rateLimitSeconds}s...`
                    : `Ask about reviews, rankings, competitors...`
                }
                disabled={isSending || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#006EEE] focus:ring-1 focus:ring-[#006EEE] focus:bg-white transition disabled:opacity-60 text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={(!inputMessage.trim() && locations.length > 0) || isSending || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                className="p-2.5 rounded-xl bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white disabled:bg-slate-100 disabled:text-slate-400 transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                title={locations.length === 0 ? 'Add business' : 'Send message'}
              >
                {locations.length === 0 ? <Plus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BusinessChatbot;

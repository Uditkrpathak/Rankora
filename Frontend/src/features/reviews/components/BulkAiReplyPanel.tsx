import React, { useState } from 'react';
import { Sparkles, Copy, CheckCircle2, AlertCircle, Loader2, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { BulkReplyResult, useGenerateBulkRepliesMutation } from '../../../store/api/reviewApi';

interface Props {
  workspaceId: string;
  locationId: string;
  unrepliedCount: number;
}

const TONE_OPTIONS: Array<{ key: 'professional' | 'friendly' | 'seo_optimized'; label: string; desc: string }> = [
  { key: 'professional', label: 'Professional', desc: 'Formal, polished, corporate-standard' },
  { key: 'friendly', label: 'Warm & Friendly', desc: 'Casual, heartfelt, personal warmth' },
  { key: 'seo_optimized', label: 'SEO Optimized', desc: 'Keyword-infused for Google ranking' },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
      ))}
    </span>
  );
}

function ResultCard({ result, idx }: { result: BulkReplyResult; idx: number }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(idx === 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.replyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isError = result.status === 'error';

  return (
    <div className={`rounded-xl border ${isError ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-slate-50/50 transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-bold text-slate-400 w-5 shrink-0">#{idx + 1}</span>
          <StarRow rating={result.rating} />
          <span className="text-xs font-bold text-slate-800 truncate">{result.reviewerName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isError ? (
            <Badge variant="danger" size="sm">Error</Badge>
          ) : (
            <Badge variant="success" size="sm">Ready</Badge>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {isError ? (
            <p className="text-xs text-rose-600 mt-3">{result.reason || 'Generation failed.'}</p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100">
                {result.replyText}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy reply'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const BulkAiReplyPanel: React.FC<Props> = ({ workspaceId, locationId, unrepliedCount }) => {
  const [generateBulk, { isLoading }] = useGenerateBulkRepliesMutation();
  const [tone, setTone] = useState<'professional' | 'friendly' | 'seo_optimized'>('professional');
  const [results, setResults] = useState<BulkReplyResult[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [hasRun, setHasRun] = useState(false);

  const handleGenerate = async () => {
    const res = await generateBulk({ workspaceId, locationId, tone, maxBatch: 20 }).unwrap();
    setResults(res.data.results);
    setSkipped(res.data.skipped);
    setHasRun(true);
  };

  const readyCount = results.filter((r) => r.status === 'ready').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="bg-gradient-to-r from-indigo-50 to-brand-50 rounded-xl border border-indigo-200/80 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Bulk AI Reply Generator</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Generate ready-to-copy AI replies for all <strong>{unrepliedCount}</strong> unreplied review{unrepliedCount !== 1 ? 's' : ''} in one click.
              Copy each reply and paste it into Google Maps manually.
            </p>
          </div>
        </div>
      </div>

      {/* Tone selector */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">Response Tone</label>
        <div className="grid grid-cols-3 gap-2">
          {TONE_OPTIONS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTone(t.key)}
              className={`text-left rounded-xl border p-3 transition cursor-pointer ${
                tone === t.key
                  ? 'border-brand-400 bg-brand-50 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={`text-xs font-bold block ${tone === t.key ? 'text-brand-700' : 'text-slate-800'}`}>
                {t.label}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        variant="primary"
        size="sm"
        onClick={handleGenerate}
        isLoading={isLoading}
        disabled={unrepliedCount === 0}
        leftIcon={isLoading ? undefined : <Sparkles className="w-3.5 h-3.5" />}
        className="w-full justify-center"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating replies…
          </span>
        ) : unrepliedCount === 0 ? (
          'All reviews have replies ✓'
        ) : (
          `Generate ${Math.min(unrepliedCount, 20)} AI Replies`
        )}
      </Button>

      {/* Results summary */}
      {hasRun && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="success" size="sm">✓ {readyCount} ready</Badge>
          {errorCount > 0 && <Badge variant="danger" size="sm">✗ {errorCount} failed</Badge>}
          {skipped > 0 && <Badge variant="neutral" size="sm">{skipped} skipped (cap)</Badge>}
        </div>
      )}

      {/* Result cards */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, idx) => (
            <ResultCard key={r.reviewId + idx} result={r} idx={idx} />
          ))}
        </div>
      )}

      {unrepliedCount === 0 && !hasRun && (
        <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-medium">All reviews have been replied to!</p>
        </div>
      )}
    </div>
  );
};

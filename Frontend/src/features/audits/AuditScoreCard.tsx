import React from 'react';
import { IAuditSignal, SignalSeverity } from '@localo/types';
import { CheckCircle2, AlertTriangle, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

interface AuditScoreCardProps {
  signal: IAuditSignal;
}

export const AuditScoreCard: React.FC<AuditScoreCardProps> = ({ signal }) => {
  const getSeverityBadge = (sev: SignalSeverity) => {
    switch (sev) {
      case 'PASS':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          label: 'Passed',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <AlertCircle className="w-4 h-4 text-rose-600" />,
          label: 'Critical',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          label: 'Warning',
        };
      case 'OPTIMIZATION':
        return {
          bg: 'bg-brand-50 text-brand-700 border-brand-200',
          icon: <Sparkles className="w-4 h-4 text-brand-600" />,
          label: 'Opportunity',
        };
      case 'UNKNOWN':
        return {
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: <HelpCircle className="w-4 h-4 text-slate-500" />,
          label: 'Needs data',
        };
    }
  };

  const badge = getSeverityBadge(signal.severity);
  const legacyPlacesEvidence = signal.evidenceSource === 'Google Maps verified place data';
  const evidenceSource = legacyPlacesEvidence
    ? 'Google Maps public listing · ownership not verified'
    : signal.evidenceSource;
  const confidence = legacyPlacesEvidence ? 'medium' : signal.confidence?.toLowerCase();

  return (
    <div className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-start space-x-3 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">{badge.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                {signal.code}
              </span>
              <h4 className="text-sm font-bold text-slate-900 leading-tight break-words">
                {signal.name}
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed break-words">
              {signal.explanation || signal.remediationTip}
            </p>
            {evidenceSource && (
              <p className="text-[10px] text-slate-400 mt-1.5 break-words">
                Evidence: {evidenceSource}
                {confidence ? ` · ${confidence} confidence` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1.5 shrink-0 text-right">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${badge.bg}`}>
            {badge.label}
          </span>
          <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
            {signal.severity === 'UNKNOWN' ? '—' : `${signal.score} / ${signal.weight} pts`}
          </span>
        </div>
      </div>
    </div>
  );
};

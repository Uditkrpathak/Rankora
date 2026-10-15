import React from 'react';

interface AuditScoreGaugeProps {
  score?: number | null;
  unknownCount?: number | null;
  rulesVersion?: string | null;
}

export const AuditScoreGauge: React.FC<AuditScoreGaugeProps> = ({
  score,
  unknownCount,
}) => {
  const hasScore = typeof score === 'number' && !isNaN(score);

  if (!hasScore) {
    return (
      <div className="flex items-center gap-2.5 text-right">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block leading-none">
            Audit score
          </span>
          <span className="text-[10px] text-slate-400 max-w-[110px] leading-tight block mt-0.5">
            Run an audit to calculate a score
          </span>
        </div>
        <div className="w-8 h-8 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
          ?
        </div>
      </div>
    );
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score!)));
  const strokeColor =
    clampedScore >= 75
      ? 'text-emerald-500'
      : clampedScore >= 50
        ? 'text-amber-500'
        : 'text-rose-500';

  return (
    <div className="flex flex-col items-center select-none">
      <span className="text-[11px] font-semibold text-slate-500 mb-0.5">
        Audit score
      </span>
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg
          viewBox="0 0 36 36"
          className="w-10 h-10 -rotate-90"
          aria-hidden="true"
        >
          <path
            className="text-slate-100"
            strokeWidth="3.2"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={strokeColor}
            strokeDasharray={`${clampedScore}, 100`}
            strokeLinecap="round"
            strokeWidth="3.2"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="absolute text-[11px] font-extrabold text-slate-900">
          {clampedScore}%
        </span>
      </div>
      {typeof unknownCount === 'number' && unknownCount > 0 && (
        <span className="text-[9px] text-slate-400 font-medium mt-0.5">
          {unknownCount} need data
        </span>
      )}
    </div>
  );
};

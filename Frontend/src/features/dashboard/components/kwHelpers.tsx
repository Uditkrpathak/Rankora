/**
 * Shared presentational sub-components for BusinessCardKeywords.
 * Kept separate so BusinessCardKeywords.tsx stays under 300 lines.
 */
import React from 'react';

// ── TrendLine ──────────────────────────────────────────────────────────────

interface SparkPoint { rank: number; }

interface TrendLineProps {
  points?: SparkPoint[];
  rank?: number | null;
}

/** Mini rank trend sparkline. Falls back to a flat gray line if < 2 data points. */
export const TrendLine: React.FC<TrendLineProps> = ({ points }) => {
  const pts = (points || []).filter((p) => p.rank > 0).slice(-6);

  if (pts.length < 2) {
    return (
      <svg viewBox="0 0 80 24" className="w-20 h-6" aria-hidden="true">
        <line x1="0" y1="12" x2="80" y2="12" stroke="#cbd5e1" strokeWidth="1.5" />
      </svg>
    );
  }

  const maxR = Math.max(...pts.map((p) => p.rank));
  const minR = Math.min(...pts.map((p) => p.rank));
  const range = maxR - minR || 1;
  const W = 80;
  const H = 24;

  const coords = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((p.rank - minR) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Lower rank = better position => falling line on chart = improvement
  const isImproving = pts[pts.length - 1].rank < pts[0].rank;
  const stroke = isImproving ? '#22c55e' : '#ef4444';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-6" aria-hidden="true">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ── VisGauge ───────────────────────────────────────────────────────────────

interface VisGaugeProps {
  score: number;
  delta?: number;
}

/**
 * Geogrid visibility progress bar with radar icon, percentage label, and optional delta.
 * Uses Tailwind fraction classes instead of inline style={{ width }}.
 */
export const VisGauge: React.FC<VisGaugeProps> = ({ score, delta }) => {
  const pct = Math.min(100, Math.max(0, Math.round(score)));

  const barColor =
    pct >= 60 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-500' : 'bg-slate-300';

  const barWidth =
    pct <= 0    ? 'w-0'
    : pct < 10  ? 'w-[8%]'
    : pct < 20  ? 'w-[16%]'
    : pct < 30  ? 'w-[24%]'
    : pct < 40  ? 'w-[32%]'
    : pct < 50  ? 'w-2/5'
    : pct < 60  ? 'w-1/2'
    : pct < 70  ? 'w-[58%]'
    : pct < 80  ? 'w-2/3'
    : pct < 90  ? 'w-[75%]'
    : pct < 100 ? 'w-[88%]'
    : 'w-full';

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      {/* geogrid radar icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-3.5 h-3.5 text-slate-400 shrink-0"
        aria-hidden="true"
      >
        <path d="M3 8V5a2 2 0 0 1 2-2h3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>

      {/* Progress bar */}
      <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${barColor} ${barWidth} transition-all`} />
      </div>

      {/* Percentage */}
      <span className="text-[11px] font-bold text-slate-600 min-w-[28px]">
        {pct}%
      </span>

      {/* Optional visibility delta */}
      {typeof delta === 'number' && delta !== 0 && (
        <span
          className={`text-[10px] font-bold whitespace-nowrap ${
            delta > 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {delta > 0 ? `↑${delta}%` : `↓${Math.abs(delta)}%`}
        </span>
      )}
    </div>
  );
};

// ── RankBadge helpers ──────────────────────────────────────────────────────

export interface RankBadgeResult {
  text: string;
  cls: string;
  title?: string;
  deltaEl?: React.ReactNode;
}

export function buildRankBadge(
  current: number | null | undefined,
  previous: number | null | undefined,
  scanStatus?: string,
  rankState?: string,
  overallRank?: number | null | undefined,
  totalCompetitors?: number | null | undefined
): RankBadgeResult {
  const isNotScanned = scanStatus === 'NOT_SCANNED' || (!scanStatus && current === null && !overallRank && !rankState);
  const hasOverall = typeof overallRank === 'number' && overallRank > 0;
  const hasRank = typeof current === 'number' && current > 0 && current <= 20;

  let text = '--';
  let cls = 'bg-slate-100 text-slate-500 border-slate-200';
  let title = '';

  if (hasOverall) {
    text = `#${overallRank}`;
    title = totalCompetitors ? `Overall Position: #${overallRank} of ${totalCompetitors}` : `Overall Position: #${overallRank}`;
    if (overallRank <= 3) {
      cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (overallRank <= 10) {
      cls = 'bg-amber-50 text-amber-700 border-amber-200';
    } else {
      cls = 'bg-slate-100 text-slate-700 border-slate-300';
    }
  } else if (hasRank) {
    text = `Rank ${current}`;
    title = `Storefront Rank: ${current}`;
    if (current! <= 3)       cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (current! <= 10) cls = 'bg-amber-50 text-amber-700 border-amber-200';
    else                     cls = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (rankState === 'NOT_IN_TOP_20' || (!hasRank && !isNotScanned && scanStatus === 'SCANNED')) {
    text = '20+';
    cls = 'bg-slate-100 text-slate-700 border-slate-300';
  }

  const effCurrent = hasOverall ? overallRank : current;
  const delta =
    typeof effCurrent === 'number' && effCurrent > 0 && typeof previous === 'number' && previous > 0
      ? previous - effCurrent   // positive = rank improved
      : null;

  let deltaEl: React.ReactNode | undefined;
  if (delta !== null) {
    if (delta > 0) {
      deltaEl = (
        <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
          ↑ {delta}
        </span>
      );
    } else if (delta < 0) {
      deltaEl = (
        <span className="text-[10px] font-bold text-rose-600 whitespace-nowrap">
          ↓ {Math.abs(delta)}
        </span>
      );
    }
  }

  return { text, cls, title, deltaEl };
}

// ── Volume & Intelligence Badges ───────────────────────────────────────────

export const VolumePill: React.FC<{ tier?: 'POPULAR' | 'MEDIUM' | 'LOW' | null }> = ({ tier }) => {
  if (!tier) return null;
  const config = {
    POPULAR: { label: 'Popular', icon: '🔥', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    MEDIUM: { label: 'Medium', icon: '⚡', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    LOW: { label: 'Niche', icon: '🌱', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  }[tier];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${config.cls}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export const LocalPackBadge: React.FC<{ triggers?: boolean }> = ({ triggers }) => {
  if (!triggers) return null;
  return (
    <span
      title="Triggers Google Local 3-Pack"
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
    >
      <span>📍</span>
      <span>Local Pack</span>
    </span>
  );
};

// ── relative time ──────────────────────────────────────────────────────────

export function formatRelativeTime(d?: Date | string | null): string {
  if (!d) return 'Open map to scan';
  const date = new Date(d as string);
  if (isNaN(date.getTime())) return 'Open map to scan';
  const diffSec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

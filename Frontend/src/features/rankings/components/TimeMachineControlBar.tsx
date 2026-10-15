import React from 'react';
import { IScanRun } from '@localo/types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  TrendingUp,
  TrendingDown,
  GitCompare,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface TimeMachineControlBarProps {
  historyScans: IScanRun[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  comparisonMode: 'none' | 'baseline' | 'previous';
  onSetComparisonMode: (mode: 'none' | 'baseline' | 'previous') => void;
  activeScan: IScanRun;
  comparisonScan?: IScanRun | null;
}

export const TimeMachineControlBar: React.FC<TimeMachineControlBarProps> = ({
  historyScans,
  currentIndex,
  onSelectIndex,
  isPlaying,
  onTogglePlay,
  comparisonMode,
  onSetComparisonMode,
  activeScan,
  comparisonScan,
}) => {
  if (!historyScans || historyScans.length <= 1) {
    return (
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          <span className="font-semibold text-slate-700">Time Machine Playback</span>
          <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-100">
            1 Scan Recorded
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Run more scans over time to unlock automated rank improvement playback and delta analysis.
        </p>
      </div>
    );
  }

  const currentScan = historyScans[currentIndex] || activeScan;
  const currentAgr = currentScan?.metrics?.arp ?? currentScan?.metrics?.atrp ?? 0;
  const compAgr = comparisonScan?.metrics?.arp ?? comparisonScan?.metrics?.atrp ?? 0;
  const rankDelta = compAgr > 0 && currentAgr > 0 ? (compAgr - currentAgr) : 0; // Positive means rank improved (e.g. 5 -> 2 = +3)

  const currentTop3 = currentScan?.metrics?.solv ?? 0;
  const compTop3 = comparisonScan?.metrics?.solv ?? 0;
  const top3Delta = compTop3 > 0 ? (currentTop3 - compTop3) : 0;

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'Current';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getShapeBadge = (scan?: IScanRun | null) => {
    if (!scan) return '';
    if (scan.scanShape === 'SUNFLOWER') {
      return '🌻 Sunflower (31 pts)';
    }
    const size = scan.gridSize || 3;
    const pts = scan.pointCount || scan.gridPoints?.length || size * size;
    return `🔲 ${size}x${size} Grid (${pts} pts)`;
  };

  const isMixedShapeComparison =
    comparisonMode !== 'none' &&
    comparisonScan &&
    (comparisonScan.scanShape !== currentScan.scanShape ||
      (currentScan.scanShape === 'GRID' && comparisonScan.gridSize !== currentScan.gridSize));

  return (
    <div className="bg-white border-2 border-blue-500/30 shadow-elevated rounded-2xl p-4 space-y-3 transition-all animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Mode */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Clock size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>Geo-Grid Time Machine</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-200 uppercase">
                  {historyScans.length} Snapshots
                </span>
                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                  {getShapeBadge(currentScan)}
                </span>
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Calendar size={12} className="text-slate-400" />
              <span>Viewing: <strong className="text-slate-800 font-semibold">{formatDate(currentScan.completedAt || currentScan.createdAt)}</strong></span>
            </p>
          </div>
        </div>

        {/* Delta Badges */}
        {comparisonMode !== 'none' && comparisonScan && (
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-xs">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Avg Rank:</span>
              <span className="font-extrabold text-slate-900">{currentAgr.toFixed(1)}</span>
              {rankDelta !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-[11px] font-black px-1.5 py-0.2 rounded-full ${
                    rankDelta > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {rankDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span>{rankDelta > 0 ? `+${rankDelta.toFixed(1)}` : rankDelta.toFixed(1)}</span>
                </span>
              )}
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-xs">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Top 3 %:</span>
              <span className="font-extrabold text-slate-900">{currentTop3.toFixed(0)}%</span>
              {top3Delta !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-[11px] font-black px-1.5 py-0.2 rounded-full ${
                    top3Delta > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {top3Delta > 0 ? `+${top3Delta.toFixed(0)}%` : `${top3Delta.toFixed(0)}%`}
                </span>
              )}
            </div>
          </div>
        )}

        {isMixedShapeComparison && (
          <div className="w-full text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <span>⚡</span>
            <span>
              <strong>Mixed Shape History:</strong> Comparing {getShapeBadge(comparisonScan)} with {getShapeBadge(currentScan)}. Overall rank & top 3% are evaluated across measured points.
            </span>
          </div>
        )}

        {/* Comparison Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-500 px-2 flex items-center gap-1">
            <GitCompare size={11} /> Compare:
          </span>
          <button
            type="button"
            onClick={() => onSetComparisonMode('none')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              comparisonMode === 'none'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => onSetComparisonMode('baseline')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              comparisonMode === 'baseline'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Baseline
          </button>
          <button
            type="button"
            onClick={() => onSetComparisonMode('previous')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              comparisonMode === 'previous'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Previous
          </button>
        </div>
      </div>

      {/* Scrubber Controls */}
      <div className="flex items-center gap-3 pt-1">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            title="Previous snapshot"
          >
            <SkipBack size={14} />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition cursor-pointer"
            title={isPlaying ? 'Pause animation' : 'Play timeline'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-white ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => onSelectIndex(Math.min(historyScans.length - 1, currentIndex + 1))}
            disabled={currentIndex === historyScans.length - 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            title="Next snapshot"
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Timeline Slider with Dots */}
        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={0}
            max={historyScans.length - 1}
            step={1}
            value={currentIndex}
            onChange={(e) => onSelectIndex(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 accent-blue-600 rounded-lg cursor-pointer z-10"
          />
        </div>

        {/* Index counter */}
        <div className="text-xs font-bold text-slate-600 shrink-0">
          <span className="text-blue-600">{currentIndex + 1}</span> / {historyScans.length}
        </div>
      </div>
    </div>
  );
};

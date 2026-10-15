import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Zap, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Link } from 'react-router-dom';
import { IScanRun } from '@localo/types';

export interface ScanProgressTrackerProps {
  status: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  progress: number;
  totalPoints: number;
  completedPoints: number;
  scanData?: IScanRun | null;
  error?: string | null;
  isCreditDepleted?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ScanProgressTracker: React.FC<ScanProgressTrackerProps> = ({
  status,
  progress,
  totalPoints,
  completedPoints,
  scanData,
  error,
  isCreditDepleted,
  onRetry,
  onDismiss,
  className = '',
}) => {
  if (status === 'IDLE' && !error && !isCreditDepleted) {
    return null;
  }

  // Insufficient credits banner
  if (isCreditDepleted) {
    return (
      <div className={`p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Scan Limit Reached</h4>
              <p className="text-xs text-slate-600 mt-1">
                {error || 'You have exhausted your monthly scan credits. Upgrade your subscription for unlimited keyword scans.'}
              </p>
            </div>
          </div>
          <Link
            to="/settings/plans"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex-shrink-0 shadow-sm"
          >
            <span>Upgrade Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Failure banner
  if (status === 'FAILED' || (error && status === 'IDLE')) {
    return (
      <div className={`p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 ${className}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Scan Operation Failed</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error || 'An unexpected error occurred during SERP analysis.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                Retry
              </Button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // In Progress (Queued / Running)
  if (status === 'QUEUED' || status === 'RUNNING') {
    const isQueued = status === 'QUEUED';
    const statusText = isQueued
      ? 'Queued in worker pool. Allocating search proxies...'
      : `Sampling Google Maps coordinates (${completedPoints}/${totalPoints} points completed)...`;

    return (
      <div className={`p-5 rounded-2xl bg-brand-50/70 border border-brand-200/80 shadow-xs ${className}`}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center flex-shrink-0 animate-spin">
              <Loader2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand-700">
                  {isQueued ? 'Scan Queued' : 'Live Geo-Grid Scan'}
                </span>
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping" />
              </div>
              <p className="text-xs font-medium text-slate-600 mt-0.5">{statusText}</p>
            </div>
          </div>
          <span className="text-sm font-extrabold text-brand-700">{progress}%</span>
        </div>

        {/* Progress Bar with Brand #0075F6 Fill */}
        <div className="w-full bg-brand-100/70 h-2 rounded-full overflow-hidden">
          <div
            className="bg-brand-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress)}%` }}
          />
        </div>
      </div>
    );
  }

  // Completed Banner
  if (status === 'COMPLETED' || status === 'PARTIAL') {
    const metrics = scanData?.metrics;
    return (
      <div className={`p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 ${className}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Scan Complete</h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  Fresh SERP Data
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {metrics?.arp
                  ? `Average Rank: #${metrics.arp.toFixed(1)} · Share of Voice: ${(metrics.solv || 0).toFixed(0)}% · Visibility: ${(metrics.visibilityIndex || 0).toFixed(0)}%`
                  : 'SERP coordinates analyzed and dashboard metrics refreshed.'}
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

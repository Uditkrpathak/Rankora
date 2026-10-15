import React, { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  delta?: {
    value: string | number;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  isLoading?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  delta,
  isLoading = false,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider truncate">
          {title}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface text-brand-purple flex items-center justify-center shrink-0 border border-slate-200/80">
            {icon}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          <div className="h-6 w-20 shimmer rounded" />
          <div className="h-3 w-28 shimmer rounded" />
        </div>
      ) : (
        <>
          <div className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            {value}
          </div>

          <div className="mt-1.5 flex items-center flex-wrap gap-1.5 text-xs">
            {delta && (
              <span
                className={`inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded border text-[11px] ${
                  delta.trend === 'up'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : delta.trend === 'down'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {delta.trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
                {delta.trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
                {delta.trend === 'neutral' && <Minus className="w-3 h-3" />}
                <span>{delta.value}</span>
              </span>
            )}

            {(delta?.label || subtitle) && (
              <span className="text-slate-500 text-xs">
                {delta?.label || subtitle}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

import React, { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  iconVariant?: 'sky' | 'purple' | 'emerald' | 'amber' | 'slate';
  delta?: {
    value: string | number;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  infoTooltip?: string;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

const ICON_STYLES: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-600 border-sky-200/60',
  purple: 'bg-purple-100 text-purple-600 border-purple-200/60',
  emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200/60',
  amber: 'bg-amber-100 text-amber-600 border-amber-200/60',
  slate: 'bg-slate-100 text-slate-600 border-slate-200/60',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconVariant = 'sky',
  delta,
  isLoading = false,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 transition-all shadow-2xs hover:shadow-xs hover:border-slate-300 flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Top Header: Icon Badge + Title */}
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              ICON_STYLES[iconVariant] || ICON_STYLES.sky
            }`}
          >
            {icon}
          </div>
        )}
        <span className="text-xs font-bold text-slate-800 tracking-tight">{title}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2 py-1">
          <div className="h-7 w-24 shimmer rounded-md" />
          <div className="h-3.5 w-32 shimmer rounded" />
        </div>
      ) : (
        <div className="space-y-1.5 mt-0.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-none">
              {value}
            </span>

            {delta && (
              <span
                className={`inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full text-[11px] border ${
                  delta.trend === 'up'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : delta.trend === 'down'
                    ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {delta.trend === 'up' && <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />}
                {delta.trend === 'down' && <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />}
                {delta.trend === 'neutral' && <Minus className="w-3 h-3 stroke-[2.5]" />}
                <span>{delta.value}</span>
              </span>
            )}
          </div>

          {subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

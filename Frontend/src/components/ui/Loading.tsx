import React from 'react';
import { RankoraLogo } from './RankoraLogo';

export interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'brand' | 'dark' | 'circle';
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'default',
  width,
  height,
  style,
}) => {
  const variantClasses = {
    default: 'shimmer bg-slate-100',
    brand: 'shimmer-brand bg-brand-50 border border-brand-100',
    dark: 'shimmer-dark bg-slate-800',
    circle: 'shimmer bg-slate-100 rounded-full',
  };

  return (
    <div
      className={`rounded ${variantClasses[variant]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export const PageLoader: React.FC<{
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
}> = ({
  message = 'Loading...',
  subtitle = 'Fetching data',
  fullScreen = false,
}) => {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30'
    : 'min-h-[320px] flex flex-col items-center justify-center p-6';

  return (
    <div className={containerClass} role="status" aria-live="polite">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col items-center text-center max-w-xs w-full mx-4">
        <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
          <RankoraLogo size="sm" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
          {message}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          {subtitle}
        </p>
        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-4">
          <div className="bg-brand-500 h-full rounded-full w-1/3 animate-[pulse-subtle_1.5s_infinite_ease-in-out]" />
        </div>
      </div>
    </div>
  );
};

export const MetricCardsGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-slate-200 p-3 sm:p-3.5 shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="w-7 h-7 rounded-md" />
          </div>
          <Skeleton className="h-6 w-24 rounded" />
          <div className="flex items-center gap-1.5 pt-1">
            <Skeleton className="h-3.5 w-12 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-md shrink-0" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-2.5 w-40 rounded" />
        </div>
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-2.5 rounded ${i === 0 ? 'w-24' : 'w-16'}`}
          />
        ))}
      </div>

      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 h-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-6 h-6 rounded shrink-0" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-3 w-20 rounded hidden sm:block" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 220 }) => {
  return (
    <div
      className="w-full flex flex-col justify-between p-3.5 bg-slate-50/50 rounded-lg border border-slate-200 overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>

      <div className="flex-1 flex items-end gap-2 px-1 pb-1">
        {Array.from({ length: 12 }).map((_, i) => {
          const heights = [35, 60, 45, 80, 55, 90, 75, 85, 65, 95, 70, 80];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <Skeleton
                className="w-full rounded-t"
                style={{ height: `${heights[i % heights.length]}%` }}
              />
              <Skeleton className="h-2 w-4 rounded" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

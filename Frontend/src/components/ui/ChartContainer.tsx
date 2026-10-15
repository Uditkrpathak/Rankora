import React, { ErrorInfo, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { AlertCircle, BarChart3, RefreshCw } from 'lucide-react';

interface ChartErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          role="alert"
          aria-live="polite"
          className="flex flex-col items-center justify-center h-full min-h-[220px] p-6 text-center bg-slate-50/50 rounded-xl border border-dashed border-rose-200"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {this.props.fallbackTitle || 'Unable to render visualization'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred while parsing chart metrics.'}
          </p>
          {this.props.onRetry && (
            <button
              onClick={this.handleReset}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  height?: number | string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  action,
  height = 280,
  isLoading = false,
  isEmpty = false,
  emptyTitle = 'No chart data available',
  emptyMessage = 'Run a scan or track locations to generate analytics.',
  emptyAction,
  isError = false,
  errorMessage,
  onRetry,
  ariaLabel = 'Data Visualization Chart',
  children,
  className = '',
}) => {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-card transition-all ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div style={{ height, width: '100%' }} className="relative">
        {isLoading ? (
          <div 
            aria-label="Loading chart data"
            className="flex flex-col justify-between h-full w-full p-4 bg-white rounded-xl border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 w-28 shimmer rounded-md" />
              <div className="h-3 w-16 shimmer rounded-md" />
            </div>
            <div className="flex-1 flex items-end gap-3 px-1 pb-1">
              {[35, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 85].map((h, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full shimmer rounded-t-md"
                    style={{ height: `${h}%` }}
                  />
                  <div className="h-1.5 w-4 shimmer rounded-xs" />
                </div>
              ))}
            </div>
          </div>
        ) : isError ? (
          <div 
            role="alert"
            className="flex flex-col items-center justify-center h-full w-full p-6 text-center bg-rose-50/40 rounded-xl border border-rose-100"
          >
            <AlertCircle className="w-6 h-6 text-rose-500 mb-2" />
            <p className="text-xs font-semibold text-slate-800">
              {errorMessage || 'Failed to fetch graph data'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-white hover:bg-brand-50 border border-brand-200 rounded-lg transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Data</span>
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div 
            role="status"
            className="flex flex-col items-center justify-center h-full w-full p-6 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-3 shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-800">{emptyTitle}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">{emptyMessage}</p>
            {emptyAction && <div className="mt-3.5">{emptyAction}</div>}
          </div>
        ) : (
          <ChartErrorBoundary fallbackTitle={title} onRetry={onRetry}>
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  );
};

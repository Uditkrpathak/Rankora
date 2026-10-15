import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useGetGscPerformanceQuery, GscDailyDataPoint } from '../../../store/api/gscApi';
import { CHART_THEME, tooltipStyle } from '../../../lib/chart-theme';
import { Button } from '../../../components/ui/Button';
import {
  Globe,
  Info,
  Calendar,
  TrendingUp,
  MousePointerClick,
  Eye,
  Percent,
  Compass,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface GscPerformanceCardProps {
  workspaceId: string;
  locationId: string;
  onConnectClick?: () => void;
  className?: string;
}

type ActiveMetric = 'clicks' | 'impressions' | 'ctr' | 'averagePosition';

export const GscPerformanceCard: React.FC<GscPerformanceCardProps> = ({
  workspaceId,
  locationId,
  onConnectClick,
  className = '',
}) => {
  const [range, setRange] = useState<'28d' | '90d'>('28d');
  const [activeMetric, setActiveMetric] = useState<ActiveMetric>('impressions');

  const { data, isLoading, isError, refetch, isFetching } = useGetGscPerformanceQuery(
    { workspaceId, locId: locationId, range },
    { skip: !workspaceId || !locationId }
  );

  const status = data?.status;
  const totals = data?.totals;
  const daily = data?.daily || [];
  const dataNotes = data?.dataNotes;

  const lastDataDate = useMemo(() => {
    if (daily.length === 0) return null;
    return daily[daily.length - 1]?.date;
  }, [daily]);

  // Metric metadata
  const metricConfigs = {
    impressions: {
      label: 'Impressions',
      shortLabel: 'Impressions',
      color: '#0075F6',
      formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`),
      tooltipFormatter: (v: number) => `${v.toLocaleString()} impressions`,
      reversed: false,
      domain: [0, 'dataMax + 10'] as [number | string, number | string],
      icon: Eye,
    },
    clicks: {
      label: 'Web Search Clicks',
      shortLabel: 'Clicks',
      color: '#10b981',
      formatter: (v: number) => `${v}`,
      tooltipFormatter: (v: number) => `${v.toLocaleString()} web search clicks`,
      reversed: false,
      domain: [0, 'dataMax + 2'] as [number | string, number | string],
      icon: MousePointerClick,
    },
    ctr: {
      label: 'Click-Through Rate (CTR)',
      shortLabel: 'CTR',
      color: '#8b5cf6',
      formatter: (v: number) => `${(v * 100).toFixed(1)}%`,
      tooltipFormatter: (v: number) => `${(v * 100).toFixed(2)}%`,
      reversed: false,
      domain: [0, 'auto'] as [number | string, number | string],
      icon: Percent,
    },
    averagePosition: {
      label: 'Average Web Position',
      shortLabel: 'Avg Web Position',
      color: '#f59e0b',
      formatter: (v: number) => (v <= 0 ? '-' : `#${v.toFixed(1)}`),
      tooltipFormatter: (v: number) => (v <= 0 ? 'No data' : `#${v.toFixed(1)}`),
      reversed: true, // Lower number is better (top of page)
      domain: ['dataMin - 1', 'dataMax + 1'] as [number | string, number | string],
      icon: Compass,
    },
  };

  const currentConfig = metricConfigs[activeMetric];

  // Tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as GscDailyDataPoint;
      return (
        <div style={tooltipStyle}>
          <p className="font-semibold text-slate-200 mb-1.5">{point.date}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Impressions:</span>
              <span className="font-bold text-blue-400">{point.impressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Web Clicks:</span>
              <span className="font-bold text-emerald-400">{point.clicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">CTR:</span>
              <span className="font-bold text-purple-400">{(point.ctr * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Avg Web Position:</span>
              <span className="font-bold text-amber-400">
                {point.averagePosition <= 0 ? '-' : `#${point.averagePosition.toFixed(1)}`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5 ${className}`}>
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-600" />
              <span>Google Web Search Performance</span>
            </h3>
            {status === 'connected' && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Live GSC Data
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Organic web search traffic from Google Search Console. Independent of Maps local pack.
          </p>
        </div>

        {/* Range Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRange('28d')}
              className={`px-3 py-1 rounded-md transition ${
                range === '28d' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 28 Days
            </button>
            <button
              type="button"
              onClick={() => setRange('90d')}
              className={`px-3 py-1 rounded-md transition ${
                range === '90d' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 90 Days
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
            title="Refresh Search Console performance"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="space-y-4 py-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-60 rounded-xl bg-slate-100" />
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <div className="py-8 px-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-rose-900">Failed to load Search Console performance</h4>
            <p className="text-xs text-rose-700 max-w-sm mx-auto">
              We encountered a network issue communicating with Google Search Console.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry Query
          </Button>
        </div>
      )}

      {/* Not Connected State */}
      {!isLoading && !isError && status === 'not_connected' && (
        <div className="py-8 px-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">Google Search Console Not Connected</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Connect your verified Search Console property to monitor organic search clicks, search impressions, and striking distance opportunities.
            </p>
          </div>
          <div className="pt-1">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Globe className="w-3.5 h-3.5" />}
              onClick={onConnectClick}
            >
              Connect Search Console Property
            </Button>
          </div>
        </div>
      )}

      {/* No Data Yet / Sync In Progress State */}
      {!isLoading && !isError && status === 'no_data_yet' && (
        <div className="py-10 px-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">First sync in progress</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              We are synchronizing up to 16 months of organic search history from Google. This can take a few minutes for new properties.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Check status
          </Button>
        </div>
      )}

      {/* Connected & Live Performance Content */}
      {!isLoading && !isError && status === 'connected' && (
        <div className="space-y-5">
          {/* 4 Summary Stat Pills (Clickable to switch chart metric) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Impressions */}
            <button
              type="button"
              onClick={() => setActiveMetric('impressions')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                activeMetric === 'impressions'
                  ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/60 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Impressions</span>
                <Eye className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {totals?.impressions ? totals.impressions.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Google web search</div>
            </button>

            {/* Clicks */}
            <button
              type="button"
              onClick={() => setActiveMetric('clicks')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                activeMetric === 'clicks'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/60 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Web Clicks</span>
                <MousePointerClick className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {totals?.clicks ? totals.clicks.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Organic search clicks</div>
            </button>

            {/* CTR */}
            <button
              type="button"
              onClick={() => setActiveMetric('ctr')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                activeMetric === 'ctr'
                  ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400/60 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">CTR</span>
                <Percent className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {totals?.ctr ? `${(totals.ctr * 100).toFixed(1)}%` : '0.0%'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Clicks / impressions</div>
            </button>

            {/* Average Web Position */}
            <button
              type="button"
              onClick={() => setActiveMetric('averagePosition')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                activeMetric === 'averagePosition'
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/60 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Web Position
                </span>
                <Compass className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {totals?.averagePosition && totals.averagePosition > 0
                  ? `#${totals.averagePosition.toFixed(1)}`
                  : '—'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Impression-weighted</div>
            </button>
          </div>

          {/* Interactive Line Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <currentConfig.icon className="w-3.5 h-3.5" style={{ color: currentConfig.color }} />
                <span>{currentConfig.label} trajectory</span>
              </span>
              {currentConfig.reversed && (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                  Y-axis inverted: higher on chart is closer to #1
                </span>
              )}
            </div>

            <div className="h-64 w-full pt-2">
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.colors.grid} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fill: CHART_THEME.colors.axis,
                        fontSize: 10,
                        fontFamily: CHART_THEME.typography.fontFamily,
                      }}
                    />
                    <YAxis
                      reversed={currentConfig.reversed}
                      domain={currentConfig.domain}
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fill: CHART_THEME.colors.axis,
                        fontSize: 10,
                        fontFamily: CHART_THEME.typography.fontFamily,
                      }}
                      tickFormatter={currentConfig.formatter}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey={activeMetric}
                      stroke={currentConfig.color}
                      strokeWidth={2.5}
                      dot={daily.length < 35 ? { r: 2.5, fill: currentConfig.color } : false}
                      activeDot={{ r: 5, fill: currentConfig.color }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                  No data points available for this range.
                </div>
              )}
            </div>
          </div>

          {/* Under Chart: Data Notes & Lag Disclosure */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs text-slate-500">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p>
                  {dataNotes ||
                    'Google Search Console data reflects organic web search performance with an approximate 2-3 day reporting lag. Rare and anonymized queries are excluded by Google to protect user privacy.'}
                </p>
                {lastDataDate && (
                  <p className="text-[11px] font-semibold text-slate-600">
                    Latest data point available: <span className="font-mono">{lastDataDate}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

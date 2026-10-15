import React, { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHART_THEME, tooltipStyle } from '../../../lib/chart-theme';

export interface RankTrendDataPoint {
  date: string;
  visibilityScore: number;
  averageRank: number;
  top3Count?: number;
}

export interface RankTrendChartProps {
  data: RankTrendDataPoint[];
  metric?: 'visibility' | 'rank';
  height?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as RankTrendDataPoint;
    return (
      <div style={tooltipStyle}>
        <p className="font-semibold text-slate-200 mb-1">{d.date}</p>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Visibility Score:</span>
            <span className="font-bold text-brand-400">{d.visibilityScore}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Avg Local Rank:</span>
            <span className="font-bold text-white">
              {d.averageRank <= 0 ? 'Not in top 20' : d.averageRank > 20 ? '20+' : `#${d.averageRank.toFixed(1)}`}
            </span>
          </div>
          {d.top3Count !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Top 3 Keywords:</span>
              <span className="font-bold text-emerald-400">{d.top3Count}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const RankTrendChart: React.FC<RankTrendChartProps> = memo(
  ({ data, metric = 'visibility', height = 260 }) => {
    return (
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id="rankoraBrandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_THEME.colors.primary} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_THEME.colors.primary} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={CHART_THEME.colors.grid}
            />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: CHART_THEME.colors.axis,
                fontSize: CHART_THEME.typography.fontSizeSmall,
                fontFamily: CHART_THEME.typography.fontFamily,
              }}
            />

            <YAxis
              domain={metric === 'visibility' ? [0, 100] : ['dataMin - 1', 'dataMax + 1']}
              reversed={metric === 'rank'}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: CHART_THEME.colors.axis,
                fontSize: CHART_THEME.typography.fontSizeSmall,
                fontFamily: CHART_THEME.typography.fontFamily,
              }}
              tickFormatter={(val) => (metric === 'visibility' ? `${val}%` : `#${val}`)}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey={metric === 'visibility' ? 'visibilityScore' : 'averageRank'}
              stroke={CHART_THEME.colors.primary}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#rankoraBrandGrad)"
              dot={{
                r: 4.5,
                fill: '#ffffff',
                stroke: CHART_THEME.colors.primary,
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: CHART_THEME.colors.primary,
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
);

RankTrendChart.displayName = 'RankTrendChart';

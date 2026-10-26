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
import { CHART_THEME } from '../../../lib/chart-theme';

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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as RankTrendDataPoint;
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/95 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px] pointer-events-none">
        <p className="text-slate-500 text-[11px] font-semibold pb-1 border-b border-slate-100">
          {d.date}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
          <span className="text-slate-700 font-medium">Visibility</span>
          <span className="font-black text-slate-900 ml-auto">{d.visibilityScore}%</span>
        </div>
        {d.averageRank > 0 && (
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
            <span>Avg Rank</span>
            <span className="font-semibold text-slate-700 ml-auto">
              {d.averageRank > 20 ? '20+' : `#${d.averageRank.toFixed(1)}`}
            </span>
          </div>
        )}
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
            margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id="rankoraSplineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
            />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#f1f5f9' }}
              tick={{
                fill: '#64748b',
                fontSize: 11,
                fontFamily: CHART_THEME.typography.fontFamily,
              }}
              dy={6}
            />

            <YAxis
              domain={metric === 'visibility' ? [0, 100] : ['dataMin - 1', 'dataMax + 1']}
              ticks={metric === 'visibility' ? [0, 25, 50, 75, 100] : undefined}
              reversed={metric === 'rank'}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: '#64748b',
                fontSize: 11,
                fontFamily: CHART_THEME.typography.fontFamily,
              }}
              tickFormatter={(val) => (metric === 'visibility' ? `${val}%` : `#${val}`)}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey={metric === 'visibility' ? 'visibilityScore' : 'averageRank'}
              stroke="#0284c7"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#rankoraSplineGrad)"
              dot={{
                r: 3.5,
                fill: '#ffffff',
                stroke: '#0284c7',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5.5,
                fill: '#0284c7',
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

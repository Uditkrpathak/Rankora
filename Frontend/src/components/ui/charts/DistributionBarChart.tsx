import React, { memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CHART_THEME, tooltipStyle } from '../../../lib/chart-theme';

export interface DistributionDataPoint {
  label: string;
  value: number;
  color?: string;
  total?: number;
  score?: number;
  maxScore?: number;
}

export interface DistributionBarChartProps {
  data: DistributionDataPoint[];
  layout?: 'vertical' | 'horizontal';
  height?: number;
  unit?: string;
  yAxisWidth?: number;
}

const CustomBarTooltip = ({ active, payload, unit = '' }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as DistributionDataPoint;
    const hasPoints = typeof d.score === 'number' && typeof d.maxScore === 'number';
    return (
      <div style={tooltipStyle} className="p-2.5 rounded-xl shadow-lg border border-slate-700/50 bg-slate-900/95 text-white text-xs">
        <p className="font-bold text-slate-200">{d.label}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-extrabold text-brand-400 text-sm">
            {d.value}%
          </span>
          {hasPoints && (
            <span className="text-slate-400 text-[11px]">
              ({d.score} / {d.maxScore} {unit || 'pts'})
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Y-axis tick that truncates long pillar names cleanly on mobile
const RenderCustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const text = String(payload?.value || '');
  const isTruncated = text.length > 22;
  const displayText = isTruncated ? `${text.slice(0, 20)}…` : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-8}
        y={3}
        textAnchor="end"
        fill={CHART_THEME.colors.axis}
        fontSize={11}
        fontWeight={600}
        fontFamily={CHART_THEME.typography.fontFamily}
      >
        <title>{text}</title>
        {displayText}
      </text>
    </g>
  );
};

// Custom X-axis tick for horizontal layout to rotate cleanly and never collide
const RenderCustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const text = String(payload?.value || '');
  const isLong = text.length > 10;
  const displayText = text.length > 18 ? `${text.slice(0, 16)}…` : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={isLong ? 14 : 12}
        textAnchor={isLong ? 'end' : 'middle'}
        fill={CHART_THEME.colors.axis}
        fontSize={10}
        fontWeight={500}
        fontFamily={CHART_THEME.typography.fontFamily}
        transform={isLong ? 'rotate(-35)' : undefined}
      >
        <title>{text}</title>
        {displayText}
      </text>
    </g>
  );
};

export const DistributionBarChart: React.FC<DistributionBarChartProps> = memo(
  ({ data, layout = 'horizontal', height = 280, unit = '', yAxisWidth = 140 }) => {
    const isVertical = layout === 'vertical';

    return (
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={layout}
            margin={{
              top: 10,
              right: 15,
              left: isVertical ? 5 : -15,
              bottom: isVertical ? 0 : 25,
            }}
            accessibilityLayer
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={isVertical}
              stroke={CHART_THEME.colors.grid}
            />

            {!isVertical ? (
              <>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  height={55}
                  tick={<RenderCustomXAxisTick />}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tick={{
                    fill: CHART_THEME.colors.axis,
                    fontSize: CHART_THEME.typography.fontSizeSmall,
                    fontFamily: CHART_THEME.typography.fontFamily,
                  }}
                  tickFormatter={(v) => `${v}%`}
                />
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: CHART_THEME.colors.axis,
                    fontSize: CHART_THEME.typography.fontSizeSmall,
                    fontFamily: CHART_THEME.typography.fontFamily,
                  }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={yAxisWidth}
                  interval={0}
                  tick={<RenderCustomYAxisTick />}
                />
              </>
            )}

            <Tooltip content={<CustomBarTooltip unit={unit} />} />

            <Bar
              dataKey="value"
              radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
              maxBarSize={isVertical ? 18 : 32}
              minPointSize={3}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || CHART_THEME.colors.primary}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
);

DistributionBarChart.displayName = 'DistributionBarChart';


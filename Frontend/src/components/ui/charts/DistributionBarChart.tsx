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
}

export interface DistributionBarChartProps {
  data: DistributionDataPoint[];
  layout?: 'vertical' | 'horizontal';
  height?: number;
  unit?: string;
}

const CustomBarTooltip = ({ active, payload, unit = '' }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as DistributionDataPoint;
    return (
      <div style={tooltipStyle}>
        <p className="font-semibold text-slate-200">{d.label}</p>
        <p className="text-brand-400 font-bold mt-0.5">
          {d.value} {unit}
          {d.total ? ` (${Math.round((d.value / d.total) * 100)}%)` : ''}
        </p>
      </div>
    );
  }
  return null;
};

export const DistributionBarChart: React.FC<DistributionBarChartProps> = memo(
  ({ data, layout = 'horizontal', height = 220, unit = '' }) => {
    return (
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={layout}
            margin={{ top: 10, right: 10, left: layout === 'vertical' ? 10 : -20, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={layout === 'horizontal'}
              vertical={layout === 'vertical'}
              stroke={CHART_THEME.colors.grid}
            />

            {layout === 'horizontal' ? (
              <>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{
                    fill: CHART_THEME.colors.axis,
                    fontSize: 11,
                    fontFamily: CHART_THEME.typography.fontFamily,
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: CHART_THEME.colors.axis,
                    fontSize: CHART_THEME.typography.fontSizeSmall,
                    fontFamily: CHART_THEME.typography.fontFamily,
                  }}
                />
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: CHART_THEME.colors.axis,
                    fontSize: CHART_THEME.typography.fontSizeSmall,
                    fontFamily: CHART_THEME.typography.fontFamily,
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  tick={{
                    fill: CHART_THEME.colors.axis,
                    fontSize: CHART_THEME.typography.fontSizeSmall,
                    fontFamily: CHART_THEME.typography.fontFamily,
                  }}
                />
              </>
            )}

            <Tooltip content={<CustomBarTooltip unit={unit} />} />

            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36} minPointSize={3}>
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

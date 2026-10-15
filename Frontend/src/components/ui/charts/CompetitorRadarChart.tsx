import React, { memo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface CompetitorRadarDataPoint {
  category: string;
  myBusiness: number;
  marketAverage: number;
  topCompetitor?: number;
  fullMark?: number;
}

export interface CompetitorRadarChartProps {
  data: CompetitorRadarDataPoint[];
  height?: number;
}

const CustomRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0]?.payload;
    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-xl text-xs space-y-1.5 backdrop-blur-xs font-sans">
        <p className="font-bold text-slate-100 flex items-center gap-1.5 border-b border-slate-800 pb-1">
          <span>📊</span>
          <span>{item?.category}</span>
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                <span>{entry.name}:</span>
              </span>
              <span className="font-extrabold" style={{ color: entry.color }}>
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const CompetitorRadarChart: React.FC<CompetitorRadarChartProps> = memo(
  ({ data }) => {
    return (
      <div className="w-full h-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            cx="50%"
            cy="50%"
            outerRadius="65%"
            margin={{ top: 15, right: 35, bottom: 15, left: 35 }}
            data={data}
          >
            <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="category"
              tick={{
                fill: '#1e293b',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{
                fill: '#94a3b8',
                fontSize: 9,
                fontWeight: 600,
              }}
            />
            <Tooltip content={<CustomRadarTooltip />} />
            <Radar
              name="Your Business"
              dataKey="myBusiness"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="#3b82f6"
              fillOpacity={0.4}
            />
            <Radar
              name="Market Rivals Avg"
              dataKey="marketAverage"
              stroke="#d97706"
              strokeWidth={2}
              fill="#f59e0b"
              fillOpacity={0.2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }
);

CompetitorRadarChart.displayName = 'CompetitorRadarChart';


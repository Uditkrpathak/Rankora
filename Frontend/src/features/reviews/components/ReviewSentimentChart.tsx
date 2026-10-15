import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SentimentBucket } from '../../../store/api/reviewApi';

interface Props {
  data: SentimentBucket[];
  height?: number;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function formatDate(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  return `${MONTH_LABELS[month] || month} '${year?.slice(2)}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-xl p-3 text-xs space-y-1.5 min-w-[140px]">
      <p className="font-bold text-slate-800 mb-1">{formatDate(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-600 capitalize">{entry.name}:</span>
          <span className="font-bold text-slate-900 ml-auto">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const ReviewSentimentChart: React.FC<Props> = ({ data, height = 220 }) => {
  const chartData = useMemo(
    () => data.map((b) => ({ date: b.date, positive: b.positive, neutral: b.neutral, negative: b.negative })),
    [data]
  );

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Not enough review history to plot sentiment trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNeu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
        />
        <Area type="monotone" dataKey="positive" name="Positive" stroke="#10b981" strokeWidth={2} fill="url(#gradPos)" />
        <Area type="monotone" dataKey="neutral" name="Neutral" stroke="#94a3b8" strokeWidth={2} fill="url(#gradNeu)" />
        <Area type="monotone" dataKey="negative" name="Negative" stroke="#ef4444" strokeWidth={2} fill="url(#gradNeg)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};

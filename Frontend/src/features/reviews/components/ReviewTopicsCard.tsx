import React from 'react';
import { TopicEntry } from '../../../store/api/reviewApi';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  topics: TopicEntry[];
}

const SENTIMENT_CONFIG = {
  positive: {
    label: 'Positive',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/80',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    icon: TrendingUp,
    iconColor: 'text-emerald-600',
  },
  negative: {
    label: 'Negative',
    bg: 'bg-rose-50',
    border: 'border-rose-200/80',
    text: 'text-rose-700',
    bar: 'bg-rose-500',
    icon: TrendingDown,
    iconColor: 'text-rose-600',
  },
  mixed: {
    label: 'Mixed',
    bg: 'bg-amber-50',
    border: 'border-amber-200/80',
    text: 'text-amber-700',
    bar: 'bg-amber-400',
    icon: Minus,
    iconColor: 'text-amber-600',
  },
};

export const ReviewTopicsCard: React.FC<Props> = ({ topics }) => {
  const maxCount = Math.max(...topics.map((t) => t.count), 1);

  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        No topics extracted yet. Run a review sync to analyze customer feedback.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topics.map((topic) => {
        const cfg = SENTIMENT_CONFIG[topic.sentiment];
        const Icon = cfg.icon;
        const barWidth = Math.max(4, Math.round((topic.count / maxCount) * 100));

        return (
          <div key={topic.topic} className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                <span className={`text-xs font-bold ${cfg.text}`}>{topic.topic}</span>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                {cfg.label}
              </span>
            </div>

            {/* Bar */}
            <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${cfg.bar} rounded-full transition-all duration-500`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {topic.count} review{topic.count !== 1 ? 's' : ''} mention this
              </span>
              {topic.examples[0] && (
                <span className="text-[10px] text-slate-400 italic truncate max-w-[160px]">
                  "{topic.examples[0].slice(0, 60)}…"
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

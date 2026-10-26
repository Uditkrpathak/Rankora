import React from 'react';
import { Sparkles, ChevronUp, ChevronDown, X, ExternalLink } from 'lucide-react';

export interface IRecommendedTask {
  id: string;
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  metrics?: {
    targetValue: string | number;
    competitorMedian: string | number;
  };
  actionUrl?: string;
  sourceLabel?: string;
}

interface RecommendedActionsPanelProps {
  tasks: IRecommendedTask[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onDismissTask: (taskId: string) => void;
}

export const RecommendedActionsPanel: React.FC<RecommendedActionsPanelProps> = ({
  tasks,
  isOpen,
  onToggleOpen,
  onDismissTask,
}) => {
  if (tasks.length === 0) return null;

  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-2 text-left cursor-pointer group flex-1 min-w-0"
        >
          <div className="w-6 h-6 rounded-lg bg-[#006EEE] text-white flex items-center justify-center shrink-0">
            <Sparkles size={13} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#006EEE] transition truncate">
              Recommended Actions
            </h4>
            <span className="px-1.5 py-0.2 bg-blue-50 text-[#006EEE] border border-blue-200 rounded-full text-[10px] font-bold shrink-0">
              {tasks.length}
            </span>
          </div>
        </button>
        <button
          onClick={onToggleOpen}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition"
        >
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-2 pt-1 max-h-[380px] overflow-y-auto pr-0.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition space-y-1.5 relative group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      task.impact === 'HIGH'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : task.impact === 'MEDIUM'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {task.impact} Impact
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-[#006EEE] border border-blue-100">
                    {task.category}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismissTask(task.id);
                  }}
                  className="text-slate-300 hover:text-rose-500 p-0.5 rounded cursor-pointer transition opacity-70 group-hover:opacity-100"
                  title="Dismiss action"
                >
                  <X size={13} />
                </button>
              </div>

              <h5 className="text-[11px] font-bold text-slate-900 leading-snug">
                {task.title}
              </h5>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                {task.description}
              </p>

              {task.metrics && (
                <div className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>
                    Yours: <strong className="text-slate-800">{task.metrics.targetValue}</strong>
                  </span>
                  <span>
                    Top-3 Avg: <strong className="text-[#006EEE]">{task.metrics.competitorMedian}</strong>
                  </span>
                </div>
              )}

              {task.actionUrl && (
                <div className="pt-0.5 flex justify-end">
                  <a
                    href={task.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-[#006EEE] hover:text-[#005bc4] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Take Action in {task.sourceLabel || 'GBP'}</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

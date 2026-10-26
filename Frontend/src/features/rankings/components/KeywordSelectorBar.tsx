import React from 'react';
import { HelpCircle, Plus } from 'lucide-react';
import { ITrackedKeyword } from '@localo/types';

interface KeywordSelectorBarProps {
  trackedKeywords: ITrackedKeyword[];
  activeKeyword: string;
  onSelectKeyword: (keyword: string) => void;
  onOpenAddModal: () => void;
  scanCostLabel?: string;
  measuredSources?: string[];
  formattedScanDate?: string;
  keywordRelevanceWarning?: { warning: string; suggestions: string[] } | null;
  onSelectSuggestedKeyword?: (keyword: string) => void;
}

export const KeywordSelectorBar: React.FC<KeywordSelectorBarProps> = ({
  trackedKeywords,
  activeKeyword,
  onSelectKeyword,
  onOpenAddModal,
}) => {
  return (
    <div className="space-y-2.5">
      {/* Header Row: Title & Add Keyword Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <span>Keywords ({trackedKeywords.length})</span>
          <div className="relative group cursor-pointer inline-flex items-center">
            <HelpCircle size={13} className="text-slate-400 group-hover:text-slate-600" />
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-52 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal">
              Tracked local search terms scanned across the geographic grid.
            </div>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Plus size={13} />
          <span>Add Keyword</span>
        </button>
      </div>


      {/* Keyword Chips */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {trackedKeywords.map((kw) => {
          const isSelected = kw.keyword.trim().toLowerCase() === activeKeyword.trim().toLowerCase();
          const rankLabel =
            typeof kw.currentRank === 'number' && kw.currentRank > 0
              ? kw.currentRank > 20
                ? '20+'
                : kw.currentRank.toFixed(1)
              : null;

          return (
            <button
              key={kw._id || kw.id || kw.keyword}
              onClick={() => onSelectKeyword(kw.keyword)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#006EEE] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
              }`}
              title={rankLabel ? `Average Total Rank Position (ATRP): ${rankLabel}` : 'Tracked keyword'}
            >
              <span>{kw.keyword}</span>
              {rankLabel && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {rankLabel}
                </span>
              )}
            </button>
          );
        })}

        {trackedKeywords.length === 0 && (
          <div className="w-full p-3.5 rounded-xl bg-blue-50/50 border border-dashed border-blue-200 text-center space-y-2">
            <p className="text-xs font-medium text-slate-600">No tracked keywords for this business.</p>
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006EEE] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Target Keywords</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

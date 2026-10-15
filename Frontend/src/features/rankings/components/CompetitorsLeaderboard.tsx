import React from 'react';
import { HelpCircle, Eye, EyeOff, Star } from 'lucide-react';
import { TARGET_PLACE_ID } from '../rankTrackingConstants';

export interface AggregatedCompetitor {
  placeId: string;
  name: string;
  address?: string;
  primaryCategory?: string;
  rating?: number;
  reviewsCount?: number;
  bestRank: number;
  atrp: number;
  arp: number | null;
  solv: number;
  coveragePercent: number;
  occurrences: number;
  isTarget: boolean;
  standing?: number;
  photoUrl?: string;
}

interface CompetitorsLeaderboardProps {
  competitors: AggregatedCompetitor[];
  paginatedCompetitors: AggregatedCompetitor[];
  focusedPlaceId: string;
  onFocusCompetitor: (placeId: string) => void;
  competitorsHidden: boolean;
  onToggleHidden: () => void;
  measuredPointsCount: number;
  leaderboardPage: number;
  totalLeaderboardPages: number;
  onPageChange: (page: number) => void;
  hasScan: boolean;
  isTriggering: boolean;
}

export const CompetitorsLeaderboard: React.FC<CompetitorsLeaderboardProps> = ({
  competitors,
  paginatedCompetitors,
  focusedPlaceId,
  onFocusCompetitor,
  competitorsHidden,
  onToggleHidden,
  measuredPointsCount,
  leaderboardPage,
  totalLeaderboardPages,
  onPageChange,
  hasScan,
  isTriggering,
}) => {
  const totalMeasured = measuredPointsCount || 31;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
        <div className="flex items-center gap-1.5">
          <span>Competitor Leaderboard ({competitors.length})</span>
          <div className="relative group cursor-pointer inline-flex items-center">
            <HelpCircle size={13} className="text-slate-400 hover:text-slate-600" />
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-60 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
              Ranked by ATRP across all measured pins (unranked = 21). Showing competitors in ≥10% of measured pins.
            </div>
          </div>
        </div>
        <button
          onClick={onToggleHidden}
          className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          title={competitorsHidden ? 'Show competitors' : 'Hide competitors'}
        >
          {competitorsHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {!competitorsHidden && (
        <div className="space-y-2">
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {paginatedCompetitors.map((comp) => {
              const isFocused = focusedPlaceId === comp.placeId;
              return (
                <div
                  key={comp.placeId}
                  onClick={() => onFocusCompetitor(isFocused ? TARGET_PLACE_ID : comp.placeId)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                    isFocused
                      ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Rank Standing Badge */}
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                    <span className="text-xs font-black text-slate-800">#{comp.standing}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            comp.atrp <= 3
                              ? 'bg-emerald-100 text-emerald-800'
                              : comp.atrp <= 10
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          ATRP {comp.atrp.toFixed(1)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          SoLV {comp.solv.toFixed(0)}%
                        </span>
                        <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600">
                          Best #{comp.bestRank}
                        </span>
                      </div>

                      {comp.rating && (
                        <div className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600 shrink-0">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          <span>{comp.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 truncate mt-1">{comp.name}</h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                      <p className="truncate max-w-[140px]">{comp.address || comp.primaryCategory || 'Local competitor'}</p>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">
                        {comp.occurrences}/{totalMeasured} ({comp.coveragePercent}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {competitors.length === 0 && !isTriggering && (
              <div className="p-4 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                {hasScan ? 'No competitors with ≥10% pin coverage found.' : 'Select a keyword above to load rankings.'}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalLeaderboardPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] text-slate-500">
                Page {leaderboardPage} of {totalLeaderboardPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPageChange(Math.max(1, leaderboardPage - 1))}
                  disabled={leaderboardPage === 1}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[11px]"
                >
                  Prev
                </button>
                <button
                  onClick={() => onPageChange(Math.min(totalLeaderboardPages, leaderboardPage + 1))}
                  disabled={leaderboardPage === totalLeaderboardPages}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[11px]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

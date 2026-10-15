import React from 'react';
import { CompetitorRatingSnapshot } from '../../../store/api/reviewApi';
import { Trophy, Star } from 'lucide-react';

interface Props {
  yourRating: number;
  yourName: string;
  competitors: CompetitorRatingSnapshot[];
}

function RatingBar({ rating, max = 5, color }: { rating: number; max?: number; color: string }) {
  const pct = Math.round((rating / max) * 100);
  return (
    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const CompetitorBenchmarkCard: React.FC<Props> = ({ yourRating, yourName, competitors }) => {
  const all = [
    { name: yourName, rating: yourRating, reviewCount: 0, isYou: true },
    ...competitors.map((c) => ({ ...c, isYou: false })),
  ].sort((a, b) => b.rating - a.rating);

  const yourRank = all.findIndex((c) => c.isYou) + 1;

  if (competitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm gap-2">
        <Trophy className="w-6 h-6 text-slate-300" />
        <span>Run a geo-grid scan to discover competitors.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Rank badge */}
      <div className="flex items-center gap-2 mb-1">
        <Trophy className={`w-4 h-4 ${yourRank === 1 ? 'text-amber-500' : yourRank <= 3 ? 'text-slate-400' : 'text-slate-300'}`} />
        <span className="text-xs text-slate-600">
          You rank <strong className="text-slate-900">#{yourRank}</strong> out of {all.length} in your area
        </span>
      </div>

      {all.map((item, idx) => {
        const isYou = item.isYou;
        return (
          <div
            key={item.name + idx}
            className={`rounded-xl border p-3 ${
              isYou
                ? 'bg-brand-50/70 border-brand-200/80'
                : 'bg-white border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {idx === 0 && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <span
                  className={`text-xs font-bold truncate ${
                    isYou ? 'text-brand-700' : 'text-slate-800'
                  }`}
                >
                  {item.name}
                  {isYou && (
                    <span className="ml-1.5 text-[9px] font-extrabold bg-brand-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      You
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-xs font-bold text-slate-900">
                  {item.rating > 0 ? item.rating.toFixed(1) : '–'}
                </span>
                {(item as any).reviewCount > 0 && (
                  <span className="text-[10px] text-slate-400">
                    ({(item as any).reviewCount})
                  </span>
                )}
              </div>
            </div>
            <RatingBar
              rating={item.rating}
              color={isYou ? 'bg-brand-500' : idx === 0 ? 'bg-amber-400' : 'bg-slate-300'}
            />
          </div>
        );
      })}
    </div>
  );
};

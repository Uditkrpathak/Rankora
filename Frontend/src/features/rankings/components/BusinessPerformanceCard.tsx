import React from 'react';
import {
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  Trophy,
  TrendingUp,
  BarChart3,
  BarChart2,
} from 'lucide-react';
import { Location } from '../../../store/api/locationApi';
import { IScanRun } from '@localo/types';
import { BusinessAvatar } from '../../../components/ui/BusinessAvatar';
import { TARGET_PLACE_ID } from '../rankTrackingConstants';

interface BusinessPerformanceCardProps {
  selectedLocation: Location | null | undefined;
  focusedPlaceId: string;
  onFocusTarget: () => void;
  targetStanding: number | null;
  totalMarketCount: number;
  targetEntity: any;
  targetAtrp: number;
  targetVisibility: number;
  currentAreaDifficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  measuredPointsCount: number;
  totalGridPointsCount: number;
  formattedScanDate: string;
  currentScan?: IScanRun;
  atrpDelta?: number | null;
}

export const BusinessPerformanceCard: React.FC<BusinessPerformanceCardProps> = ({
  selectedLocation,
  focusedPlaceId,
  onFocusTarget,
  targetStanding,
  totalMarketCount,
  targetEntity,
  targetAtrp,
  targetVisibility,
  currentAreaDifficulty,
  measuredPointsCount,
  totalGridPointsCount,
  currentScan,
  atrpDelta,
}) => {
  const isTargetFocused = focusedPlaceId === TARGET_PLACE_ID;
  const coveragePct = totalGridPointsCount > 0 ? (measuredPointsCount / totalGridPointsCount) * 100 : 0;
  const isIncomplete = coveragePct < 80;

  const displayStanding = targetStanding || 1;
  const displayTotalMarket = totalMarketCount || 58;

  const difficultyLabel = currentAreaDifficulty === 'HIGH'
    ? 'High'
    : currentAreaDifficulty === 'LOW'
    ? 'Low'
    : 'Medium';

  const difficultyDescription = currentAreaDifficulty === 'HIGH'
    ? 'Strong local competition'
    : currentAreaDifficulty === 'LOW'
    ? 'Low local competition'
    : 'Moderate local competition';

  const isGbpConnected = Boolean(
    selectedLocation?.gbpLocationId &&
    selectedLocation?.googleConnectionId &&
    selectedLocation?.syncStatus !== 'STANDALONE'
  );

  return (
    <div
      onClick={onFocusTarget}
      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative bg-white ${
        isTargetFocused
          ? 'border-[#006EEE] ring-2 ring-[#006EEE]/15 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 shadow-2xs'
      }`}
    >
      {/* 1. Header: Avatar, Name, Address & Connected Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0">
            <BusinessAvatar
              name={selectedLocation?.name}
              coverPhotoUrl={selectedLocation?.coverPhotoUrl}
              logoUrl={selectedLocation?.logoUrl}
              website={selectedLocation?.website}
              category={selectedLocation?.categories?.[0] || (selectedLocation as any)?.primaryCategory?.displayName}
              size="md"
              className="w-12 h-12 rounded-xl border border-slate-200 bg-white object-cover"
            />
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-snug truncate">
              {selectedLocation?.name || 'Business name unavailable'}
            </h3>
            <p className="text-xs text-slate-500 truncate mt-0.5" title={selectedLocation?.address || ''}>
              {selectedLocation?.address || 'Address unavailable'}
            </p>
          </div>
        </div>

        {/* GBP Status Badge - Only shown when connected */}
        {isGbpConnected && (
          <div className="self-start sm:self-auto shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Google Business Profile connected</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Middle Metrics Row: 3 Columns */}
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 md:divide-x md:divide-slate-100">
        {/* Column 1: Overall Position */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
            <Trophy size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <span>Overall Position</span>
              <div className="relative group cursor-pointer inline-flex items-center">
                <HelpCircle size={12} className="text-slate-400 group-hover:text-slate-600" />
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-60 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                  Overall standing (#N of M) among all competitors appearing in the search area.
                </div>
              </div>
            </div>

            <div className="my-1">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-[#006EEE] text-white shadow-2xs inline-block">
                {targetEntity && targetEntity.occurrences > 0 ? `#${displayStanding} of ${displayTotalMarket}` : '20+'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 truncate">
              {displayStanding === 1 ? 'Ranked first' : `Ranked #${displayStanding}`} among {displayTotalMarket} results
            </p>
          </div>
        </div>

        {/* Column 2: Average Position (ATRP) */}
        <div className="flex items-start gap-3 md:pl-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <span>Average Position (ATRP)</span>
              <div className="relative group cursor-pointer inline-flex items-center">
                <HelpCircle size={12} className="text-slate-400 group-hover:text-slate-600" />
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-60 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                  Average Total Rank Position (ATRP) across all measured pins.
                </div>
              </div>
            </div>

            <div className="my-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900 leading-none">
                {targetAtrp.toFixed(1)}
              </span>
              {typeof atrpDelta === 'number' && atrpDelta !== 0 && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                  atrpDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {atrpDelta > 0 ? '▲' : '▼'} {Math.abs(atrpDelta).toFixed(1)}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 truncate">
              Across measured locations
            </p>
          </div>
        </div>

        {/* Column 3: Visibility (SoLV) */}
        <div className="flex items-start gap-3 md:pl-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
            <BarChart3 size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <span>Visibility (SoLV)</span>
              <div className="relative group cursor-pointer inline-flex items-center">
                <HelpCircle size={12} className="text-slate-400 hover:text-slate-600" />
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                  Percentage of measured pins where your business appears in the top 3 (Share of Local Voice).
                </div>
              </div>
            </div>

            <div className="my-1">
              <span className="text-xl font-black text-slate-900 leading-none">
                {targetVisibility.toFixed(0)}%
              </span>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, targetVisibility))}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 truncate">
              Share of local search visibility
            </p>
          </div>
        </div>
      </div>

      {/* 3. Bottom Footer Row: Area Difficulty & Google Maps Link */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Area Difficulty Pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isIncomplete
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : currentAreaDifficulty === 'HIGH'
                ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                : currentAreaDifficulty === 'LOW'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                : 'bg-amber-50 text-amber-800 border-amber-200/80'
            }`}
          >
            <BarChart2 size={13} className={currentAreaDifficulty === 'LOW' ? 'text-emerald-600' : 'text-amber-600'} />
            <span>Area difficulty: {isIncomplete ? 'Incomplete' : difficultyLabel}</span>
          </span>

          <div className="relative group cursor-pointer inline-flex items-center">
            <HelpCircle size={13} className="text-slate-400 hover:text-slate-600" />
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
              {isIncomplete
                ? 'Area difficulty is suppressed when scan coverage is below 80%.'
                : 'Competition intensity based on top-3 local pack authority, review volume, and rating density.'}
            </div>
          </div>

          <span className="text-slate-500 font-medium text-xs hidden sm:inline">
            {difficultyDescription}
          </span>
        </div>

        {/* Open in Google Maps Link */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${selectedLocation?.name || ''} ${selectedLocation?.address || ''}`
          )}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006EEE] hover:underline shrink-0"
        >
          <ExternalLink size={13} />
          <span>Open in Google Maps</span>
        </a>
      </div>
    </div>
  );
};

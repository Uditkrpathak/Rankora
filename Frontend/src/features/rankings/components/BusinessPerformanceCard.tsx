import React from 'react';
import { HelpCircle, ExternalLink } from 'lucide-react';
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
  formattedScanDate,
  currentScan,
}) => {
  const isTargetFocused = focusedPlaceId === TARGET_PLACE_ID;
  const coveragePct = totalGridPointsCount > 0 ? (measuredPointsCount / totalGridPointsCount) * 100 : 0;
  const isIncomplete = coveragePct < 80;

  return (
    <div
      onClick={onFocusTarget}
      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
        isTargetFocused
          ? 'bg-[#F0F7FF] border-[#BFDBFE] shadow-2xs ring-1 ring-blue-300/40'
          : 'bg-white border-slate-200 hover:border-blue-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Business Avatar / Thumbnail */}
        <div className="shrink-0">
          <BusinessAvatar
            name={selectedLocation?.name}
            coverPhotoUrl={selectedLocation?.coverPhotoUrl}
            logoUrl={selectedLocation?.logoUrl}
            website={selectedLocation?.website}
            category={selectedLocation?.categories?.[0] || (selectedLocation as any)?.primaryCategory?.displayName}
            size="md"
            className="w-12 h-12 rounded-xl border border-blue-100 bg-white shadow-2xs object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row: Overall Position Badge & ATRP */}
          <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
            <div className="relative group cursor-pointer inline-flex items-center">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#006EEE] text-white shadow-2xs flex items-center gap-1">
                <span>
                  Overall Position: {targetEntity && targetEntity.occurrences > 0 ? `#${targetStanding} of ${totalMarketCount}` : '20+'}
                </span>
                <HelpCircle size={10} className="opacity-80" />
              </span>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                Overall standing (#N of M) among all competitors appearing in the search area.
              </div>
            </div>

            <div className="relative group cursor-pointer inline-flex items-center">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <span>Avg Pos (ATRP): {targetAtrp.toFixed(1)}</span>
                <HelpCircle size={11} className="text-slate-400 group-hover:text-slate-600" />
              </span>
              <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-50 w-60 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                Average Total Rank Position (ATRP): {targetAtrp.toFixed(1)} across all {measuredPointsCount || 31} measured pins.
              </div>
            </div>
          </div>

          {/* Business Title and Address */}
          <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
            {selectedLocation?.name || 'Business name unavailable'}
          </h3>
          <p className="text-xs text-slate-500 truncate mt-0.5" title={selectedLocation?.address || ''}>
            {selectedLocation?.address || 'Address unavailable'}
          </p>

          {/* Visibility Row (SoLV) */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-600 flex items-center gap-1 font-medium">
              <span>Visibility (SoLV)</span>
              <div className="relative group cursor-pointer inline-flex items-center">
                <HelpCircle size={12} className="text-slate-400 hover:text-slate-600" />
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                  Percentage of measured pins where your business appears in the top 3 (Share of Local Voice).
                </div>
              </div>
            </span>
            <span className="font-bold text-slate-900">{targetVisibility.toFixed(1)}%</span>
          </div>

          {/* Area Difficulty Row */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-600 flex items-center gap-1 font-medium">
              <span>Area Difficulty:</span>
              <div className="relative group cursor-pointer inline-flex items-center">
                <HelpCircle size={12} className="text-slate-400 hover:text-slate-600" />
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg font-normal leading-normal">
                  {isIncomplete
                    ? 'Area difficulty is suppressed when scan coverage is below 80%.'
                    : 'Competition intensity based on top-3 local pack authority, review volume, and rating density.'}
                </div>
              </div>
            </span>
            {isIncomplete ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-300">
                Incomplete
              </span>
            ) : (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  currentAreaDifficulty === 'LOW'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : currentAreaDifficulty === 'HIGH'
                    ? 'bg-rose-50 text-rose-600 border-rose-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}
              >
                {currentAreaDifficulty || 'MEDIUM'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="mt-3 pt-2.5 border-t border-blue-200/50 flex items-center justify-between text-xs">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-slate-600">
            {measuredPointsCount
              ? `${measuredPointsCount} of ${totalGridPointsCount || 31} measured pins${
                  currentScan?.gridPoints && currentScan.gridPoints.length > measuredPointsCount
                    ? ` (${currentScan.gridPoints.length - measuredPointsCount} unavailable)`
                    : ''
                }`
              : 'No measured ranks yet'}
          </span>
          {formattedScanDate && formattedScanDate !== 'No saved scan' && (
            <span className="text-[10px] text-slate-400">Data as of {formattedScanDate}</span>
          )}
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${selectedLocation?.name || ''} ${selectedLocation?.address || ''}`
          )}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-semibold text-[#006EEE] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Open in Google</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ExternalLink, ChevronRight, Layers, Target, Play } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface GeoGridVisibilityCardProps {
  locationId?: string;
  locationName?: string;
  hasScans?: boolean;
  onLaunchScan?: () => void;
  className?: string;
}

export const GeoGridVisibilityCard: React.FC<GeoGridVisibilityCardProps> = ({
  locationId,
  locationName = 'Business',
  hasScans = false,
  onLaunchScan,
  className = '',
}) => {
  const targetUrl = `/rank-tracking?locationId=${encodeURIComponent(locationId || '')}`;

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                Geo-Grid Visibility
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Proximity & Google 3-Pack rank tracking
              </p>
            </div>
          </div>

          <span className="bg-sky-50 text-sky-700 border border-sky-200/80 font-bold text-[11px] px-2 py-0.5 rounded-full">
            Live Grid
          </span>
        </div>

        <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
          Visualize real-time local rankings across custom geographic coordinates around {locationName}.
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Multi-Pin Radius</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">3x3 to 7x7 grid points</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-semibold">
              <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Proximity Drop-off</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Rank distribution</p>
          </div>
        </div>
      </div>

      {/* Grid Action Buttons */}
      <div className="space-y-2 mt-2">
        <Link to={targetUrl} className="block">
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition shadow-xs cursor-pointer group"
          >
            <Compass className="w-4 h-4 text-white" />
            <span>Open Geo-Grid Map</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition" />
          </button>
        </Link>

        {onLaunchScan && (
          <button
            type="button"
            onClick={onLaunchScan}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-slate-500" />
            <span>Launch Coordinate Scan</span>
          </button>
        )}
      </div>
    </div>
  );
};

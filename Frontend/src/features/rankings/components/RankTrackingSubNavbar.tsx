import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeft,
  ListFilter,
  RefreshCw,
  Compass,
  Share2,
  FileDown,
  MoreVertical,
} from 'lucide-react';
import { Location } from '../../../store/api/locationApi';
import { IScanRun } from '@localo/types';

interface RankTrackingSubNavbarProps {
  locations: Location[];
  selectedLocationId: string;
  onSelectLocationId: (id: string) => void;
  requestedLocation?: Location;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileDrawer: () => void;
  onBack: () => void;
  currentScan?: IScanRun;
  isTriggering: boolean;
  scanRunning: boolean;
  onOpenShareModal: () => void;
  onOpenPdfModal: () => void;
  onOpenRadiusSettings: () => void;
  selectedRadiusKm: number;
  onRefreshScan: () => void;
  scanCostLabel: string;
  canRefresh: boolean;
  keywordsCount: number;
}

export const RankTrackingSubNavbar: React.FC<RankTrackingSubNavbarProps> = ({
  locations,
  selectedLocationId,
  onSelectLocationId,
  requestedLocation,
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileDrawer,
  onBack,
  currentScan,
  isTriggering,
  scanRunning,
  onOpenShareModal,
  onOpenPdfModal,
  onOpenRadiusSettings,
  selectedRadiusKm,
  onRefreshScan,
  scanCostLabel,
  canRefresh,
  keywordsCount,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="h-14 w-full bg-white border-b border-slate-200/90 px-3 sm:px-6 flex items-center justify-between shrink-0 z-40 shadow-2xs">
      {/* Left: Navigation, Profile Selector, Subtitle */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Back to Locations"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <button
          onClick={onToggleSidebar}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        <button
          onClick={onOpenMobileDrawer}
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[#006EEE] text-xs font-bold transition-colors cursor-pointer shadow-2xs"
        >
          <ListFilter size={14} />
          <span>Keywords ({keywordsCount})</span>
        </button>

        {/* Business Select Dropdown */}
        <select
          value={selectedLocationId}
          onChange={(e) => onSelectLocationId(e.target.value)}
          className="max-w-[190px] sm:max-w-[280px] font-bold text-xs sm:text-sm text-slate-900 bg-transparent border border-slate-200/80 hover:border-slate-300 rounded-lg px-2.5 py-1.5 truncate cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006EEE]/20"
          aria-label="Business profile"
        >
          {requestedLocation && !locations.some((l) => l._id === requestedLocation._id) && (
            <option value={requestedLocation._id}>{requestedLocation.name}</option>
          )}
          {locations.map((loc) => (
            <option value={loc._id} key={loc._id}>
              {loc.name}
            </option>
          ))}
        </select>

        <span className="hidden xl:inline text-xs text-slate-400 font-medium truncate">
          Measured Google Maps position map
        </span>
      </div>

      {/* Right: Clean, un-cluttered controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Radius Pill */}
        <button
          onClick={onOpenRadiusSettings}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          title="Configure 31-pin grid radius and center coordinates"
        >
          <Compass size={14} className="text-[#006EEE]" />
          <span>{selectedRadiusKm} km · 31 pins</span>
        </button>

        {/* Share & Export Actions */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            disabled={!currentScan}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
            title="More actions (Share, Export)"
          >
            <MoreVertical size={16} />
          </button>

          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs animate-in fade-in">
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenShareModal();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
              >
                <Share2 size={13} className="text-slate-400" />
                <span>Share Map</span>
              </button>
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenPdfModal();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
              >
                <FileDown size={13} className="text-slate-400" />
                <span>Export PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onRefreshScan}
          disabled={!canRefresh}
          className="primary-button inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          title={scanCostLabel}
        >
          <RefreshCw size={13} className={isTriggering || scanRunning ? 'animate-spin' : ''} />
          <span>{isTriggering || scanRunning ? 'Scanning…' : 'Refresh regional map'}</span>
        </button>
      </div>
    </header>
  );
};

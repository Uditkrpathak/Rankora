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
  Calendar,
  Building2,
  Clock,
  ChevronDown,
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
  formattedScanDate?: string;
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
  formattedScanDate,
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
      {/* Left: Navigation, Profile Selector, Scan Date */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          title="Back to Locations"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        <button
          onClick={onToggleSidebar}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
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
        <div className="relative flex items-center">
          <Building2 size={15} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <select
            value={selectedLocationId}
            onChange={(e) => onSelectLocationId(e.target.value)}
            className="pl-8 pr-7 py-1.5 font-bold text-xs sm:text-sm text-slate-900 bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 hover:border-slate-300 rounded-lg max-w-[190px] sm:max-w-[280px] truncate cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006EEE]/20 shadow-2xs appearance-none transition-colors"
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
          <ChevronDown size={14} className="absolute right-2 text-slate-400 pointer-events-none" />
        </div>

        {/* Scan Timestamp Pill */}
        {formattedScanDate && formattedScanDate !== 'No saved scan' ? (
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-xs text-slate-600 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-500/20" />
              <Calendar size={13} className="text-[#006EEE] shrink-0" />
              <span className="text-slate-500 font-medium">Scanned:</span>
            </div>
            <span className="font-semibold text-slate-800">{formattedScanDate}</span>
          </div>
        ) : (
          <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-400">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span>Ready to scan</span>
          </div>
        )}
      </div>

      {/* Right: Clean, un-cluttered controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Share & Export & Settings Actions */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
            title="More actions"
          >
            <MoreVertical size={16} />
          </button>

          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs animate-in fade-in">
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenRadiusSettings();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
              >
                <Compass size={13} className="text-slate-400" />
                <span>Grid Settings ({selectedRadiusKm} km)</span>
              </button>
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenShareModal();
                }}
                disabled={!currentScan}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer disabled:opacity-40"
              >
                <Share2 size={13} className="text-slate-400" />
                <span>Share Map</span>
              </button>
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenPdfModal();
                }}
                disabled={!currentScan}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer disabled:opacity-40"
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
          className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          title={scanCostLabel}
        >
          <RefreshCw size={13} className={isTriggering || scanRunning ? 'animate-spin' : ''} />
          <span>{isTriggering || scanRunning ? 'Scanning…' : 'Refresh regional map'}</span>
        </button>
      </div>
    </header>
  );
};

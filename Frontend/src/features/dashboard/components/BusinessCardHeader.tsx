import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BusinessAvatar } from '../../../components/ui/BusinessAvatar';
import { AuditScoreGauge } from './AuditScoreGauge';
import { useTogglePinMutation, useToggleOptimizationMutation } from '../../../store/api/locationApi';
import { useToast } from '../../../components/ui/Toast';
import {
  Pin,
  ShieldAlert,
  ShieldCheck,
  Compass,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Layers,
  QrCode,
  MessageSquare,
} from 'lucide-react';
import { ReviewBoosterModal } from '../../reviews/components/ReviewBoosterModal';

interface BusinessCardHeaderProps {
  location: {
    _id: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    coverPhotoUrl?: string;
    logoUrl?: string;
    isPinned?: boolean;
    auditScore?: number | null;
    auditUnknownCount?: number | null;
    auditRulesVersion?: string | null;
    optimization?: { enabled: boolean };
  };
  workspaceId: string;
  onLaunchScan?: () => void;
  onDelete: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const BusinessCardHeader: React.FC<BusinessCardHeaderProps> = ({
  location,
  workspaceId,
  onLaunchScan,
  onDelete,
  isSelected = false,
  onToggleSelect,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [boosterOpen, setBoosterOpen] = useState(false);
  const [togglePin, { isLoading: isPinning }] = useTogglePinMutation();
  const [toggleOptimization, { isLoading: isTogglingOpt }] = useToggleOptimizationMutation();

  const isPinned = Boolean(location.isPinned);
  const isOptEnabled = Boolean(location.optimization?.enabled);
  const fullAddress =
    location.address ||
    `${location.city || ''}, ${location.state || ''} ${location.country || ''}`.trim() ||
    'Storefront Coordinates';

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await togglePin({ workspaceId, locId: location._id }).unwrap();
      toast.success(isPinned ? 'Profile unpinned' : 'Profile pinned to top');
    } catch {
      toast.error('Failed to update pin state');
    }
  };

  const handleOptimizationToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleOptimization({
        workspaceId,
        locId: location._id,
        enabled: !isOptEnabled,
      }).unwrap();
      toast.success(
        !isOptEnabled ? 'Optimization enabled' : 'Optimization disabled'
      );
    } catch {
      toast.error('Failed to update optimization state');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 select-none">
      {/* Left: Checkbox + Pin + Avatar + Name + Address */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Selection Checkbox */}
        <input
          type="checkbox"
          aria-label={`Select ${location.name}`}
          checked={isSelected}
          onChange={onToggleSelect || (() => {})}
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
        />

        {/* Pin Button */}
        <button
          type="button"
          aria-label={isPinned ? 'Unpin profile' : 'Pin profile'}
          disabled={isPinning}
          onClick={handlePin}
          className={`p-1.5 rounded-lg transition mt-1 shrink-0 ${
            isPinned
              ? 'text-brand-600 bg-brand-50 hover:bg-brand-100'
              : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Pin
            className={`w-4 h-4 ${isPinned ? 'fill-brand-600 text-brand-600' : ''}`}
          />
        </button>

        {/* Business Avatar */}
        <div
          onClick={() => navigate(`/business/${location._id}`)}
          className="shrink-0 cursor-pointer"
        >
          <BusinessAvatar
            name={location.name}
            coverPhotoUrl={location.coverPhotoUrl}
            size="md"
            className="w-11 h-11 rounded-xl shadow-2xs"
          />
        </div>

        {/* Name, Address & Protection Shield */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              onClick={() => navigate(`/business/${location._id}`)}
              className="text-base font-bold text-slate-900 hover:text-brand-600 transition truncate cursor-pointer leading-tight"
            >
              {location.name}
            </h2>
          </div>

          <p
            title={fullAddress}
            className="text-xs text-slate-500 line-clamp-1 break-words leading-relaxed"
          >
            {fullAddress}
          </p>

          {/* Protection Shield Indicator */}
          {isOptEnabled && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <span
                title="Autopilot protection active"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Protected</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Audit Score + More Menu + View Map + Optimization Switch */}
      <div
        className="flex flex-col items-start lg:items-end gap-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top: Audit Score & More Menu */}
        <div className="flex items-center gap-4">
          <AuditScoreGauge
            score={location.auditScore}
            unknownCount={location.auditUnknownCount}
            rulesVersion={location.auditRulesVersion}
          />

          {/* Three dots menu */}
          <div className="relative">
            <button
              type="button"
              aria-label="More options"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-elevated py-1.5 z-30 text-xs"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <Link
                  to={`/rank-tracking?locationId=${location._id}`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  <Compass className="w-3.5 h-3.5 text-brand-600" />
                  <span>GeoGrid Heatmap</span>
                </Link>

                <Link
                  to={`/business/${location._id}`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <span>View Dashboard</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setBoosterOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-amber-800 hover:bg-amber-50 transition font-medium text-left"
                >
                  <QrCode className="w-3.5 h-3.5 text-amber-600" />
                  <span>QR Review Standee</span>
                </button>

                <Link
                  to={`/reviews`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                  <span>Reviews & AI Copilot</span>
                </Link>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 transition font-semibold text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Profile</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: View Map Pill Button + QR Review Stand + Optimization Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/rank-tracking?locationId=${location._id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold border border-brand-200/80 transition shadow-2xs"
          >
            <Compass className="w-3.5 h-3.5 text-brand-600" />
            <span>View Map</span>
          </Link>

          <button
            type="button"
            onClick={() => setBoosterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200/80 transition shadow-2xs cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-600" />
            <span>Review Stand</span>
          </button>

          {/* Optimization Toggle Switch */}
          <button
            type="button"
            disabled={isTogglingOpt}
            onClick={handleOptimizationToggle}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer select-none"
          >
            <span className="text-xs font-semibold text-slate-700">
              Optimization
            </span>
            <div
              className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${
                isOptEnabled ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform duration-200 ${
                  isOptEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      <ReviewBoosterModal
        isOpen={boosterOpen}
        onClose={() => setBoosterOpen(false)}
        location={{
          _id: location._id,
          name: location.name,
          address: location.address,
          city: location.city,
          placeId: (location as any).placeId,
          mapsCid: (location as any).mapsCid,
          averageRating: (location as any).averageRating,
          totalReviewCount: (location as any).totalReviewCount,
        }}
      />
    </div>
  );
};

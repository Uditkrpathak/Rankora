import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreVertical,
  Layers,
  Compass,
  Sparkles,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { Location } from '../../../store/api/locationApi';
import { BusinessAvatar } from '../../../components/ui/BusinessAvatar';

export interface LocationsListProps {
  locations?: Location[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  isLoading?: boolean;
  error?: any;
  onPageChange?: (page: number) => void;
  onSelectLocation?: (location: Location) => void;
  onDeleteLocation?: (locationId: string, name: string) => Promise<void> | void;
  onAddLocationClick?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const LocationsList: React.FC<LocationsListProps> = React.memo(({
  locations = [],
  total = 0,
  currentPage = 1,
  totalPages = 1,
  pageSize = 20,
  isLoading = false,
  error = null,
  onPageChange,
  onSelectLocation,
  onDeleteLocation,
  onAddLocationClick,
  onRetry,
  className = '',
}) => {
  const navigate = useNavigate();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId((prev) => (prev === id ? null : id));
  }, []);

  const handleCardClick = useCallback((loc: Location) => {
    if (onSelectLocation) {
      onSelectLocation(loc);
    }
  }, [onSelectLocation]);

  const handleDeleteClick = useCallback(async (e: React.MouseEvent, loc: Location) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (window.confirm(`Are you sure you want to delete "${loc.name}"? This action cannot be undone.`)) {
      if (onDeleteLocation) {
        await onDeleteLocation(loc._id, loc.name);
      }
    }
  }, [onDeleteLocation]);

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div
        data-testid="locations-skeleton"
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs animate-pulse"
          >
            <div className="h-36 bg-slate-200 w-full" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-slate-200 rounded w-full" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error State Banner
  if (error) {
    return (
      <div
        data-testid="locations-error"
        className="p-8 bg-red-50/70 border border-red-200 rounded-2xl text-center max-w-xl mx-auto my-8"
      >
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-bold text-red-900 mb-1">
          Failed to load locations
        </h3>
        <p className="text-xs text-red-700 mb-4">
          {error?.data?.error?.message || error?.message || 'We could not fetch your business profiles. Try refreshing.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            <span>Try Refreshing</span>
          </button>
        )}
      </div>
    );
  }

  // Empty State
  if (!locations || locations.length === 0) {
    return (
      <div
        data-testid="locations-empty"
        className="p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center max-w-lg mx-auto my-12"
      >
        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MapPin size={28} />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900 mb-1.5">
          No locations yet
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Add your first business profile to start tracking local Google Maps rankings, running SEO audits, and syncing reviews.
        </p>
        <button
          onClick={onAddLocationClick || (() => navigate('/locations/add'))}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Add Business Profile</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="locations-grid-container">
      {/* Cards Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.map((loc) => {
          const syncStatus = loc.syncStatus || 'STANDALONE';
          const primaryCat = loc.primaryCategory?.displayName || loc.categories?.[0] || 'Local Business';
          const rating = loc.cachedKpis?.averageRating ?? loc.averageRating;
          const reviews = loc.cachedKpis?.totalReviews ?? loc.totalReviewCount ?? 0;

          return (
            <div
              key={loc._id}
              data-testid={`location-card-${loc._id}`}
              onClick={() => handleCardClick(loc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(loc);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${loc.name}`}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 transition-all duration-200 shadow-xs hover:shadow-md overflow-hidden flex flex-col cursor-pointer group text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {/* Cover Photo Header (16:9 Aspect Ratio) */}
              <div className="relative aspect-16/9 bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-950 overflow-hidden shrink-0">
                {loc.coverPhotoUrl ? (
                  <img
                    src={loc.coverPhotoUrl}
                    alt={`${loc.name} cover`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
                )}

                {/* GBP Status Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  {syncStatus === 'SYNCED' && (
                    <span
                      data-testid="status-synced"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/90 text-white backdrop-blur-md shadow-xs"
                    >
                      <CheckCircle2 size={11} />
                      <span>Synced</span>
                    </span>
                  )}
                  {syncStatus === 'PENDING' && (
                    <span
                      data-testid="status-pending"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/90 text-white backdrop-blur-md shadow-xs"
                    >
                      <Clock size={11} />
                      <span>Pending</span>
                    </span>
                  )}
                  {syncStatus === 'ERROR' && (
                    <span
                      data-testid="status-error"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/90 text-white backdrop-blur-md shadow-xs"
                    >
                      <AlertCircle size={11} />
                      <span>Error</span>
                    </span>
                  )}
                  {syncStatus === 'STANDALONE' && (
                    <span
                      data-testid="status-standalone"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800/80 text-slate-200 backdrop-blur-md"
                    >
                      <span>Standalone</span>
                    </span>
                  )}
                </div>

                {/* Quick Action Context Menu Button */}
                <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => toggleMenu(e, loc._id)}
                    aria-label="More actions"
                    className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-md transition-all cursor-pointer"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuId === loc._id && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          handleCardClick(loc);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Layers size={14} className="text-blue-600" />
                        <span>View Details</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          navigate(`/rank-tracking?locId=${loc._id}`);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Compass size={14} className="text-blue-600" />
                        <span>View Geo-Grid Map</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          navigate(`/audits?locId=${loc._id}`);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Sparkles size={14} className="text-blue-600" />
                        <span>Run SEO Audit</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={(e) => handleDeleteClick(e, loc)}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>Delete Profile</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body Details */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <BusinessAvatar
                      name={loc.name}
                      logoUrl={loc.logoUrl}
                      coverPhotoUrl={loc.coverPhotoUrl}
                      category={primaryCat}
                      website={loc.website}
                      size="md"
                      className="w-11 h-11 rounded-xl shrink-0 -mt-8 ring-3 ring-white shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block truncate max-w-full">
                        {primaryCat}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 truncate mt-1">
                        {loc.name}
                      </h3>
                    </div>
                  </div>

                  {/* Address */}
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {loc.address}, {loc.city}, {loc.state} {loc.postalCode}
                  </p>
                </div>

                {/* Bottom Stats: Rating & Verification */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {rating !== null && rating !== undefined ? (
                    <div className="flex items-center gap-1 font-bold text-slate-800">
                      <Star size={13} className="fill-amber-500 text-amber-500" />
                      <span>{rating.toFixed(1)}</span>
                      <span className="text-slate-400 font-normal">
                        ({reviews} reviews)
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">No reviews yet</span>
                  )}

                  {loc.ownershipVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <ShieldAlert size={13} className="text-amber-500" />
                      <span>Places Profile</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div
          data-testid="locations-pagination"
          className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-600"
        >
          <div>
            Showing <span className="font-bold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-bold">{Math.min(currentPage * pageSize, total)}</span> of{' '}
            <span className="font-bold">{total}</span> locations
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange && onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous Page"
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1.5 font-bold text-slate-800 bg-slate-100 rounded-lg">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => onPageChange && onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next Page"
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

LocationsList.displayName = 'LocationsList';

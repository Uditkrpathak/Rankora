import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import {
  useLazySearchPlacesQuery,
  useAddFromPlacesSearchMutation,
} from '../../store/api/locationApi';
import {
  useLazyGetGoogleAuthUrlQuery,
  useGetGoogleStatusQuery,
  useLazyGetDiscoveredLocationsQuery,
  useImportLocationMutation,
} from '../../store/api/gbpApi';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  MapPin,
  X,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  Download,
  Clock,
  BarChart2,
  Settings,
  FileText,
  Plus,
  Star,
  Check,
} from 'lucide-react';

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const AddBusinessProfilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const toast = useToast();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [triggerSearch, { data: searchResults, isFetching: isSearching }] = useLazySearchPlacesQuery();
  const [addPlace] = useAddFromPlacesSearchMutation();
  const [triggerGetAuthUrl, { isFetching: isAuthUrlLoading }] = useLazyGetGoogleAuthUrlQuery();
  const { data: googleStatus } = useGetGoogleStatusQuery(workspaceId, { skip: !workspaceId });
  const isGoogleConnected = Boolean(googleStatus?.isConnected);
  const googleEmail = googleStatus?.googleEmail || '';

  const [
    triggerDiscover,
    {
      data: discoveredLocations = [],
      isFetching: isDiscovering,
      isUninitialized,
    },
  ] = useLazyGetDiscoveredLocationsQuery();

  const handleScanListings = () => {
    if (workspaceId) {
      triggerDiscover(workspaceId);
    }
  };

  const [importLocation] = useImportLocationMutation();
  const [importingGbpId, setImportingGbpId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2 && workspaceId) {
      triggerSearch({ workspaceId, q: debouncedQuery.trim() });
    }
  }, [debouncedQuery, workspaceId, triggerSearch]);

  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim().length >= 2 && workspaceId) {
      triggerSearch({ workspaceId, q: query.trim() });
    }
  };

  const handleImportGbp = async (loc: any) => {
    if (importingGbpId) return;
    setErrorMessage(null);
    setImportingGbpId(loc.gbpLocationId || loc.placeId);
    try {
      await importLocation({
        workspaceId,
        body: loc,
      }).unwrap();

      toast.success(`"${loc.name}" imported with verified Google ownership!`);
      navigate('/dashboard', {
        state: {
          activatedProfileName: loc.name,
          successMessage: `"${loc.name}" connected and synced successfully.`,
        },
      });
    } catch (err: any) {
      const msg = err?.data?.error?.message || 'Failed to import Google Business Profile.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setImportingGbpId(null);
    }
  };

  const handleSelectPlace = async (place: any) => {
    if (addingPlaceId) return;
    setErrorMessage(null);
    setAddingPlaceId(place.placeId);
    try {
      await addPlace({
        workspaceId,
        placeId: place.placeId,
      }).unwrap();

      toast.success(`"${place.name}" has been successfully added to your workspace!`);

      navigate('/locations', {
        state: {
          activatedProfileName: place.name,
          successMessage: `"${place.name}" added successfully to your workspace.`,
        },
      });
    } catch (err: any) {
      if (
        err?.data?.error?.code === 'LOCATION_ALREADY_ADDED' ||
        err?.data?.error?.code === 'PLACE_ALREADY_ADDED' ||
        err?.status === 409
      ) {
        const msg = `"${place.name}" has already been added to this workspace.`;
        setErrorMessage(msg);
        toast.error(msg);
      } else if (err?.data?.error?.code === 'LOCATION_LIMIT_EXCEEDED' || err?.status === 402) {
        const msg = 'You have reached the maximum number of active profiles on your plan.';
        setErrorMessage(msg);
        toast.error(msg);
      } else {
        const msg = err?.data?.error?.message || 'Failed to add business profile.';
        setErrorMessage(msg);
        toast.error(msg);
      }
    } finally {
      setAddingPlaceId(null);
    }
  };

  const handleConnectGoogle = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setErrorMessage(null);
      const res = await triggerGetAuthUrl(workspaceId).unwrap();
      if (res?.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      setErrorMessage(err?.data?.error?.message || 'Failed to initiate Google connection.');
    }
  };

  const places = searchResults?.results || [];

  return (
    <div className="min-h-screen w-full bg-white flex flex-col text-slate-900 antialiased selection:bg-[#006EEE] selection:text-white">
      <AppNavbar fullWidth={true} />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="w-full space-y-6 pb-20">
          {/* Header Bar */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Add a business
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Connect your Google Business Profile or add any business to track local search performance.
            </p>
          </div>

          {/* 3-Step Progress Stepper */}
          <div className="flex items-center justify-between gap-4 py-2 flex-wrap sm:flex-nowrap border-b border-slate-100 pb-4">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#006EEE] text-white flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Connect account</div>
                <div className="text-[11px] text-slate-500">Link your Google account</div>
              </div>
            </div>

            <div className="hidden sm:block flex-1 h-[1px] bg-slate-200 mx-3" />

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                2
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 leading-tight">Find business</div>
                <div className="text-[11px] text-slate-500">Search or choose a business</div>
              </div>
            </div>

            <div className="hidden sm:block flex-1 h-[1px] bg-slate-200 mx-3" />

            {/* Step 3 */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                3
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 leading-tight">Confirm details</div>
                <div className="text-[11px] text-slate-500">Verify and add to Rankora</div>
              </div>
            </div>
          </div>

          {/* 1. Primary Search Card - Positioned at the top for immediate visibility */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Find your business on Google Maps
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Search by business name, city, or full address.
              </p>
            </div>

            {/* Search Input Bar with Button */}
            <form onSubmit={handleManualSearch} className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search business here..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#006EEE] focus:ring-1 focus:ring-[#006EEE] transition"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSearching || query.trim().length < 2}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSearching ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                <span>Search</span>
              </button>
            </form>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Places Results List */}
            {isSearching ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2.5">
                <RefreshCw size={16} className="animate-spin text-[#006EEE]" />
                <span>Searching Google Maps places...</span>
              </div>
            ) : places.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                {places.map((place: any, idx: number) => {
                  const isThisAdding = addingPlaceId === place.placeId;
                  const categoryName = (place.category || place.resolvedCategory || place.primaryCategory)?.replace(/_/g, ' ');
                  return (
                    <div
                      key={place.placeId || idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-slate-50/70 transition bg-white"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {place.thumbnailUrl ? (
                          <img
                            src={place.thumbnailUrl}
                            alt={place.name}
                            className="w-14 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#006EEE] shrink-0">
                            <Building2 size={20} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {place.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="shrink-0 text-slate-400" />
                            <span className="truncate">{place.address}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-center shrink-0">
                        {categoryName && (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {categoryName}
                          </span>
                        )}

                        {typeof place.rating === 'number' && place.rating > 0 && (
                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <span>{place.rating.toFixed(1)}</span>
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {place.userRatingCount && (
                              <span className="text-[11px] text-slate-400 font-normal">
                                ({place.userRatingCount.toLocaleString()} reviews)
                              </span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectPlace(place)}
                          disabled={Boolean(addingPlaceId)}
                          className="px-4 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isThisAdding && <RefreshCw size={11} className="animate-spin text-[#006EEE]" />}
                          <span>{isThisAdding ? 'Adding...' : 'Select'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 ? (
              <div className="p-6 text-center text-slate-500 text-xs border border-slate-100 rounded-lg">
                No places found matching "<strong>{query}</strong>". Try searching for another name or address.
              </div>
            ) : null}
          </div>

          {/* 2. Secondary Section: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Card: Connect Google Business Profile */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <GoogleIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Connect Google Business Profile
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Import locations you manage on Google and start tracking their local search performance.
                  </p>
                </div>
              </div>

              {/* Connected State Banner */}
              {isGoogleConnected ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Google Business Profile connected
                      </div>
                      <div className="text-xs text-slate-600">
                        Linked to <span className="font-semibold text-slate-800">{googleEmail}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleScanListings}
                    disabled={isDiscovering}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer hover:border-slate-300 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isDiscovering ? 'animate-spin text-[#006EEE]' : ''} />
                    <span>{isDiscovering ? 'Scanning...' : 'Scan listings'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Link your Google Account
                    </div>
                    <div className="text-xs text-slate-600">
                      Sync verified business profiles directly from Google.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    disabled={isAuthUrlLoading}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    <GoogleIcon className="w-4 h-4 bg-white rounded-full p-0.5" />
                    <span>{isAuthUrlLoading ? 'Connecting...' : 'Connect Google Profile'}</span>
                  </button>
                </div>
              )}

              {/* 3 Value Propositions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">Import your locations</div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Bring in all businesses you manage on Google Business Profile.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
                    <BarChart2 size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">Track local performance</div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Monitor rankings, reviews and visibility for each location.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
                    <Settings size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">Keep in sync</div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      We'll sync your business info and new locations automatically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={handleScanListings}
                  disabled={isDiscovering}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#006EEE] hover:bg-[#005bc4] active:bg-[#004fa8] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Building2 size={15} />
                  <span>{isDiscovering ? 'Scanning...' : 'Find my locations'}</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock size={14} className="text-slate-400" />
                  <span>Last synced: Oct 23, 2026 at 9:56 AM</span>
                </div>
              </div>

              {/* Discovered Listings list (if any found) */}
              {discoveredLocations.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">
                    Discovered Google Business Profiles ({discoveredLocations.length}):
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {discoveredLocations.map((loc: any, idx: number) => {
                      const isThisImporting = importingGbpId === (loc.gbpLocationId || loc.placeId);
                      return (
                        <div
                          key={loc.gbpLocationId || loc.placeId || idx}
                          className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/60 transition bg-white"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[#006EEE] shrink-0">
                              <Building2 size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {loc.name}
                                </span>
                                {loc.primaryCategory && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {loc.primaryCategory}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate font-medium">
                                {loc.address || `${loc.city || ''}, ${loc.state || ''}`}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleImportGbp(loc)}
                            disabled={Boolean(importingGbpId) || loc.isImported}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                              loc.isImported
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'bg-[#006EEE] hover:bg-[#005bc4] text-white'
                            }`}
                          >
                            {isThisImporting ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                <span>Importing...</span>
                              </>
                            ) : loc.isImported ? (
                              <>
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                <span>Imported</span>
                              </>
                            ) : (
                              <>
                                <Download size={12} />
                                <span>Import & Track</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: How it works */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">How it works</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Add your business in just a few steps.
                </p>
              </div>

              <div className="space-y-5 pt-2">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
                    <Search size={15} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">Search for your business</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Find your business on Google Maps or import it from your connected account.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
                    <FileText size={15} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">Confirm the correct location</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Make sure you select the right business and address.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#006EEE] flex items-center justify-center shrink-0">
                    <BarChart2 size={15} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">Start tracking rankings</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      We'll add it to your workspace so you can track local search performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AddBusinessProfilesPage;

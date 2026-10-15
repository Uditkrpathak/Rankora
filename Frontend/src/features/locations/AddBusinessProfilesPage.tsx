import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../lib/hooks/useDebounce';
import {
  useLazySearchPlacesQuery,
  useAddFromPlacesSearchMutation,
} from '../../store/api/locationApi';
import { useLazyGetGoogleAuthUrlQuery } from '../../store/api/gbpApi';
import {
  ArrowLeft,
  Search,
  MapPin,
  X,
  RefreshCw,
  Sparkles,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2 && workspaceId) {
      triggerSearch({ workspaceId, q: debouncedQuery.trim() });
    }
  }, [debouncedQuery, workspaceId, triggerSearch]);

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

      // Navigate to /locations with success toast state
      navigate('/locations', {
        state: {
          activatedProfileName: place.name,
          successMessage: `"${place.name}" added successfully to your workspace.`,
        },
      });
    } catch (err: any) {
      if (err?.data?.error?.code === 'LOCATION_ALREADY_ADDED' || err?.data?.error?.code === 'PLACE_ALREADY_ADDED' || err?.status === 409) {
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
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div style={{ maxWidth: '820px', margin: '0 auto', padding: '10px 0 60px' }}>
        {/* Back Link */}
        <Link
          to="/locations"
          className="inline-flex items-center gap-2 text-xl font-black text-slate-900 tracking-tight hover:text-brand-600 transition mb-6"
        >
          <ArrowLeft size={20} />
          <span>Add Business Profiles</span>
        </Link>

        {/* Find your business Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-5">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1.5">
            Find your business
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-5 leading-relaxed">
            Search for your business exactly as customers would find its name on Google Maps.
          </p>

          {/* Blue Info Callout Box */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-100/90 rounded-2xl p-4 text-xs sm:text-sm text-slate-700 leading-relaxed mb-5 shadow-2xs">
            Want customers to always find you? Connect your Google account to{' '}
            <a
              href="#connect-google"
              onClick={handleConnectGoogle}
              className="text-brand-600 font-bold hover:underline cursor-pointer"
            >
              sync your Business Profiles
            </a>
            . You'll get tools to assist you with higher rankings in Google.
          </div>

          {/* Search Autocomplete Input */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />

            <input
              type="text"
              placeholder="Enter your business name or city..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-11 py-3.5 rounded-2xl border-2 border-brand-500/80 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 outline-none shadow-sm focus:ring-4 focus:ring-brand-500/15 focus:border-brand-600 transition"
              autoFocus
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Manual Entry Fallback Link */}
          <div className="mt-4 pt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Can't find your business on Google?</span>
            <Link
              to="/locations/manual-add"
              className="text-brand-600 font-bold hover:underline inline-flex items-center gap-1"
            >
              Enter details manually →
            </Link>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Autocomplete Dropdown List */}
        {query.trim().length >= 2 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-lg overflow-hidden">
            {isSearching ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2.5">
                <RefreshCw size={16} className="animate-spin text-brand-600" />
                <span>Searching Google Maps places...</span>
              </div>
            ) : places.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No places found matching "<strong>{query}</strong>". Try a different name, or{' '}
                <Link to="/locations/manual-add" className="text-brand-600 font-bold hover:underline">
                  add it manually
                </Link>.
              </div>
            ) : (
              <div>
                {places.map((place: any, index: number) => (
                  <div
                    key={place.placeId || index}
                    onClick={() => handleSelectPlace(place)}
                    className="flex items-center gap-3.5 p-4 sm:p-4.5 border-b border-slate-100 last:border-none hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    {/* Place Thumbnail / Avatar */}
                    <BusinessAvatar
                      name={place.name}
                      photoUrl={place.photoUrl || place.thumbnailUrl}
                      coverPhotoUrl={place.coverPhotoUrl}
                      logoUrl={place.logoUrl}
                      website={place.website}
                      category={place.category}
                      size="md"
                      className="w-11 h-11 rounded-xl shrink-0 shadow-2xs group-hover:scale-105 transition"
                    />

                    {/* Place Name & Full Address */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-extrabold text-slate-900 group-hover:text-brand-600 transition">
                          {place.name}
                        </span>
                        {(place.resolvedCategory || place.suggestedCategory || place.category) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                            <Sparkles size={10} />
                            {(place.resolvedCategory || place.suggestedCategory || place.category).replace(/_/g, ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate font-medium">
                        {place.address}
                      </div>
                    </div>

                    {(() => {
                      const isThisAdding = addingPlaceId === place.placeId;
                      return (
                        <button
                          type="button"
                          disabled={Boolean(addingPlaceId)}
                          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs hover:shadow active:scale-95 shrink-0 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isThisAdding && (
                            <RefreshCw size={12} className="animate-spin" />
                          )}
                          {isThisAdding ? 'Adding...' : 'Add'}
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default AddBusinessProfilesPage;

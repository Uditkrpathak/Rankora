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
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '18px',
            fontWeight: 800,
            color: '#0f172a',
            textDecoration: 'none',
            marginBottom: '24px',
            letterSpacing: '-0.02em',
          }}
        >
          <ArrowLeft size={18} />
          <span>Add Business Profiles</span>
        </Link>

        {/* Find your business Card (Matching Screenshots 1 & 2) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '28px 32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Find your business
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px' }}>
            Search for your business exactly as customers would use its name on Google.
          </p>

          {/* Blue Info Callout Box (Matching Screenshot 1) */}
          <div
            style={{
              background: '#f0f7ff',
              border: '1px solid #e0eeff',
              borderRadius: '12px',
              padding: '14px 18px',
              fontSize: '13px',
              color: '#334155',
              lineHeight: '1.5',
              marginBottom: '20px',
            }}
          >
            Want customers to always find you? Connect your Google account to{' '}
            <a
              href="#connect-google"
              onClick={handleConnectGoogle}
              style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
            >
              sync your Business Profiles
            </a>
            . You'll get tools to assist you with higher rankings in Google.
          </div>

          {/* Search Autocomplete Input (Matching Screenshot 1 & 2) */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />

            <input
              type="text"
              placeholder="Your Business Profile name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '13px 40px 13px 44px',
                borderRadius: '12px',
                border: '1.5px solid #3b82f6',
                fontSize: '14px',
                color: '#0f172a',
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                fontFamily: 'inherit',
              }}
              autoFocus
            />

            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Autocomplete Dropdown List (Matching Screenshot 2) */}
        {query.trim().length >= 2 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {isSearching ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite', color: '#2563eb' }} />
                <span>Searching Google Maps places...</span>
              </div>
            ) : places.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No places found matching "<strong>{query}</strong>". Try a different name or city.
              </div>
            ) : (
              <div>
                {places.map((place: any, index: number) => (
                  <div
                    key={place.placeId || index}
                    onClick={() => handleSelectPlace(place)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px 20px',
                      borderBottom: index < places.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: addingPlaceId ? 'wait' : 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
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
                      className="w-[42px] h-[42px] rounded-lg shrink-0"
                    />

                    {/* Place Name & Full Address */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '0 0 2px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                          {place.name}
                        </span>
                        {(place.resolvedCategory || place.suggestedCategory || place.category) && (
                          <span style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
                            background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                          }}>
                            <Sparkles size={11} />
                            {(place.resolvedCategory || place.suggestedCategory || place.category).replace(/_/g, ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {place.address}
                      </div>
                    </div>

                    {(() => {
                      const isThisAdding = addingPlaceId === place.placeId;
                      return (
                        <button
                          type="button"
                          disabled={Boolean(addingPlaceId)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isThisAdding ? '#2563eb' : '#2563eb',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: addingPlaceId ? 'wait' : 'pointer',
                            flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
                            opacity: (addingPlaceId && !isThisAdding) ? 0.4 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isThisAdding && (
                            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
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

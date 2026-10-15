import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { useToast } from '../../components/ui/Toast';
import {
  useLazySearchPlacesQuery,
  useLazyPreviewKeywordsQuery,
  useAddFromPlacesSearchMutation,
  PlaceSearchResult,
} from '../../store/api/locationApi';
import {
  ArrowLeft,
  Search,
  MapPin,
  Star,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShieldAlert,
  Globe,
  Sparkles,
  Layers,
} from 'lucide-react';

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

interface DraggableMapProps {
  initialLat: number;
  initialLng: number;
  currentLat: number;
  currentLng: number;
  onPinMove: (lat: number, lng: number) => void;
}

const LocationConfirmationMap: React.FC<DraggableMapProps> = ({
  initialLat,
  initialLng,
  currentLat,
  currentLng,
  onPinMove,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: true });
    map.setView([currentLat, currentLng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Initial Places geometry reference anchor
    L.circle([initialLat, initialLng], {
      radius: 40,
      color: '#94a3b8',
      fillColor: '#94a3b8',
      fillOpacity: 0.25,
      weight: 1.5,
      dashArray: '3, 3',
    }).addTo(map);

    // 300m threshold guide circle
    L.circle([initialLat, initialLng], {
      radius: 300,
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '4, 4',
    }).addTo(map);

    // Draggable custom pin marker
    const pinIcon = L.divIcon({
      className: 'custom-business-pin',
      html: `<div style="position:relative;width:34px;height:34px;background:#2563eb;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 3px 12px rgba(0,0,0,0.35);cursor:grab"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    const marker = L.marker([currentLat, currentLng], {
      draggable: true,
      icon: pinIcon,
    }).addTo(map);

    marker.bindTooltip('Drag this pin to adjust storefront location', { direction: 'top', offset: [0, -18] });

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onPinMove(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '250px',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
      }}
    />
  );
};

export const ManualAddPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPlace, setSuccessPlace] = useState<string | null>(null);

  const [confirmingPlace, setConfirmingPlace] = useState<PlaceSearchResult | null>(null);
  const [pinLat, setPinLat] = useState<number>(NaN);
  const [pinLng, setPinLng] = useState<number>(NaN);

  const [triggerSearch, { data: searchData, isFetching: isSearching }] = useLazySearchPlacesQuery();
  const [triggerPreview, { currentData: previewData, isFetching: isPreviewing, isError: previewFailed }] = useLazyPreviewKeywordsQuery();
  const [addPlace, { isLoading: isAdding }] = useAddFromPlacesSearchMutation();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (workspaceId && debouncedQuery.length >= 2) {
      setErrorMessage(null);
      triggerSearch({ workspaceId, q: debouncedQuery });
    }
  }, [debouncedQuery, workspaceId, triggerSearch]);

  const openConfirmation = (place: PlaceSearchResult) => {
    setConfirmingPlace(place);
    const coords = place.coordinates;
    if (coords && isValidCoordinate(coords.lat, coords.lng)) {
      setPinLat(coords.lat);
      setPinLng(coords.lng);
      setErrorMessage(null);
    } else {
      setPinLat(NaN);
      setPinLng(NaN);
      setErrorMessage(
        `Google Places did not return valid geographic coordinates for "${place.name}". Please select a location with verified coordinates.`
      );
    }

    if (workspaceId) {
      triggerPreview({
        workspaceId,
        placeId: place.placeId,
        name: place.name,
        lat: coords?.lat,
        lng: coords?.lng,
        city: place.city,
      });
    }
  };

  const handleConfirmAndAdd = async () => {
    if (!workspaceId || !confirmingPlace) return;
    if (!isValidCoordinate(pinLat, pinLng)) {
      setErrorMessage('Cannot confirm location: coordinates are missing or out of valid range (-90 to 90 lat, -180 to 180 lng).');
      return;
    }

    setErrorMessage(null);
    try {
      await addPlace({
        workspaceId,
        placeId: confirmingPlace.placeId,
        confirmedCoordinates: { lat: pinLat, lng: pinLng },
      }).unwrap();
      const placeName = confirmingPlace.name;
      setSuccessPlace(placeName);
      setConfirmingPlace(null);
      toast.success(`"${placeName}" has been successfully added to your workspace!`);
      setTimeout(() => navigate('/locations', {
        state: {
          activatedProfileName: placeName,
          successMessage: `"${placeName}" has been successfully added to your workspace.`,
        },
      }), 1200);
    } catch (err: any) {
      if (err?.data?.error?.code === 'LOCATION_ALREADY_ADDED' || err?.status === 409) {
        setErrorMessage('This business location is already added to your workspace.');
        toast.error('This business location is already added to your workspace.');
      } else if (err?.data?.error?.code === 'LOCATION_LIMIT_EXCEEDED' || err?.status === 402) {
        setErrorMessage('Location limit reached on your current plan. Please upgrade to add more locations.');
        toast.error('Location limit reached on your current plan.');
      } else {
        const msg = err?.data?.error?.message || 'Failed to add business location.';
        setErrorMessage(msg);
        toast.error(msg);
      }
    }
  };

  const origLat = confirmingPlace?.coordinates?.lat;
  const origLng = confirmingPlace?.coordinates?.lng;
  const hasValidOriginal = isValidCoordinate(origLat, origLng);
  const hasValidPin = isValidCoordinate(pinLat, pinLng);

  const distanceMovedMeters = (hasValidOriginal && hasValidPin)
    ? Math.round(
        6371e3 *
          2 *
          Math.atan2(
            Math.sqrt(
              Math.sin((((pinLat - origLat!) * Math.PI) / 180) / 2) ** 2 +
                Math.cos((origLat! * Math.PI) / 180) *
                  Math.cos((pinLat * Math.PI) / 180) *
                  Math.sin((((pinLng - origLng!) * Math.PI) / 180) / 2) ** 2
            ),
            Math.sqrt(
              1 -
                (Math.sin((((pinLat - origLat!) * Math.PI) / 180) / 2) ** 2 +
                  Math.cos((origLat! * Math.PI) / 180) *
                    Math.cos((pinLat * Math.PI) / 180) *
                    Math.sin((((pinLng - origLng!) * Math.PI) / 180) / 2) ** 2)
            )
          )
      )
    : 0;

  const isShiftExceeded = distanceMovedMeters > 300;
  const results = searchData?.results || [];

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <Link
            to="/locations/add"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 500, color: '#64748b',
              textDecoration: 'none', marginBottom: '12px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#2563eb')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <ArrowLeft size={14} /> Back to Add Business Profiles
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={20} style={{ color: '#2563eb' }} />
            Find Business Profile
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Search Google Places to add any public business for rank tracking, local SEO audits, and competitor monitoring.
          </p>
        </div>

        {/* Ownership notice */}
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: '#fffbeb', border: '1px solid #fcd34d',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          marginBottom: '20px',
        }}>
          <ShieldAlert size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '3px' }}>
              Public Lookup Mode (Unverified Ownership)
            </div>
            <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: '1.5' }}>
              Businesses added via Places search are enabled for <strong>read-only features</strong> (grid rank scans, 17-point audits, competitor tracking). Connect your Google account anytime to verify ownership and enable write features.
            </p>
          </div>
        </div>

        {/* Error */}
        {errorMessage && (
          <div style={{
            padding: '12px 16px', borderRadius: '10px',
            background: '#fef2f2', border: '1px solid #fecaca',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            marginBottom: '16px',
          }}>
            <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '13px', color: '#dc2626' }}>{errorMessage}</span>
          </div>
        )}

        {/* Success */}
        {successPlace && (
          <div style={{
            padding: '12px 16px', borderRadius: '10px',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '16px',
          }}>
            <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '13px', color: '#15803d' }}>
              Added <strong>"{successPlace}"</strong> — running initial audit...
            </span>
          </div>
        )}

        {/* Search Card */}
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0',
          borderRadius: '14px', padding: '24px', marginBottom: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '10px' }}>
            Business Name or Address
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Acme Dental Clinic, San Francisco..."
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: '42px', paddingRight: isSearching ? '42px' : '16px',
                paddingTop: '11px', paddingBottom: '11px',
                borderRadius: '8px', border: '1px solid #d1d5db',
                fontSize: '13px', color: '#0f172a',
                background: '#fafafa',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
                e.target.style.background = '#fff';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
                e.target.style.background = '#fafafa';
              }}
            />
            {isSearching && (
              <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  border: '2px solid #dbeafe', borderTopColor: '#2563eb',
                  animation: 'spin 1s linear infinite',
                }} />
              </div>
            )}
          </div>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 0' }}>
            Powered by live Google Places API search. Type any real business name or address to look up.
          </p>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {debouncedQuery.length >= 2 && !isSearching && results.length === 0 && (
            <div style={{
              padding: '48px 20px', textAlign: 'center',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}>
              <Building2 size={32} style={{ color: '#cbd5e1', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>
                No matching businesses found
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Try searching with a city name or specific street address.
              </p>
            </div>
          )}

          {results.map((place) => (
            <div
              key={place.placeId}
              style={{
                padding: '16px 20px', borderRadius: '12px',
                background: '#ffffff', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '16px', flexWrap: 'wrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{place.name}</span>
                  {place.category && (
                    <span style={{
                      fontSize: '11px', padding: '2px 10px', borderRadius: '20px',
                      background: '#eff6ff', color: '#2563eb',
                      border: '1px solid #bfdbfe', fontWeight: 500,
                    }}>
                      {place.category}
                    </span>
                  )}
                  {place.coordinates && isValidCoordinate(place.coordinates.lat, place.coordinates.lng) && (
                    <span style={{
                      fontSize: '10.5px', padding: '2px 8px', borderRadius: '6px',
                      background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 600,
                    }}>
                      📍 Verified Coordinates
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  <MapPin size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  <span>{place.address}</span>
                </div>
                
                {/* Real Verified Metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {place.country && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontWeight: 500 }}>
                      <Globe size={11} className="text-slate-400" />
                      Country: <strong>{place.country.toUpperCase()}</strong>
                    </span>
                  )}
                  {place.rating !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                      <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{place.rating.toFixed(1)}</span>
                      {place.userRatingCount && (
                        <span style={{ color: '#94a3b8' }}>({place.userRatingCount} reviews)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => openConfirmation(place)}
                disabled={isAdding}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 18px', borderRadius: '8px',
                  background: '#2563eb', color: '#fff',
                  fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                  opacity: isAdding ? 0.6 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => !isAdding && ((e.currentTarget as HTMLElement).style.background = '#1d4ed8')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#2563eb')}
              >
                <Plus size={14} /> Add Location
              </button>
            </div>
          ))}
        </div>

        {/* Confirm Business Location Step (Interactive Leaflet Map with Draggable Pin) */}
        {confirmingPlace && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              width: '100%', maxWidth: '600px', background: '#ffffff',
              borderRadius: '16px', border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={20} style={{ color: '#2563eb' }} />
                  Confirm Business Location Pin
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Drag the pin on the map to accurately place your customer storefront entrance.
                </p>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      {confirmingPlace.name}
                    </div>
                    {previewData?.category ? (
                      <span style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                        background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                      }}>
                        <Sparkles size={12} /> {previewData.category.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    ) : confirmingPlace.category ? (
                      <span style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                        background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 600,
                      }}>
                        {confirmingPlace.category}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '2px' }}>
                    {confirmingPlace.address}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span><strong>City:</strong> {confirmingPlace.city || 'N/A'}</span>
                    <span><strong>State:</strong> {confirmingPlace.state || 'N/A'}</span>
                    <span><strong>Postal:</strong> {confirmingPlace.postalCode || 'N/A'}</span>
                    <span><strong>Country:</strong> {confirmingPlace.country?.toUpperCase() || 'N/A'}</span>
                  </div>

                  {/* Real-time keyword preview (0 DB write) */}
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Sparkles size={13} style={{ color: '#2563eb' }} />
                      <span>Google Search Suggestions to Track:</span>
                      {isPreviewing && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>Finding suggestions...</span>}
                    </div>
                    {isPreviewing ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[1, 2, 3].map((i) => (
                          <div key={i} style={{ width: '90px', height: '22px', background: '#e2e8f0', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        ))}
                      </div>
                    ) : previewData?.keywords && previewData.keywords.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {previewData.keywords.map((k, idx) => (
                          <span
                            key={idx}
                            title={k.evidence}
                            style={{
                              fontSize: '11.5px',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              background: '#ffffff',
                              color: '#1e293b',
                              border: '1px solid #cbd5e1',
                              fontWeight: 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            🎯 {k.keyword}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {previewFailed
                          ? 'Google suggestions could not be loaded. You can still add the business and enter keywords manually.'
                          : previewData?.message || 'No Google suggestions are available yet. You can add keywords manually after adding the business.'}
                      </div>
                    )}
                    {previewData?.keywords && previewData.keywords.length > 0 && (
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', lineHeight: 1.5 }}>
                        {previewData.message} Exact profile search terms require a connected Google Business Profile.
                      </div>
                    )}
                  </div>
                </div>

                {/* Error if coordinates are invalid */}
                {!hasValidOriginal && (
                  <div style={{
                    padding: '12px 14px', borderRadius: '8px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}>
                    <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '12px', color: '#b91c1c', lineHeight: '1.4' }}>
                      <strong>Missing Verified Coordinates:</strong> Google Places did not supply valid coordinates for this business listing. Adding this location is disabled until verified coordinates are retrieved.
                    </div>
                  </div>
                )}

                {/* Interactive Map */}
                {hasValidOriginal && hasValidPin && (
                  <div>
                    <LocationConfirmationMap
                      initialLat={origLat!}
                      initialLng={origLng!}
                      currentLat={pinLat}
                      currentLng={pinLng}
                      onPinMove={(lat, lng) => {
                        setPinLat(lat);
                        setPinLng(lng);
                      }}
                    />
                  </div>
                )}

                {/* Warning when shifted > 300m */}
                {isShiftExceeded && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '8px',
                    background: '#fffbeb', border: '1px solid #fcd34d',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}>
                    <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '12px', color: '#92400e', lineHeight: '1.4' }}>
                      <strong>Pin shifted by {distanceMovedMeters} m:</strong> This pin is more than 300 meters from the Google Places verified geometry. Please ensure the pin corresponds to your storefront entrance.
                    </div>
                  </div>
                )}

                {/* Coordinate Readout */}
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '12px', color: '#475569', flexWrap: 'wrap', gap: '8px',
                }}>
                  <span>
                    📍 Pin: <strong style={{ fontFamily: 'monospace' }}>{hasValidPin ? `${pinLat.toFixed(6)}, ${pinLng.toFixed(6)}` : 'Invalid'}</strong>
                  </span>
                  <span>Offset: <strong>{distanceMovedMeters} m</strong></span>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafbfc',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
              }}>
                <button
                  type="button"
                  onClick={() => setConfirmingPlace(null)}
                  disabled={isAdding}
                  style={{
                    padding: '8px 16px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: '13px', fontWeight: 600, color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndAdd}
                  disabled={isAdding || !hasValidPin || !hasValidOriginal}
                  style={{
                    padding: '8px 20px', borderRadius: '8px',
                    border: 'none', background: '#2563eb',
                    fontSize: '13px', fontWeight: 600, color: '#ffffff',
                    cursor: (isAdding || !hasValidPin || !hasValidOriginal) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                    opacity: (isAdding || !hasValidPin || !hasValidOriginal) ? 0.5 : 1,
                  }}
                >
                  {isAdding ? 'Saving...' : 'Confirm & Add Location'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
      </main>
    </div>
  );
};



import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import {
  useGetDiscoveredLocationsQuery,
  useImportLocationMutation,
} from '../../../store/api/gbpApi';
import { IGbpDiscoveredLocation } from '@localo/types';
import {
  X,
  Download,
  Building2,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  RefreshCw,
  Globe,
} from 'lucide-react';

interface GbpImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GbpImportModal: React.FC<GbpImportModalProps> = ({ isOpen, onClose }) => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const {
    data: discoveredLocations = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetDiscoveredLocationsQuery(workspaceId, {
    skip: !isOpen || !workspaceId,
  });

  const [importLocation] = useImportLocationMutation();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessId, setImportSuccessId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLocations = discoveredLocations.filter((loc) => {
    const term = searchTerm.toLowerCase();
    return (
      loc.name.toLowerCase().includes(term) ||
      loc.address?.toLowerCase().includes(term) ||
      loc.city?.toLowerCase().includes(term)
    );
  });

  const handleImport = async (loc: IGbpDiscoveredLocation) => {
    setImportError(null);
    setImportSuccessId(null);
    setImportingId(loc.gbpLocationId);

    try {
      await importLocation({
        workspaceId,
        body: loc,
      }).unwrap();

      setImportSuccessId(loc.gbpLocationId);
      setTimeout(() => {
        setImportSuccessId(null);
      }, 3000);
    } catch (err: any) {
      const code = err?.data?.error?.code;
      if (code === 'LOCATION_LIMIT_EXCEEDED') {
        setImportError("You've reached your plan's location limit. Upgrade your subscription to import more locations.");
      } else {
        setImportError(err?.data?.error?.message || 'Failed to import location from Google.');
      }
    } finally {
      setImportingId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 60,
        }}
        onClick={onClose}
      />

      {/* Modal / Slideover */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '560px',
          maxWidth: '100vw',
          height: '100vh',
          background: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 35px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Download size={16} style={{ color: '#2563eb' }} />
              </div>
              <h2 style={{ color: '#0f172a', fontWeight: 800, fontSize: '18px', margin: 0 }}>
                Import Google Business Listings
              </h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 42px' }}>
              Select verified profiles to automatically import and sync in your workspace.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#64748b',
              padding: '7px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div
          style={{
            padding: '14px 28px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            gap: '12px',
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Filter by business name or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '9px',
                color: '#0f172a',
                fontSize: '13px',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            />
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '9px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: isFetching ? 'spin 0.7s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>

        {/* Import Error Banner */}
        {importError && (
          <div
            style={{
              margin: '16px 28px 0',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{importError}</div>
          </div>
        )}

        {/* Discovered Locations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '80px 0',
                gap: '12px',
              }}
            >
              <Loader2
                size={32}
                style={{ color: '#4f46e5', animation: 'spin 0.7s linear infinite' }}
              />
              <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                Discovering Google Business listings...
              </span>
            </div>
          ) : isError ? (
            (() => {
              const errData = (error as any)?.data?.error;
              const isNotConnected = errData?.code === 'GBP_NOT_CONNECTED';
              return (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '50px 24px',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: isNotConnected ? '#eff6ff' : '#fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    {isNotConnected ? (
                      <Globe size={26} style={{ color: '#2563eb' }} />
                    ) : (
                      <AlertTriangle size={26} style={{ color: '#dc2626' }} />
                    )}
                  </div>
                  <h3 style={{ color: '#0f172a', margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>
                    {isNotConnected ? 'Connect Google Account First' : 'Failed to discover locations'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '0 auto 20px', maxWidth: '380px', lineHeight: '1.5' }}>
                    {isNotConnected
                      ? 'You need to connect your Google Business Profile account before importing verified locations.'
                      : errData?.message ||
                        'Could not fetch Google Business listings. Check that the connected Google account manages the profile and that the Cloud project has Business Profile API access.'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    {isNotConnected ? (
                      <button
                        onClick={() => {
                          onClose();
                          window.location.href = '/locations/add';
                        }}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '10px',
                          background: '#2563eb',
                          border: 'none',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                        }}
                      >
                        Connect Google Account
                      </button>
                    ) : (
                      <button
                        onClick={() => refetch()}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '10px',
                          background: '#4f46e5',
                          border: 'none',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Retry Discovery
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          ) : filteredLocations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '14px',
              }}
            >
              <Building2 size={36} style={{ color: '#94a3b8', marginBottom: '12px' }} />
              <h3 style={{ color: '#0f172a', margin: '0 0 6px', fontSize: '15px', fontWeight: 700 }}>
                {searchTerm ? 'No matching listings found' : 'No listings discovered'}
              </h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0, maxWidth: '340px' }}>
                {searchTerm
                  ? 'Try searching with another keyword or city name.'
                  : 'Ensure that your connected Google account has access to verified Business Profile locations.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredLocations.map((loc) => {
                const isImported = Boolean(loc.isImported) || importSuccessId === loc.gbpLocationId;
                const isCurrentlyImporting = importingId === loc.gbpLocationId;
                const categories = [
                  loc.primaryCategory?.displayName,
                  ...(loc.secondaryCategories?.map((c) => c.displayName) || []),
                ].filter(Boolean) as string[];

                return (
                  <div
                    key={loc.gbpLocationId}
                    style={{
                      background: '#ffffff',
                      border: `1px solid ${
                        isImported ? '#bbf7d0' : '#e2e8f0'
                      }`,
                      borderRadius: '14px',
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: '14px',
                          }}
                        >
                          {loc.name}
                        </span>

                        {isImported && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            <CheckCircle2 size={11} />
                            IMPORTED
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          color: '#64748b',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={13} style={{ flexShrink: 0, color: '#94a3b8' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {loc.address}, {loc.city}, {loc.state} {loc.postalCode}
                          </span>
                        </div>

                        {loc.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} style={{ flexShrink: 0, color: '#94a3b8' }} />
                            <span>{loc.phone}</span>
                          </div>
                        )}

                        {categories.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '4px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {categories.slice(0, 2).map((cat: string, i: number) => (
                              <span
                                key={i}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                }}
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      {isImported ? (
                        <button
                          disabled
                          style={{
                            padding: '7px 14px',
                            borderRadius: '9px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            color: '#15803d',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'default',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          Added
                        </button>
                      ) : (
                        <button
                          id={`import-btn-${loc.gbpLocationId.replace(/[^a-zA-Z0-9]/g, '-')}`}
                          onClick={() => handleImport(loc)}
                          disabled={isCurrentlyImporting}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '9px',
                            background: '#4f46e5',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: isCurrentlyImporting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isCurrentlyImporting ? (
                            <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />
                          ) : (
                            <Download size={13} />
                          )}
                          Import
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#ffffff',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px',
              borderRadius: '9px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};

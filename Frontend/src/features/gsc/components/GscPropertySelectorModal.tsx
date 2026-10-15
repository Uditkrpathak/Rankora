import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import {
  useGetGscSitesQuery,
  useConnectGscLocationMutation,
  useGetGscAuthUrlQuery,
  GscSite,
} from '../../../store/api/gscApi';
import { Globe, ShieldCheck, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Search, Link2 } from 'lucide-react';

interface GscPropertySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  locationId: string;
  locationName?: string;
  locationWebsite?: string;
  currentSiteUrl?: string | null;
  onSuccess?: (siteUrl: string) => void;
}

export const GscPropertySelectorModal: React.FC<GscPropertySelectorModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  locationId,
  locationName = 'Business Location',
  locationWebsite,
  currentSiteUrl,
  onSuccess,
}) => {
  const toast = useToast();
  const { data: sites = [], isLoading, isError, error, refetch, isFetching } = useGetGscSitesQuery(workspaceId, {
    skip: !isOpen || !workspaceId,
  });
  const { data: authData } = useGetGscAuthUrlQuery(
    { workspaceId, linkToLocationId: locationId },
    { skip: !isOpen || !workspaceId }
  );
  const [connectGsc, { isLoading: isConnecting }] = useConnectGscLocationMutation();

  const [selectedSiteUrl, setSelectedSiteUrl] = useState<string>(currentSiteUrl || '');
  const [searchFilter, setSearchFilter] = useState('');

  // Auto-suggest matching property based on location website
  useEffect(() => {
    if (currentSiteUrl) {
      setSelectedSiteUrl(currentSiteUrl);
      return;
    }
    if (sites.length > 0 && locationWebsite) {
      try {
        const urlObj = new URL(locationWebsite.startsWith('http') ? locationWebsite : `https://${locationWebsite}`);
        const host = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        const matchingDomain = sites.find(
          (s) => s.siteUrl.toLowerCase() === `sc-domain:${host}` || s.siteUrl.toLowerCase().includes(host)
        );
        if (matchingDomain) {
          setSelectedSiteUrl(matchingDomain.siteUrl);
        } else if (!selectedSiteUrl && sites[0]) {
          setSelectedSiteUrl(sites[0].siteUrl);
        }
      } catch {
        if (!selectedSiteUrl && sites[0]) {
          setSelectedSiteUrl(sites[0].siteUrl);
        }
      }
    } else if (sites.length > 0 && !selectedSiteUrl) {
      setSelectedSiteUrl(sites[0].siteUrl);
    }
  }, [sites, locationWebsite, currentSiteUrl]);

  const handleConfirm = async () => {
    if (!selectedSiteUrl) {
      toast.error('Please select a verified Search Console property.');
      return;
    }

    try {
      await connectGsc({
        workspaceId,
        locId: locationId,
        siteUrl: selectedSiteUrl,
      }).unwrap();

      toast.success(`Search Console property connected. Initial sync started.`);
      onSuccess?.(selectedSiteUrl);
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error?.message || err?.data?.message || 'Failed to connect Search Console property.');
    }
  };

  const parseSiteDetails = (siteUrl: string) => {
    const isDomain = siteUrl.startsWith('sc-domain:');
    if (isDomain) {
      return {
        type: 'Domain',
        displayName: siteUrl.replace('sc-domain:', ''),
        raw: siteUrl,
        badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    }
    return {
      type: 'URL prefix',
      displayName: siteUrl,
      raw: siteUrl,
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

  const filteredSites = sites.filter((site) =>
    site.siteUrl.toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-brand-600" />
          <span>Select Search Console Property</span>
        </div>
      }
      description={`Connect a verified property to "${locationName}" to track organic web clicks and keyword impressions.`}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-600' : ''}`} />
            Refresh properties
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isConnecting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              isLoading={isConnecting}
              disabled={!selectedSiteUrl || sites.length === 0}
            >
              Confirm Property
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Loading State */}
        {isLoading && (
          <div className="py-8 text-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mx-auto" />
            <p className="text-xs text-slate-500">Loading verified properties from Google Search Console...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && isError && (() => {
          const errObj = error as any;
          const errorDetail =
            errObj?.data?.error?.message ||
            errObj?.data?.message ||
            (typeof errObj?.data === 'string' ? errObj.data : null);

          const handleReconnect = () => {
            if (authData?.authUrl) {
              sessionStorage.setItem('oauth_source', 'gsc');
              sessionStorage.setItem('oauth_return_url', window.location.pathname);
              window.location.href = authData.authUrl;
            } else {
              toast.error('Could not initiate Google OAuth redirect. Please try again from settings.');
            }
          };

          return (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Could not fetch properties</span>
              </div>
              <p className="text-rose-700 leading-relaxed">
                {errorDetail ||
                  'Google Search Console could not be reached or authorization has expired. Please verify your Google connection in settings.'}
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reconnect Google Search Console</span>
                </button>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-rose-700 font-bold hover:bg-rose-100/60 transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          );
        })()}

        {/* Empty State */}
        {!isLoading && !isError && sites.length === 0 && (
          <div className="py-6 px-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900">No verified Search Console properties found</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Your website must be added and verified in Google Search Console first before it can be connected to Rankora.
              </p>
            </div>
            {!locationWebsite && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/80">
                Notice: This location does not have a website URL set in profile details.
              </p>
            )}
            <div className="pt-1">
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-2xs"
              >
                <span>Add website in Google Search Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Sites List */}
        {!isLoading && !isError && sites.length > 0 && (
          <div className="space-y-3">
            {sites.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter properties..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
              {filteredSites.map((site) => {
                const parsed = parseSiteDetails(site.siteUrl);
                const isSelected = selectedSiteUrl === site.siteUrl;

                return (
                  <div
                    key={site.siteUrl}
                    onClick={() => setSelectedSiteUrl(site.siteUrl)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-brand-50/70 border-brand-300 ring-1 ring-brand-400/50 shadow-2xs'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${parsed.badgeCls}`}>
                          {parsed.type}
                        </span>
                        <span className="font-bold text-slate-900 truncate" title={parsed.raw}>
                          {parsed.displayName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Permission: {site.permissionLevel}</span>
                        {locationWebsite && parsed.displayName.includes(locationWebsite.replace(/^https?:\/\//, '')) && (
                          <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Matches profile website
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredSites.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">No properties match your filter.</p>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-normal flex items-start gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Connecting a property initiates a background sync of up to 16 months of historical organic search query analytics.
              </span>
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

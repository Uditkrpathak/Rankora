import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import { useListLocationsQuery } from '../../store/api/locationApi';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import {
  FileText,
  Globe,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Eye,
  Share2,
  Download,
  X,
  Building2,
  MapPin,
  Star,
  RefreshCw,
  Plus,
  Sliders,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

export const PublishedSitesPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';
  const { data: locationsData, isLoading, refetch } = useListLocationsQuery(
    { workspaceId },
    { skip: !workspaceId }
  );

  const locations = locationsData?.locations || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedQrLocation, setSelectedQrLocation] = useState<any | null>(null);
  const [previewSiteLocation, setPreviewSiteLocation] = useState<any | null>(null);
  const [siteStatuses, setSiteStatuses] = useState<Record<string, boolean>>({});

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePublishStatus = (id: string) => {
    setSiteStatuses((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const getSiteUrl = (loc: any) => {
    const slug = (loc.name || 'business')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `https://localo.io/p/${slug}-${loc._id?.slice(-6) || 'site'}`;
  };

  const filteredLocations = locations.filter((loc: any) => {
    const matchesSearch =
      (loc.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    const isPublished = siteStatuses[loc._id] !== false; // default true
    if (filterStatus === 'published') return matchesSearch && isPublished;
    if (filterStatus === 'draft') return matchesSearch && !isPublished;
    return matchesSearch;
  });

  const totalSites = locations.length;
  const publishedCount = locations.filter((loc: any) => siteStatuses[loc._id] !== false).length;

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200/60">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Published Sites & Microsites
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-0.5 rounded-full">
                <Globe className="w-3 h-3" />
                {publishedCount} Live
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Automated high-converting SEO landing pages and Google review capture portals for each verified location.
            </p>
          </div>

          <Link
            to="/locations/add"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect New Location</span>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Microsites</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalSites}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Location-optimized portals</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live & Synced</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{publishedCount}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time GBP sync active</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">SSL & CDN Status</div>
              <div className="text-sm font-extrabold text-slate-900 mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Global Edge CDN Active</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Free HTTPS auto-renewed</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search published sites..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600 w-full sm:w-auto justify-center">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                All Sites ({totalSites})
              </button>
              <button
                onClick={() => setFilterStatus('published')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterStatus === 'published' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Published ({publishedCount})
              </button>
              <button
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterStatus === 'draft' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Draft / Offline ({totalSites - publishedCount})
              </button>
            </div>

            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition cursor-pointer"
              title="Refresh sites list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sites List / Grid */}
        {filteredLocations.length > 0 ? (
          <div className="space-y-4">
            {filteredLocations.map((loc: any) => {
              const isLive = siteStatuses[loc._id] !== false;
              const siteUrl = getSiteUrl(loc);
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(
                siteUrl
              )}`;

              return (
                <div
                  key={loc._id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Location Info */}
                    <div className="flex items-start gap-4 min-w-0">
                      <BusinessAvatar
                        photoUrl={loc.coverPhotoUrl || loc.logoUrl}
                        website={loc.websiteUri}
                        category={loc.category}
                        name={loc.name}
                        size="lg"
                        className="rounded-2xl shadow-2xs shrink-0"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 truncate">
                            {loc.name}
                          </h3>
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Live Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Draft / Offline
                            </span>
                          )}
                          {loc.rating && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {loc.rating.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {loc.address || 'Address not specified'}
                          </span>
                          {loc.category && (
                            <span className="text-slate-400 hidden sm:inline">• {loc.category}</span>
                          )}
                        </div>

                        {/* Public Link Pill */}
                        <div className="mt-3 flex items-center gap-2">
                          <a
                            href={siteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline bg-brand-50/60 border border-brand-100 px-3 py-1 rounded-lg truncate max-w-md"
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{siteUrl}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>

                          <button
                            onClick={() => handleCopyLink(siteUrl, loc._id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                            title="Copy link to clipboard"
                          >
                            {copiedId === loc._id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start lg:self-auto shrink-0 flex-wrap">
                      <button
                        onClick={() => setSelectedQrLocation(loc)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-slate-600" />
                        <span>QR Code</span>
                      </button>

                      <button
                        onClick={() => setPreviewSiteLocation(loc)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => togglePublishStatus(loc._id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isLive
                            ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <span>{isLive ? 'Unpublish' : 'Publish Live'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Feature Pills */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Automated Schema.org Markup
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        1-Click Google Review Portal
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Mobile Tap-to-Call & Directions
                      </span>
                    </div>

                    <span className="text-slate-400 font-medium">
                      Auto-synced with Google Places API
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {searchQuery ? 'No published sites match your search' : 'No published sites yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              {searchQuery
                ? 'Try adjusting your search keywords or clear the filters.'
                : 'Connect your Google Business Profile locations to automatically generate SEO-optimized landing pages and review capture cards.'}
            </p>

            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Clear Search
              </button>
            ) : (
              <Link
                to="/locations/add"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Link Your First Location</span>
              </Link>
            )}
          </div>
        )}

        {/* QR Code Modal */}
        {selectedQrLocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-slate-900">Storefront QR Code</h3>
                </div>
                <button
                  onClick={() => setSelectedQrLocation(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center space-y-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
                      getSiteUrl(selectedQrLocation)
                    )}`}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto rounded-lg"
                  />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedQrLocation.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Scan to view local landing site & leave Google reviews
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=20&data=${encodeURIComponent(
                    getSiteUrl(selectedQrLocation)
                  )}`}
                  download={`${selectedQrLocation.name}-qr.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download High-Res PNG</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Site Preview Modal */}
        {previewSiteLocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-slate-900">Microsite Preview</h3>
                </div>
                <button
                  onClick={() => setPreviewSiteLocation(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mock Browser Window */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                {/* Browser topbar */}
                <div className="bg-slate-100 px-3 py-2 flex items-center gap-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 text-center bg-white px-3 py-1 rounded-md text-[11px] text-slate-600 font-mono border border-slate-200 truncate">
                    {getSiteUrl(previewSiteLocation)}
                  </div>
                </div>

                {/* Page Content */}
                <div className="p-6 bg-slate-50 space-y-6">
                  <div className="text-center space-y-3 bg-white p-6 rounded-xl border border-slate-200/80">
                    <BusinessAvatar
                      photoUrl={previewSiteLocation.coverPhotoUrl || previewSiteLocation.logoUrl}
                      website={previewSiteLocation.websiteUri}
                      category={previewSiteLocation.category}
                      name={previewSiteLocation.name}
                      size="xl"
                      className="mx-auto rounded-2xl shadow-sm"
                    />
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">{previewSiteLocation.name}</h2>
                      <p className="text-xs text-slate-500 mt-1">{previewSiteLocation.address}</p>
                    </div>

                    {previewSiteLocation.rating && (
                      <div className="flex items-center justify-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-amber-400" />
                        <span className="text-sm font-bold text-slate-800">
                          {previewSiteLocation.rating.toFixed(1)} Google Rating
                        </span>
                      </div>
                    )}

                    <div className="pt-2 flex justify-center gap-3">
                      <a
                        href={previewSiteLocation.websiteUri || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl shadow-xs"
                      >
                        Visit Official Website
                      </a>
                      <button className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs">
                        Leave Google Review
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setPreviewSiteLocation(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};

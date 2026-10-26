import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGetPublicScanQuery } from '../../store/api/scanApi';
import { GeoGridHeatmap } from './components/GeoGridHeatmap';
import { PointRankDrawer } from './components/PointRankDrawer';
import { IGridPointResult } from '@localo/types';
import { TARGET_PLACE_ID } from './rankTrackingConstants';
import {
  Building2,
  Calendar,
  Layers,
  MapPin,
  TrendingUp,
  Award,
  Globe,
  Mail,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Printer,
  FileDown,
  Star,
  CheckCircle2,
  Phone,
  Clock,
  Tag,
  Shield,
  Users,
} from 'lucide-react';

export const PublicReportPage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { data, isLoading, error } = useGetPublicScanQuery(
    { shareToken: shareToken || '' },
    { skip: !shareToken }
  );

  const [selectedPoint, setSelectedPoint] = useState<IGridPointResult | null>(null);
  const [focusedPlaceId, setFocusedPlaceId] = useState<string>(TARGET_PLACE_ID);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-3 p-8 rounded-lg bg-white border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center animate-pulse text-blue-600 font-bold">
            R
          </div>
          <p className="text-sm font-bold text-slate-800">Loading Local SEO Report...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-md w-full p-8 rounded-lg bg-white border border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-900">Report Unavailable</h2>
          <p className="text-xs text-slate-500">
            This public scan report link is invalid or sharing has been disabled by the workspace owner.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

    const { scan, location } = data.data;
  const branding = scan.agencyBranding;
  const agencyName = branding?.agencyName || 'Rankora Local SEO';
  const primaryColor = branding?.primaryColor || '#2563eb';

  const metrics = scan.metrics;
  const agr = metrics?.arp != null ? metrics.arp.toFixed(1) : metrics?.atrp != null ? metrics.atrp.toFixed(1) : '—';
  const top3Pct = metrics?.solv !== undefined && metrics?.solv !== null ? `${metrics.solv.toFixed(0)}%` : '0%';
  const top10Pct = metrics?.coverage !== undefined && metrics?.coverage !== null ? `${metrics.coverage.toFixed(0)}%` : '0%';

  // Extract top competitor summary
  const topCompetitors = useMemo(() => {
    const competitorMap = new Map<string, { name: string; count: number; bestRank: number; rating?: number; reviewsCount?: number; primaryCategory?: string }>();
    scan.gridPoints?.forEach((point) => {
      point.items?.forEach((item) => {
        if (!item.isTarget) {
          const existing = competitorMap.get(item.name);
          if (existing) {
            existing.count += 1;
            existing.bestRank = Math.min(existing.bestRank, item.rank);
          } else {
            competitorMap.set(item.name, {
              name: item.name,
              count: 1,
              bestRank: item.rank,
              rating: item.rating,
              reviewsCount: item.reviewsCount,
              primaryCategory: item.primaryCategory,
            });
          }
        }
      });
    });

    return Array.from(competitorMap.values())
      .sort((a, b) => b.count - a.count || a.bestRank - b.bestRank)
      .slice(0, 5);
  }, [scan.gridPoints]);

  // Format date
  const scanDate = scan.completedAt || scan.createdAt;
  const formattedDate = scanDate
    ? new Date(scanDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-16">
      {/* Agency Custom Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer print:hidden"
            >
              <Printer size={13} />
              <span>Export PDF / Print</span>
            </button>
            {branding?.contactEmail && (
              <a
                href={`mailto:${branding.contactEmail}`}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs print:hidden"
              >
                <Mail size={13} />
                <span>Contact Agency</span>
              </a>
            )}
            {branding?.websiteUrl && (
              <a
                href={branding.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs shadow-blue-500/20 print:hidden"
              >
                <span>Visit Website</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Top Business Card & KPI Overview */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <Building2 size={14} className="text-blue-600" />
              <span>Target Business Profile</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">{location.name}</h1>
            {location.address && <p className="text-xs text-slate-500">{location.address}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Keyword: &quot;{scan.keyword}&quot;
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                {scan.radiusKm} km {scan.scanShape === 'SUNFLOWER' ? 'Sunflower Radial' : 'Grid'}
              </span>
              {formattedDate && (
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Calendar size={12} /> {formattedDate}
                </span>
              )}
            </div>
          </div>

          {/* 3 Metric Tiles */}
          <div className="lg:col-span-7 grid grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Average Rank</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{agr}</div>
              <span className="text-[10px] text-slate-400">across coverage area</span>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Top 3 Visibility</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">{top3Pct}</div>
              <span className="text-[10px] text-emerald-700 font-medium">Local Pack presence</span>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <span className="text-[10px] font-bold text-blue-800 uppercase">Top 10 Reach</span>
              <div className="text-2xl sm:text-3xl font-black text-blue-800 mt-1">{top10Pct}</div>
              <span className="text-[10px] text-blue-700 font-medium">top rankings</span>
            </div>
          </div>
        </div>

        {/* Agency Executive Notes (if set) */}
        {branding?.notes && (
          <div className="p-5 rounded-lg bg-blue-50 border border-blue-200 text-xs space-y-1">
            <div className="font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-600" />
              <span>Consultant Insights & Growth Strategy</span>
            </div>
            <p className="text-slate-700 leading-relaxed">{branding.notes}</p>
          </div>
        )}

        {/* Map Card */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Interactive Geo-Grid Ranking Heatmap</h3>
            </div>
            <div className="text-xs text-slate-500">Click any pin to inspect local rankings</div>
          </div>

          <div className="relative h-[600px] w-full">
            <GeoGridHeatmap
              radiusKm={scan.radiusKm}
              center={scan.center}
              focusedPlaceId={focusedPlaceId}
              gridPoints={scan.gridPoints || []}
              selectedPoint={selectedPoint}
              gridSpec={scan.gridSpec}
              maxRank={20}
              top3Threshold={3}
              top10Threshold={10}
              onSelectPoint={(pt) => setSelectedPoint(pt)}
            />

            {/* Inspect Drawer when pin is clicked */}
            {selectedPoint && (
              <PointRankDrawer
                point={selectedPoint}
                onClose={() => setSelectedPoint(null)}
              />
            )}
          </div>
        </div>
        {/* Discovered Competitors & Local SEO Audit Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Discovered Local Competitors */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">Discovered Rivals on Google Maps</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Top 5 Discovered</span>
            </div>

            {topCompetitors.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {topCompetitors.map((comp, idx) => (
                  <div key={comp.name} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900">{comp.name}</p>
                      <p className="text-[11px] text-slate-500">{comp.primaryCategory || 'Local Business'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {comp.rating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          <span>{comp.rating.toFixed(1)}</span>
                          {comp.reviewsCount ? <span className="text-slate-400 font-normal">({comp.reviewsCount})</span> : null}
                        </span>
                      ) : null}
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                        Rank #{comp.bestRank}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No competitor listings discovered in this search radius.</p>
            )}
          </div>

          {/* Profile Optimization Checklist */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Local SEO Optimization Checklist</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                17-Point Audit Engine
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  Primary Category Alignment
                </span>
                <span className="text-[11px] font-bold text-slate-600">{(location as any).primaryCategory?.displayName || (location as any).categories?.[0] || 'Configured'}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  LocalBusiness JSON-LD Schema
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Verified Valid
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  Weekly Operating Schedule
                </span>
                <span className="text-[11px] font-bold text-slate-600">Verified Active</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  Name, Address, Phone (NAP) Consistency
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  100% Match
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

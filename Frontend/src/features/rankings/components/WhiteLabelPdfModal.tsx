import React, { useState } from 'react';
import { IScanRun } from '@localo/types';
import {
  X,
  Printer,
  FileDown,
  Building,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';

interface WhiteLabelPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  scan: IScanRun;
  locationName: string;
  locationAddress?: string;
  defaultAgencyName?: string;
}

export const WhiteLabelPdfModal: React.FC<WhiteLabelPdfModalProps> = ({
  isOpen,
  onClose,
  scan,
  locationName,
  locationAddress,
  defaultAgencyName = 'Rankora Local SEO Intelligence',
}) => {
  const [agencyName, setAgencyName] = useState(defaultAgencyName);
  const [clientName, setClientName] = useState(locationName);
  const [customNotes, setCustomNotes] = useState(
    'Audit conducted across the target service zone. Moving into the Top 3 positions in outer radial points will significantly boost foot traffic and Google Maps phone calls.'
  );

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const metrics = scan.metrics;
  const agr = metrics?.arp ? metrics.arp.toFixed(1) : metrics?.atrp ? metrics.atrp.toFixed(1) : 'N/A';
  const top3Pct = metrics?.solv !== undefined ? `${metrics.solv.toFixed(0)}%` : '0%';
  const top10Pct = metrics?.coverage !== undefined ? `${metrics.coverage.toFixed(0)}%` : '0%';
  const notFoundCount = metrics?.unrankedCount ?? 0;
  const totalPoints = scan.gridPoints?.length || (scan.pointCount ?? 0);

  // Extract top competitor summary
  const competitorMap = new Map<string, { name: string; count: number; bestRank: number; rating?: number }>();
  scan.gridPoints?.forEach((point: any) => {
    point.items?.forEach((item: any) => {
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
          });
        }
      }
    });
  });

  const topCompetitors = Array.from(competitorMap.values())
    .sort((a, b) => b.count - a.count || a.bestRank - b.bestRank)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Printer size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">White-Label PDF & Print Report</h3>
              <p className="text-xs text-slate-500">Executive client-ready local SEO ranking audit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <FileDown size={14} />
              <span>Export PDF / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div className="p-8 space-y-6 overflow-y-auto print:p-0 print:overflow-visible print:text-black">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                Local SEO & Geo-Grid Audit
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Prepared by <strong className="text-slate-800 font-bold">{agencyName}</strong>
              </p>
            </div>
            <div className="text-right text-xs">
              <div className="font-extrabold text-blue-600 text-sm">{agencyName}</div>
              <div className="text-slate-500 flex items-center gap-1 justify-end mt-1">
                <Calendar size={12} />
                <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Business & Keyword Meta */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Target Business</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">{clientName}</h3>
              {locationAddress && <p className="text-slate-500 text-[11px] mt-0.5">{locationAddress}</p>}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Target Search Keyword</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs">
                  {scan.keyword}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {scan.radiusKm} km {scan.scanShape === 'SUNFLOWER' ? 'Sunflower Radial' : 'Square Grid'}
                </span>
              </div>
            </div>
          </div>

          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Average Rank</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{agr}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Top 3 Visibility</span>
              <div className="text-2xl font-black text-emerald-800 mt-1">{top3Pct}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-700 uppercase">Top 10 Reach</span>
              <div className="text-2xl font-black text-blue-800 mt-1">{top10Pct}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Points Scanned</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalPoints}</div>
            </div>
          </div>

          {/* Competitor Leaderboard */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Award size={14} className="text-amber-500" />
              <span>Top Competitor Rankings in Service Zone</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Competitor Business</th>
                    <th className="py-2 px-3 text-center">Best Rank</th>
                    <th className="py-2 px-3 text-center">Rating</th>
                    <th className="py-2 px-3 text-right">Coverage Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topCompetitors.map((comp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{comp.name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          #{comp.bestRank}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-amber-600 font-bold">
                        {comp.rating ? `${comp.rating} ★` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 font-medium">
                        {comp.count} / {totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strategic Consultant Notes */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1 text-xs">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
              Agency Consultant Recommendations
            </div>
            <p className="text-slate-700 leading-relaxed">{customNotes}</p>
          </div>

          {/* Document Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <span>Generated with Rankora Local SEO Intelligence Engine</span>
            <span>Confidential Client Report</span>
          </div>
        </div>
      </div>
    </div>
  );
};

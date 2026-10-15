import React from 'react';
import { IGridPointResult } from '@localo/types';
import { X, MapPin, Star, ExternalLink } from 'lucide-react';

interface PointRankDrawerProps {
  point: IGridPointResult | null;
  onClose: () => void;
}

export const PointRankDrawer: React.FC<PointRankDrawerProps> = ({
  point,
  onClose,
}) => {
  if (!point) return null;
  const measured = point.observationState === 'OBSERVED' &&
    Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK');

  return (
    <>
      {/* Backdrop for easy dismiss */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-[999] transition-opacity"
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-[1000] flex flex-col transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">
              Search point
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-slate-500">
              {measured
                ? `Source: ${point.provider} · ${new Date(point.scannedAt).toLocaleTimeString()}`
                : 'Provider result unavailable'}
            </p>
            {((point as any).cached || point.provider === 'CACHE' || (point as any).costUsd === 0) && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                ⚡ CACHED (48h)
              </span>
            )}
            {(point as any).refunded && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                🛡️ Failed - retry available
              </span>
            )}
            {(point as any).cooling && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                ⏳ Proxy cooling 30min
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Target Status Banner */}
      <div className="p-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600 font-medium">Target Location Rank:</span>
          {!measured ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Unknown
            </span>
          ) : point.targetRank ? (
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                point.targetRank <= 3
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : point.targetRank <= 10
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              Rank #{point.targetRank}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Not found in first 20
            </span>
          )}
        </div>
      </div>

      {/* SERP Competitor List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Google Maps results
        </h4>

        {measured && point.items && point.items.length > 0 ? (
          <div className="space-y-2.5">
            {point.items.map((item, idx) => {
              const isTarget = item.isTarget;

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition ${
                    isTarget
                      ? 'bg-brand-50/80 border-brand-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2.5">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5 ${
                          item.rank <= 3
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.rank}
                      </span>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h5 className="text-xs font-bold text-slate-900 leading-snug">
                            {item.name}
                          </h5>
                          {isTarget && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-brand-600 text-white">
                              YOU
                            </span>
                          )}
                        </div>
                        {(item as any).category && (
                          <span className="text-[11px] text-slate-500">{(item as any).category}</span>
                        )}
                      </div>
                    </div>

                    {item.rating && (
                      <div className="flex items-center space-x-1 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex-shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span>{item.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {item.address && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-1">
                      {item.address}
                    </p>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address || ''}`)}${item.placeId && !/^(dfs_|serpapi_|google_place_)/.test(item.placeId) ? `&query_place_id=${encodeURIComponent(item.placeId)}` : ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            {measured ? 'No businesses were returned at this point.' : point.error || 'This point has no measured results.'}
          </div>
        )}
      </div>
    </div>
    </>
  );
};


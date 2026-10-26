import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IGridPointResult } from '@localo/types';
import { TARGET_PLACE_ID } from '../rankTrackingConstants';

interface GeoGridHeatmapProps {
  radiusKm: number;
  center: { lat: number; lng: number };
  focusedPlaceId: string;
  gridPoints: IGridPointResult[];
  comparisonPoints?: IGridPointResult[] | null;
  selectedPoint: IGridPointResult | null;
  gridSpec?: any | null;
  maxRank: number;
  top3Threshold: number;
  top10Threshold: number;
  onSelectPoint: (point: IGridPointResult) => void;
}

function isMeasured(point: IGridPointResult): boolean {
  return point.observationState === 'OBSERVED' &&
    Boolean(point.provider && point.provider.toUpperCase() !== 'MOCK');
}

function rankForPoint(point: IGridPointResult, focusedPlaceId: string): number | null {
  if (focusedPlaceId === TARGET_PLACE_ID) return point.targetRank;
  return point.items?.find((item) => item.placeId === focusedPlaceId)?.rank ?? null;
}

function rankAppearance(
  point: IGridPointResult,
  rank: number | null,
  maxRank: number,
  top3Threshold: number,
  top10Threshold: number
): { label: string; color: string; aura: string; tooltip: string } {
  if (!isMeasured(point)) {
    return {
      label: '—',
      color: '#64748b',
      aura: '#cbd5e1',
      tooltip: 'Measurement unavailable (search failed or timed out at this coordinate)',
    };
  }
  if (rank === null || rank > maxRank) {
    return {
      label: `${maxRank}+`,
      color: '#64748b',
      aura: '#94a3b8',
      tooltip: `Rank ${maxRank}+ (Target business not found in top ${maxRank} results)`,
    };
  }
  if (rank <= top3Threshold) {
    return { label: String(rank), color: '#10b981', aura: '#34d399', tooltip: `Rank #${rank}` };
  }
  if (rank <= top10Threshold) {
    return { label: String(rank), color: '#f59e0b', aura: '#fbbf24', tooltip: `Rank #${rank}` };
  }
  return { label: String(rank), color: '#f43f5e', aura: '#fb7185', tooltip: `Rank #${rank}` };
}

export const GeoGridHeatmap: React.FC<GeoGridHeatmapProps> = ({
  radiusKm,
  center,
  focusedPlaceId,
  gridPoints,
  comparisonPoints,
  selectedPoint,
  gridSpec,
  maxRank,
  top3Threshold,
  top10Threshold,
  onSelectPoint,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const circlesRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;

    const map = L.map(elementRef.current, { zoomControl: false, scrollWheelZoom: true });
    L.control.zoom({ position: 'topright' }).addTo(map);
    const tileUrl = (import.meta as any).env?.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tileUrl, {
      maxZoom: 19,
      className: 'clean-light-map-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    circlesRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    map.setView([center.lat, center.lng], 12);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (elementRef.current) {
      resizeObserver.observe(elementRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      circlesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    const circles = circlesRef.current;
    if (!map || !markers || !circles) return;

    markers.clearLayers();
    circles.clearLayers();

    // 1. Soft focus mask: dims everything outside the scan radius so only the search area is illuminated
    const worldBounds: [number, number][] = [
      [-85, -180],
      [-85, 180],
      [85, 180],
      [85, -180],
    ];
    const circleHole: [number, number][] = [];
    const numHoleSteps = 72;
    const outerRadiusM = radiusKm * 1000;
    const latRad = (center.lat * Math.PI) / 180;
    const cosLat = Math.max(Math.cos(latRad), 0.001);
    for (let i = 0; i <= numHoleSteps; i++) {
      const angle = (i * 2 * Math.PI) / numHoleSteps;
      const dLat = (outerRadiusM / 111320) * Math.sin(angle);
      const dLng = (outerRadiusM / (111320 * cosLat)) * Math.cos(angle);
      circleHole.push([center.lat + dLat, center.lng + dLng]);
    }
    L.polygon([worldBounds, circleHole], {
      color: 'transparent',
      weight: 0,
      fillColor: '#0f172a',
      fillOpacity: 0.22,
      interactive: false,
    }).addTo(circles);

    // Draw coverage circle and concentric ring guidelines ONLY when gridSpecVersion === 2
    const isV2Geometry = gridSpec?.gridSpecVersion === 2;
    const ringFractions = isV2Geometry ? (gridSpec?.ringFractions || [0.40, 0.70, 1.00]) : [1.00];

    for (const fraction of ringFractions) {
      const isOuter = fraction === 1.0;
      const ringRadiusMeters = radiusKm * 1000 * fraction;
      L.circle([center.lat, center.lng], {
        radius: ringRadiusMeters,
        color: isOuter ? '#2563eb' : '#94a3b8',
        weight: isOuter ? 2 : 1,
        dashArray: isOuter ? undefined : '4, 4',
        opacity: isOuter ? 0.8 : 0.4,
        fillColor: '#3b82f6',
        fillOpacity: isOuter ? 0.02 : 0,
      }).addTo(circles);
    }

    // Business storefront center anchor marker
    const centerPinHtml = `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="position:absolute;width:24px;height:24px;border-radius:50%;background:#3b82f6;opacity:0.3;animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></span>
      </div>
    `;
    const centerIcon = L.divIcon({
      className: 'storefront-center-node',
      html: centerPinHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker([center.lat, center.lng], { icon: centerIcon, zIndexOffset: 1200 })
      .bindTooltip('Storefront Location (Center)', { direction: 'bottom', offset: [0, 8] })
      .addTo(markers);

    // The server is the sole source of points.
    const savedPoints = gridPoints.filter((point) => {
      const lat = point.searchLat ?? point.lat;
      const lng = point.searchLng ?? point.lng;
      return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });
    const circleRadiusMeters = Math.max(250, radiusKm * 1000 * 0.15);

    for (const point of savedPoints) {
      const measured = isMeasured(point);
      const rank = measured ? rankForPoint(point, focusedPlaceId) : null;
      const appearance = rankAppearance(point, rank, maxRank, top3Threshold, top10Threshold);
      const selected = selectedPoint?.row === point.row && selectedPoint?.col === point.col;

      const locDetail = point.distanceKm !== undefined
        ? point.distanceKm === 0
          ? ' · Center'
          : ` · ${point.distanceKm.toFixed(1)} km from center`
        : '';
      const tooltipText = `${appearance.tooltip}${locDetail}`;

      // Find corresponding comparison point
      let deltaBadgeHtml = '';
      if (comparisonPoints && comparisonPoints.length > 0 && measured && rank !== null) {
        const compPoint = comparisonPoints.find((cp) => cp.row === point.row && cp.col === point.col);
        if (compPoint && isMeasured(compPoint)) {
          const compRank = rankForPoint(compPoint, focusedPlaceId);
          if (compRank !== null) {
            const diff = compRank - rank; // Positive = improvement (e.g. 5 -> 2 = +3)
            if (diff > 0) {
              deltaBadgeHtml = `<span style="position:absolute;top:-8px;right:-8px;background:#10b981;color:white;font-size:9px;font-weight:900;padding:1px 4px;border-radius:8px;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">+${diff}</span>`;
            } else if (diff < 0) {
              deltaBadgeHtml = `<span style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:white;font-size:9px;font-weight:900;padding:1px 4px;border-radius:8px;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${diff}</span>`;
            } else {
              deltaBadgeHtml = `<span style="position:absolute;top:-8px;right:-8px;background:#64748b;color:white;font-size:9px;font-weight:900;padding:1px 4px;border-radius:8px;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">=</span>`;
            }
          }
        }
      }

      // Plot at the searched coordinate (snapped H3 coordinate if applicable)
      const plotLat = point.searchLat ?? point.lat;
      const plotLng = point.searchLng ?? point.lng;

      if (measured) {
        L.circle([plotLat, plotLng], {
          radius: circleRadiusMeters,
          color: appearance.aura,
          weight: 1,
          opacity: 0.4,
          fillColor: appearance.aura,
          fillOpacity: 0.16,
        }).addTo(circles);
      }

      const badgeWidth = appearance.label.length > 2 ? 38 : 34;
      const icon = L.divIcon({
        className: 'custom-rank-node',
        html: `<div style="position:relative;background:${appearance.color};width:${badgeWidth}px;height:34px;border-radius:18px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:12px;border:${selected ? '3px solid #2563eb' : '2px solid white'};box-shadow:0 3px 10px rgba(0,0,0,.25)">${appearance.label}${deltaBadgeHtml}</div>`,
        iconSize: [badgeWidth, 34],
        iconAnchor: [badgeWidth / 2, 17],
      });
      L.marker([plotLat, plotLng], { icon })
        .bindTooltip(tooltipText, { direction: 'top', offset: [0, -16] })
        .on('click', () => onSelectPoint(point))
        .addTo(markers);
    }

    map.invalidateSize();
    if (savedPoints.length > 0) {
      const bounds = L.latLngBounds(
        savedPoints.map((p) => [p.searchLat ?? p.lat, p.searchLng ?? p.lng] as [number, number])
      );
      bounds.extend([center.lat, center.lng]);
      map.fitBounds(bounds.pad(0.04), { maxZoom: 16, padding: [20, 20], animate: false });
      // Lock map viewport so user cannot drag off into other distant cities
      map.setMaxBounds(bounds.pad(0.30));
      const targetZoom = map.getZoom();
      if (targetZoom) {
        map.setMinZoom(Math.max(10, targetZoom - 1));
      }
    } else {
      const safeRadius = Math.max(0.5, radiusKm);
      const latDelta = safeRadius / 111.32;
      const lngDelta = safeRadius / (111.32 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.0001));
      const bounds = L.latLngBounds(
        [center.lat - latDelta, center.lng - lngDelta],
        [center.lat + latDelta, center.lng + lngDelta]
      );
      map.fitBounds(bounds.pad(0.05), { maxZoom: 16, padding: [20, 20], animate: false });
      map.setMaxBounds(bounds.pad(0.30));
    }
  }, [radiusKm, center.lat, center.lng, focusedPlaceId, gridPoints, comparisonPoints, selectedPoint, maxRank, top3Threshold, top10Threshold, onSelectPoint]);

  const totalPoints = gridPoints.length;
  const measuredCount = gridPoints.filter(isMeasured).length;
  const missingCount = totalPoints - measuredCount;

  return (
    <div className="relative w-full h-full min-h-[550px] overflow-hidden">
      <div ref={elementRef} className="h-full min-h-[550px] w-full bg-slate-100" aria-label="Saved Google Maps rank points" />
      <div className="pointer-events-none absolute left-3 bottom-3 z-[400] rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] shadow-sm font-medium text-slate-700">
        {measuredCount} of {totalPoints} measured
        {missingCount > 0 ? ` (${missingCount} unavailable)` : ''}
        {` · ${radiusKm} km radius`}
      </div>
    </div>
  );
};

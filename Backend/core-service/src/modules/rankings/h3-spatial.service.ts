import { latLngToCell, cellToLatLng, gridDisk } from 'h3-js';
import { logger } from '../../config/logger';

export interface ShareableGridPin {
  lat: number;
  lng: number;
  cellId: string;
  row: number;
  col: number;
}

export interface ShareableGridResult {
  originCellId: string;
  resolution: number;
  radiusKm: number;
  kRing: number;
  pointCount: number;
  pins: ShareableGridPin[];
}

export class H3SpatialService {
  /**
   * Resolves appropriate H3 resolution so H3 cell width is close to pin spacing.
   *
   * H3 Cell Geometry Reference (Average Cell Diameters / Edge lengths):
   * - Res 9: Edge ~174 m, Cell Width / Diameter ~350 m
   * - Res 8: Edge ~461 m, Cell Width / Diameter ~920 m
   * - Res 7: Edge ~1.22 km, Cell Width / Diameter ~2.4 km
   * - Res 6: Edge ~3.23 km, Cell Width / Diameter ~6.4 km
   * - Res 5: Edge ~8.54 km, Cell Width / Diameter ~17 km
   */
  public static getResolutionForPinSpacing(pinSpacingKm: number): number {
    if (pinSpacingKm <= 0.25) return 9;
    if (pinSpacingKm <= 0.75) return 8;
    if (pinSpacingKm <= 2.0) return 7;
    if (pinSpacingKm <= 5.0) return 6;
    return 5;
  }

  /**
   * Resolves appropriate H3 resolution based on scan radius and geometry.
   * Rule: average cell edge length is at most about half the ring spacing.
   * - Res 9: Edge ~0.17 km (for half-spacing <= 0.25 km, i.e. R <= 1.6 km)
   * - Res 8: Edge ~0.46 km (for half-spacing <= 0.65 km, i.e. R <= 4.3 km)
   * - Res 7: Edge ~1.22 km (for half-spacing <= 1.80 km, i.e. R <= 12 km)
   * - Res 6: Edge ~3.23 km (for larger radii)
   */
  public static getResolutionForRadius(
    radiusKm: number,
    pointCount?: number,
    scanShape?: string
  ): number {
    if (pointCount && pointCount > 1) {
      if (scanShape === 'RINGS' || scanShape === 'SUNFLOWER' || scanShape === 'QUICK') {
        if (radiusKm <= 1.5) return 10; // Res 10 edge ~0.066 km, cell diameter ~0.13 km (Zero collisions at R=1km)
        if (radiusKm <= 3.5) return 9;  // Res 9 edge ~0.174 km, cell diameter ~0.35 km
        if (radiusKm <= 8.0) return 8;  // Res 8 edge ~0.461 km, cell diameter ~0.92 km
        if (radiusKm <= 25.0) return 7; // Res 7 edge ~1.22 km, cell diameter ~2.44 km (Zero collisions at R=25km)
        return 6;                       // Res 6 edge ~3.23 km, cell diameter ~6.46 km
      }
      const side = Math.max(2, Math.round(Math.sqrt(pointCount)));
      const pinSpacingKm = (2 * radiusKm) / (side - 1);
      return this.getResolutionForPinSpacing(pinSpacingKm);
    }

    if (radiusKm <= 2.0) return 9;
    if (radiusKm <= 6.0) return 8;
    if (radiusKm <= 16.0) return 7;
    return 6;
  }

  /**
   * One canonical function chooses resolution ONCE per scan from all pins:
   * starts at getResolutionForRadius, raises one step until unique cells == pins, capped at Res 10.
   * Logs uniqueCells/pins/res. Returns duplicateCellIds if any collisions remain at Res 10.
   */
  public static resolveScanResolution(
    pins: Array<{ lat: number; lng: number }>,
    radiusKm: number = 3.5,
    scanShape?: string
  ): { resolution: number; uniqueCells: number; totalPins: number; duplicateCellIds: Set<string> } {
    if (!pins || pins.length === 0) {
      const res = this.getResolutionForRadius(radiusKm, 1, scanShape);
      return { resolution: res, uniqueCells: 0, totalPins: 0, duplicateCellIds: new Set() };
    }

    let res = this.getResolutionForRadius(radiusKm, pins.length, scanShape);
    const MAX_RES = 10;
    let duplicateCellIds = new Set<string>();
    let uniqueCount = 0;

    while (res <= MAX_RES) {
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const p of pins) {
        const c = latLngToCell(p.lat, p.lng, res);
        if (seen.has(c)) {
          dupes.add(c);
        } else {
          seen.add(c);
        }
      }
      uniqueCount = seen.size;
      duplicateCellIds = dupes;
      if (uniqueCount === pins.length || res === MAX_RES) {
        break;
      }
      res++;
    }

    logger.info(
      `[H3 Snapping] Canonical scan resolution: Res ${res} (${uniqueCount}/${pins.length} unique cells, ${duplicateCellIds.size} collision cells)`
    );

    return {
      resolution: res,
      uniqueCells: uniqueCount,
      totalPins: pins.length,
      duplicateCellIds,
    };
  }

  /**
   * Snaps arbitrary coordinates to canonical H3 cell center and returns both cellId, snapped center, and offset in meters.
   */
  public static snapCoordinateToCell(
    lat: number,
    lng: number,
    radiusKm: number = 3.5,
    pointCount?: number,
    scanShape?: string,
    explicitResolution?: number
  ): {
    cellId: string;
    snappedLat: number;
    snappedLng: number;
    resolution: number;
    h3Resolution: number;
    snapOffsetM: number;
  } {
    const resolution =
      typeof explicitResolution === 'number' && explicitResolution >= 0
        ? explicitResolution
        : this.getResolutionForRadius(radiusKm, pointCount, scanShape);
    const cellId = latLngToCell(lat, lng, resolution);
    const [snappedLat, snappedLng] = cellToLatLng(cellId);

    // Haversine distance in meters to calculate snapOffsetM
    const dLat = ((snappedLat - lat) * Math.PI) / 180;
    const dLng = ((snappedLng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((snappedLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const snapOffsetM = Math.round(6371008.8 * c);

    return {
      cellId,
      snappedLat: Number(snappedLat.toFixed(5)),
      snappedLng: Number(snappedLng.toFixed(5)),
      resolution,
      h3Resolution: resolution,
      snapOffsetM,
    };
  }

  /**
   * Generates a 'shareable grid' where all scan pins are generated directly
   * from canonical H3 hexagon centroids using k-ring disks around the snapped center.
   *
   * This guarantees that any two tenants within proximity share exact identical
   * pin coordinates for overlapping cells, maximizing cross-tenant cache hit rates.
   */
  public static generateShareableGrid(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 3.5,
    kRing: number = 2
  ): ShareableGridResult {
    const resolution = this.getResolutionForRadius(radiusKm);
    const originCellId = latLngToCell(centerLat, centerLng, resolution);
    const diskCellIds = gridDisk(originCellId, kRing);

    const pins: ShareableGridPin[] = diskCellIds.map((cellId, index) => {
      const [lat, lng] = cellToLatLng(cellId);
      return {
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        cellId,
        row: Math.floor(index / (kRing * 2 + 1)),
        col: index % (kRing * 2 + 1),
      };
    });

    return {
      originCellId,
      resolution,
      radiusKm,
      kRing,
      pointCount: pins.length,
      pins,
    };
  }

  /**
   * Calculates the overlap ratio between two sets of H3 cell IDs (Jaccard Index).
   */
  public static calculateGridOverlapRatio(cellsA: string[], cellsB: string[]): {
    overlapCount: number;
    totalUniqueCount: number;
    overlapRatio: number;
  } {
    const setA = new Set(cellsA);
    const setB = new Set(cellsB);
    const overlapCount = cellsA.filter((c) => setB.has(c)).length;
    const allUnique = new Set([...cellsA, ...cellsB]);

    const overlapRatio = allUnique.size > 0 ? Number((overlapCount / allUnique.size).toFixed(4)) : 0;

    return {
      overlapCount,
      totalUniqueCount: allUnique.size,
      overlapRatio,
    };
  }
}

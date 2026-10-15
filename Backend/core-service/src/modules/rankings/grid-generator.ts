import { IGridCoordinate, IScanGridSpec } from '@localo/types';
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_KM,
  DEFAULT_RINGS_RADIUS_KM,
  DEFAULT_SUNFLOWER_RADIUS_KM,
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  RADIUS_STEP_KM,
  EARTH_RADIUS_KM,
  GRID_SPEC_VERSION,
  RINGS_31_DEFINITION,
  SUNFLOWER_31_RINGS,
  QUICK_9_RINGS,
  RINGS_POINT_COUNT,
  SUNFLOWER_POINT_COUNT,
  QUICK_POINT_COUNT,
  RINGS_SCAN_CREDIT_COST,
  SUNFLOWER_SCAN_CREDIT_COST,
  QUICK_SCAN_CREDIT_COST,
  VALID_GRID_SIZES,
  ValidGridSize,
  ScanShape,
  RingDefinition,
} from './scan-settings';

export {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_KM,
  DEFAULT_RINGS_RADIUS_KM,
  DEFAULT_SUNFLOWER_RADIUS_KM,
  DEFAULT_SCAN_SHAPE,
  FAILED_SCAN_REUSE_MS,
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  PARTIAL_SCAN_REUSE_MS,
  RADIUS_STEP_KM,
  EARTH_RADIUS_KM,
  GRID_SPEC_VERSION,
  SCAN_SHAPES,
  SCAN_STALE_AFTER_MS,
  STALLED_SCAN_AFTER_MS,
  RINGS_31_DEFINITION,
  SUNFLOWER_31_RINGS,
  QUICK_9_RINGS,
  RINGS_POINT_COUNT,
  SUNFLOWER_POINT_COUNT,
  QUICK_POINT_COUNT,
  RINGS_SCAN_CREDIT_COST,
  SUNFLOWER_SCAN_CREDIT_COST,
  QUICK_SCAN_CREDIT_COST,
  VALID_GRID_SIZES,
} from './scan-settings';

export interface GridBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface GeneratedGrid {
  center: { lat: number; lng: number };
  scanShape: ScanShape;
  gridSize: number;
  pointCount: number;
  radiusKm: number;
  coordinates: IGridCoordinate[];
  bounds: GridBounds;
  creditsRequired: number;
  gridSpec?: IScanGridSpec;
}

export class GridGenerator {
  /**
   * Calculates required scan credits scaled to N²:
   * creditsRequired = Math.ceil((N * N) / 9)
   */
  public static calculateCreditCost(gridSize: number): number {
    return Math.ceil((gridSize * gridSize) / 9);
  }

  public static calculateScanCreditCost(scanShape: ScanShape, gridSize: number): number {
    if (scanShape === 'RINGS' || scanShape === 'SUNFLOWER') return RINGS_SCAN_CREDIT_COST;
    if (scanShape === 'QUICK') return QUICK_SCAN_CREDIT_COST;
    return this.calculateCreditCost(gridSize);
  }

  public static validateRadius(radiusKm: number): void {
    if (
      typeof radiusKm !== 'number' ||
      !Number.isFinite(radiusKm) ||
      isNaN(radiusKm) ||
      radiusKm < MIN_RADIUS_KM ||
      radiusKm > MAX_RADIUS_KM
    ) {
      throw new Error(
        `Scan radius must be a finite number between ${MIN_RADIUS_KM} km and ${MAX_RADIUS_KM} km (received ${radiusKm})`
      );
    }
  }

  /**
   * Validates center coordinates, rejecting poles and invalid coordinate ranges.
   */
  public static validateCoordinates(lat: number, lng: number): void {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Coordinates must be valid finite numbers');
    }
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90 degrees');
    }
    if (lng < -180 || lng > 180) {
      throw new Error('Longitude must be between -180 and 180 degrees');
    }
    // Reject grid centers within 1° of either pole
    if (Math.abs(lat) > 89) {
      throw new Error('Grid center cannot be within 1 degree of Earth poles');
    }
  }

  /**
   * Wraps longitude into [-180, 180]
   */
  public static wrapLongitude(lng: number): number {
    if (lng === 180 || lng === -180) return lng;
    let wrapped = ((lng + 180) % 360 + 360) % 360 - 180;
    if (wrapped === -180) wrapped = 180;
    return wrapped;
  }

  /**
   * Spherical forward-geodesic formula (Earth radius = 6371.0088 km).
   * Calculates destination point given starting point, distance (km), and bearing (degrees clockwise from True North).
   *
   * delta = d / 6371.0088
   * lat2 = asin(sin(lat1)*cos(delta) + cos(lat1)*sin(delta)*cos(bearing))
   * lon2 = lon1 + atan2(sin(bearing)*sin(delta)*cos(lat1), cos(delta) - sin(lat1)*sin(lat2))
   */
  public static destinationPoint(
    lat1Deg: number,
    lng1Deg: number,
    distanceKm: number,
    bearingDeg: number
  ): { lat: number; lng: number } {
    if (distanceKm === 0) {
      return {
        lat: parseFloat(lat1Deg.toFixed(6)),
        lng: parseFloat(this.wrapLongitude(lng1Deg).toFixed(6)),
      };
    }

    const lat1 = (lat1Deg * Math.PI) / 180;
    const lng1 = (lng1Deg * Math.PI) / 180;
    const bearing = (bearingDeg * Math.PI) / 180;
    const delta = distanceKm / EARTH_RADIUS_KM;

    const sinLat1 = Math.sin(lat1);
    const cosLat1 = Math.cos(lat1);
    const sinDelta = Math.sin(delta);
    const cosDelta = Math.cos(delta);
    const sinBearing = Math.sin(bearing);
    const cosBearing = Math.cos(bearing);

    const lat2 = Math.asin(sinLat1 * cosDelta + cosLat1 * sinDelta * cosBearing);
    const lon2 = lng1 + Math.atan2(sinBearing * sinDelta * cosLat1, cosDelta - sinLat1 * Math.sin(lat2));

    const lat2Deg = (lat2 * 180) / Math.PI;
    const lon2Deg = (lon2 * 180) / Math.PI;

    const clampedLat = Math.max(-89.999999, Math.min(89.999999, lat2Deg));
    const wrappedLng = this.wrapLongitude(lon2Deg);

    return {
      lat: parseFloat(clampedLat.toFixed(6)),
      lng: parseFloat(wrappedLng.toFixed(6)),
    };
  }

  /**
   * Great-circle Haversine distance between two coordinates in km (Earth radius = 6371.0088 km).
   */
  public static haversineDistanceKm(lat1Deg: number, lng1Deg: number, lat2Deg: number, lng2Deg: number): number {
    const lat1 = (lat1Deg * Math.PI) / 180;
    const lat2 = (lat2Deg * Math.PI) / 180;
    const dLat = ((lat2Deg - lat1Deg) * Math.PI) / 180;
    const dLng = ((lng2Deg - lng1Deg) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  /**
   * Computes initial forward azimuth (bearing) from (lat1, lng1) to (lat2, lng2) in degrees [0, 360).
   */
  public static initialBearingDeg(lat1Deg: number, lng1Deg: number, lat2Deg: number, lng2Deg: number): number {
    const lat1 = (lat1Deg * Math.PI) / 180;
    const lat2 = (lat2Deg * Math.PI) / 180;
    const dLng = ((lng2Deg - lng1Deg) * Math.PI) / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearingRad = Math.atan2(y, x);
    const bearingDeg = ((bearingRad * 180) / Math.PI + 360) % 360;

    return parseFloat(bearingDeg.toFixed(3));
  }

  /**
   * Generates an N x N matrix of geographical coordinates around a center point (Legacy Square Grid).
   */
  public static generateGrid(
    centerLat: number,
    centerLng: number,
    gridSize: number = DEFAULT_GRID_SIZE,
    radiusKm: number = DEFAULT_RADIUS_KM
  ): GeneratedGrid {
    this.validateCoordinates(centerLat, centerLng);

    if (!VALID_GRID_SIZES.includes(gridSize as ValidGridSize)) {
      throw new Error(`Invalid grid size: ${gridSize}. Supported sizes are: ${VALID_GRID_SIZES.join(', ')}`);
    }

    this.validateRadius(radiusKm);

    const half = Math.floor(gridSize / 2);
    const stepKm = gridSize > 1 ? (2 * radiusKm) / (gridSize - 1) : 0;

    const deltaLatPerKm = 1 / 111.32;
    const latRad = (centerLat * Math.PI) / 180;
    const cosLat = Math.max(Math.cos(latRad), 0.0001);
    const deltaLngPerKm = 1 / (111.32 * cosLat);

    const coordinates: IGridCoordinate[] = [];
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    let pinIndex = 0;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const rowOffset = (half - row) * stepKm;
        const colOffset = (col - half) * stepKm;

        const rawLat = centerLat + rowOffset * deltaLatPerKm;
        const rawLng = centerLng + colOffset * deltaLngPerKm;

        const clampedLat = Math.max(-89.99, Math.min(89.99, rawLat));
        const wrappedLng = this.wrapLongitude(rawLng);

        minLat = Math.min(minLat, clampedLat);
        maxLat = Math.max(maxLat, clampedLat);
        minLng = Math.min(minLng, wrappedLng);
        maxLng = Math.max(maxLng, wrappedLng);

        const dist = this.haversineDistanceKm(centerLat, centerLng, clampedLat, wrappedLng);
        const bearing = dist < 0.001 ? null : this.initialBearingDeg(centerLat, centerLng, clampedLat, wrappedLng);

        coordinates.push({
          pinIndex,
          ring: Math.max(Math.abs(row - half), Math.abs(col - half)),
          ringIndex: col,
          distanceKm: parseFloat(dist.toFixed(3)),
          bearingDeg: bearing,
          lat: parseFloat(clampedLat.toFixed(6)),
          lng: parseFloat(wrappedLng.toFixed(6)),
          row,
          col,
        });
        pinIndex++;
      }
    }

    const creditsRequired = this.calculateCreditCost(gridSize);

    return {
      center: { lat: centerLat, lng: centerLng },
      scanShape: 'GRID',
      gridSize,
      pointCount: coordinates.length,
      radiusKm,
      coordinates,
      bounds: {
        minLat: parseFloat(minLat.toFixed(6)),
        maxLat: parseFloat(maxLat.toFixed(6)),
        minLng: parseFloat(minLng.toFixed(6)),
        maxLng: parseFloat(maxLng.toFixed(6)),
      },
      creditsRequired,
      gridSpec: {
        geometryId: 'SQUARE_GRID',
        gridSpecVersion: 1,
        centerLat,
        centerLng,
        centerSource: 'BUSINESS',
        radiusKm,
        ringFractions: [1.0],
        pinCount: coordinates.length,
        spacingKm: parseFloat(stepKm.toFixed(3)),
      },
    };
  }

  /**
   * Generates the 31-Pin Equal-Density Concentric Multi-Ring Geometry (RINGS_1_6_10_14).
   *
   * Rings & Bearings:
   * - Ring 0: 1 pin at 0.00 * R, bearing null (Center)
   * - Ring 1: 6 pins at 0.40 * R, bearings 0 + k * 60° (k = 0..5)
   * - Ring 2: 10 pins at 0.70 * R, bearings 18 + k * 36° (k = 0..9)
   * - Ring 3: 14 pins at 1.00 * R, bearings (180/14) + k * (360/14)° (k = 0..13)
   */
  public static generateRadialGrid(
    centerLat: number,
    centerLng: number,
    radiusKm: number = DEFAULT_RINGS_RADIUS_KM,
    centerSource: 'BUSINESS' | 'CUSTOM' = 'BUSINESS'
  ): GeneratedGrid {
    this.validateCoordinates(centerLat, centerLng);
    this.validateRadius(radiusKm);

    return this.buildConcentricGrid(
      centerLat,
      centerLng,
      radiusKm,
      RINGS_31_DEFINITION,
      'RINGS_1_6_10_14',
      'RINGS',
      RINGS_POINT_COUNT,
      RINGS_SCAN_CREDIT_COST,
      centerSource
    );
  }

  public static generateRingsGrid = GridGenerator.generateRadialGrid;

  /**
   * Generates the 9-Pin Quick Scan Concentric Geometry (QUICK_RINGS_1_8).
   *
   * Rings & Bearings:
   * - Ring 0: 1 pin at 0.00 * R, bearing null (Center)
   * - Ring 1: 8 pins at 0.70 * R, bearings 0 + k * 45° (k = 0..7)
   */
  public static generateQuickGrid(
    centerLat: number,
    centerLng: number,
    radiusKm: number = DEFAULT_SUNFLOWER_RADIUS_KM,
    centerSource: 'BUSINESS' | 'CUSTOM' = 'BUSINESS'
  ): GeneratedGrid {
    this.validateCoordinates(centerLat, centerLng);
    this.validateRadius(radiusKm);

    return this.buildConcentricGrid(
      centerLat,
      centerLng,
      radiusKm,
      QUICK_9_RINGS,
      'QUICK_RINGS_1_8',
      'QUICK',
      QUICK_POINT_COUNT,
      QUICK_SCAN_CREDIT_COST,
      centerSource
    );
  }

  private static buildConcentricGrid(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    ringDefs: RingDefinition[],
    geometryId: string,
    scanShape: ScanShape,
    expectedPointCount: number,
    creditsRequired: number,
    centerSource: 'BUSINESS' | 'CUSTOM'
  ): GeneratedGrid {
    const coordinates: IGridCoordinate[] = [];
    let minLat = centerLat;
    let maxLat = centerLat;
    let minLng = centerLng;
    let maxLng = centerLng;
    let pinIndex = 0;

    const ringFractions: number[] = [];

    for (const ringDef of ringDefs) {
      ringFractions.push(ringDef.radiusFactor);
      const ringRadiusKm = radiusKm * ringDef.radiusFactor;

      for (let i = 0; i < ringDef.count; i++) {
        let bearingDeg: number | null = null;
        let pt: { lat: number; lng: number };

        if (ringDef.radiusFactor === 0 || ringDef.count === 1) {
          bearingDeg = null;
          pt = {
            lat: parseFloat(centerLat.toFixed(6)),
            lng: parseFloat(this.wrapLongitude(centerLng).toFixed(6)),
          };
        } else {
          bearingDeg = parseFloat(((ringDef.startBearingDeg + i * ringDef.stepBearingDeg) % 360).toFixed(3));
          pt = this.destinationPoint(centerLat, centerLng, ringRadiusKm, bearingDeg);
        }

        minLat = Math.min(minLat, pt.lat);
        maxLat = Math.max(maxLat, pt.lat);
        minLng = Math.min(minLng, pt.lng);
        maxLng = Math.max(maxLng, pt.lng);

        coordinates.push({
          pinIndex,
          ring: ringDef.ring,
          ringIndex: i,
          distanceKm: parseFloat(ringRadiusKm.toFixed(3)),
          bearingDeg,
          lat: pt.lat,
          lng: pt.lng,
          row: ringDef.ring,
          col: i,
        });

        pinIndex++;
      }
    }

    // Average pin-to-pin spacing metric:
    // Approx spacing = (radiusKm * 0.30) for radial rings
    const approxSpacingKm = parseFloat((radiusKm * 0.30).toFixed(2));

    const gridSpec: IScanGridSpec = {
      geometryId,
      gridSpecVersion: GRID_SPEC_VERSION,
      centerLat: parseFloat(centerLat.toFixed(6)),
      centerLng: parseFloat(centerLng.toFixed(6)),
      centerSource,
      radiusKm,
      ringFractions,
      pinCount: coordinates.length,
      spacingKm: approxSpacingKm,
    };

    return {
      center: { lat: centerLat, lng: centerLng },
      scanShape,
      gridSize: DEFAULT_GRID_SIZE,
      pointCount: coordinates.length,
      radiusKm,
      coordinates,
      bounds: {
        minLat: parseFloat(minLat.toFixed(6)),
        maxLat: parseFloat(maxLat.toFixed(6)),
        minLng: parseFloat(minLng.toFixed(6)),
        maxLng: parseFloat(maxLng.toFixed(6)),
      },
      creditsRequired,
      gridSpec,
    };
  }
}


export const VALID_GRID_SIZES = [3, 5, 7, 9, 11, 13] as const;
export type ValidGridSize = (typeof VALID_GRID_SIZES)[number];
export const DEFAULT_GRID_SIZE = 3;
export const DEFAULT_RADIUS_KM = 3.5;
export const DEFAULT_RINGS_RADIUS_KM = 5.0;
export const DEFAULT_SUNFLOWER_RADIUS_KM = DEFAULT_RINGS_RADIUS_KM;
export const MIN_RADIUS_KM = 1.0;
export const MAX_RADIUS_KM = 25.0;
export const RADIUS_STEP_KM = 0.5;
export const EARTH_RADIUS_KM = 6371.0088;
export const GRID_SPEC_VERSION = 2;

export const PLAN_MAX_RADIUS_KM: Record<string, number> = {
  free: 8.0,
  trial: 8.0,
  starter: 16.0,
  pro: 25.0,
  agency: 25.0,
  enterprise: 25.0,
};

export function getMaxRadiusForPlan(planKey?: string): number {
  const normalized = (planKey || 'free').toLowerCase();
  return PLAN_MAX_RADIUS_KM[normalized] ?? 8.0;
}

export const SCAN_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const PARTIAL_SCAN_REUSE_MS = 60 * 60 * 1000;
export const FAILED_SCAN_REUSE_MS = 15 * 60 * 1000;
export const STALLED_SCAN_AFTER_MS = 2 * 60 * 1000; // 2 Minutes auto-recovery for interrupted workers
export const SCAN_SHAPES = ['GRID', 'RINGS', 'SUNFLOWER', 'QUICK'] as const;
export type ScanShape = (typeof SCAN_SHAPES)[number];
export const DEFAULT_SCAN_SHAPE: ScanShape = 'RINGS';

export interface RingDefinition {
  ring: number;
  radiusFactor: number;
  count: number;
  startBearingDeg: number;
  stepBearingDeg: number;
}

export const RADIUS_PRESETS = [
  { label: 'Urban', radiusKm: 3.0 },
  { label: 'Default', radiusKm: 5.0 },
  { label: 'Suburban', radiusKm: 8.0 },
  { label: 'Rural', radiusKm: 16.0 },
] as const;

/**
 * 31-Pin Equal-Density Concentric Multi-Ring Geometry (RINGS_1_6_10_14)
 * - Ring 0: 1 pin at 0.00 * R, bearing null (Center)
 * - Ring 1: 6 pins at 0.40 * R, bearings 0 + k * 60°
 * - Ring 2: 10 pins at 0.70 * R, bearings 18 + k * 36°
 * - Ring 3: 14 pins at 1.00 * R, bearings (180/14) + k * (360/14)°
 */
export const RINGS_31_DEFINITION: RingDefinition[] = [
  { ring: 0, radiusFactor: 0.00, count: 1, startBearingDeg: 0, stepBearingDeg: 0 },
  { ring: 1, radiusFactor: 0.40, count: 6, startBearingDeg: 0, stepBearingDeg: 60 },
  { ring: 2, radiusFactor: 0.70, count: 10, startBearingDeg: 18, stepBearingDeg: 36 },
  { ring: 3, radiusFactor: 1.00, count: 14, startBearingDeg: 180 / 14, stepBearingDeg: 360 / 14 },
];
export const SUNFLOWER_31_RINGS = RINGS_31_DEFINITION;

/**
 * 9-Pin Quick Scan Concentric Geometry (QUICK_RINGS_1_8)
 * - Ring 0: 1 pin at 0.00 * R, bearing null (Center)
 * - Ring 1: 8 pins at 0.70 * R, bearings 0 + k * 45°
 */
export const QUICK_9_RINGS: RingDefinition[] = [
  { ring: 0, radiusFactor: 0.00, count: 1, startBearingDeg: 0, stepBearingDeg: 0 },
  { ring: 1, radiusFactor: 0.70, count: 8, startBearingDeg: 0, stepBearingDeg: 45 },
];

export const RINGS_31_RINGS = RINGS_31_DEFINITION.slice(1);
export const SUNFLOWER_RINGS = RINGS_31_RINGS;
export const RINGS_POINT_COUNT = RINGS_31_DEFINITION.reduce((total, ring) => total + ring.count, 0); // 31
export const SUNFLOWER_POINT_COUNT = RINGS_POINT_COUNT;
export const QUICK_POINT_COUNT = QUICK_9_RINGS.reduce((total, ring) => total + ring.count, 0); // 9
export const RINGS_SCAN_CREDIT_COST = Math.ceil(RINGS_POINT_COUNT / 9); // 4
export const SUNFLOWER_SCAN_CREDIT_COST = RINGS_SCAN_CREDIT_COST;
export const QUICK_SCAN_CREDIT_COST = 1;


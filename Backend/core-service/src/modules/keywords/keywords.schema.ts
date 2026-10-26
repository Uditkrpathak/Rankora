import { z } from 'zod';
import { MAX_RADIUS_KM, MIN_RADIUS_KM, VALID_GRID_SIZES } from '../rankings/scan-settings';

export const BulkAddKeywordsSchema = z.object({
  keywords: z
    .array(z.string().min(1).max(120))
    .min(1, 'Please provide at least one keyword.')
    .max(25, 'You can add at most 25 keywords per batch.'),
});

export const ListKeywordsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['rank', 'visibility', 'volume', 'lastScannedAt', 'createdAt', 'keyword']).default('visibility'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['active', 'paused']).optional(),
});

export const UpdateTrackedKeywordSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  scanFrequency: z.enum(['manual', 'daily', 'weekly']).optional(),
  gridSize: z.coerce.number().int().refine((value) => VALID_GRID_SIZES.includes(value as (typeof VALID_GRID_SIZES)[number])).optional(),
  radiusKm: z.coerce.number().min(MIN_RADIUS_KM).max(MAX_RADIUS_KM).refine((value) => Math.round(value * 2) === value * 2).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one setting to update.');

export type BulkAddKeywordsInput = z.infer<typeof BulkAddKeywordsSchema>;
export type ListKeywordsQuery = z.infer<typeof ListKeywordsQuerySchema>;

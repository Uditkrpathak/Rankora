import { z } from 'zod';

// Standard domain URL validator requiring real TLD
const domainUrlRegex = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/;
// Flexible phone validator (E.164 or 7-15 digit phone with optional country code)
const phoneRegex = /^\+?[1-9]\d{6,14}$/;
// Standard postal code validator
const postalCodeRegex = /^[a-zA-Z0-9\s-]{3,10}$/;
// Municipality / City name validator
const cityNameRegex = /^[a-zA-Z\s.'-]{2,50}$/;

export const createLocationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200, 'Name must be 200 characters or fewer').trim(),
  address: z.string().min(3, 'Address is required').max(300).trim(),
  city: z.string().regex(cityNameRegex, 'Please enter a valid city name').trim(),
  state: z.string().min(2, 'State / region is required').max(100).trim(),
  country: z.string().min(2, 'Country is required').max(100).trim(),
  postalCode: z.string().regex(postalCodeRegex, 'Please enter a valid postal code (3-10 characters)').trim().optional(),
  placeId: z.string().nullable().optional(),
  gbpUrl: z.string().regex(domainUrlRegex, 'Must be a valid URL with live domain (e.g. https://domain.com)').nullable().optional(),
  categories: z.array(z.string()).max(10, 'Maximum 10 categories').optional(),
  phone: z
    .string()
    .regex(phoneRegex, 'Phone must be a valid number with 7-15 digits (e.g. +14155552671)')
    .optional(),
  website: z.string().regex(domainUrlRegex, 'Must be a valid website URL starting with http:// or https://').optional(),
  description: z.string().max(1000).optional(),
  regularHours: z.record(z.any()).optional(),
  primaryCategory: z.object({ id: z.string().optional(), displayName: z.string() }).optional(),
  secondaryCategories: z.array(z.object({ id: z.string().optional(), displayName: z.string() })).optional(),
  photosCount: z.number().min(0).optional(),
  coverPhotoUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional().default('active'),
});

export const updateLocationSchema = createLocationSchema.partial();

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

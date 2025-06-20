import { z } from 'zod';

// Schema for creating a disaster
export const createDisasterSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters' })
    .max(200, { message: 'Title must be at most 200 characters' }),
  locationName: z.string().max(500, { message: 'Location name must be at most 500 characters' }),
  description: z.string().max(2000, { message: 'Description must be at most 2000 characters' }),
  tags: z.array(z.string().max(50, { message: 'Tag must be at most 50 characters' })),
});

// Schema for updating a disaster
export const updateDisasterSchema = z.object({
  description: z.string().max(2000, { message: 'Description must be at most 2000 characters' }),
});

// Schema for query parameters
export const queryDisasterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  owner_id: z.string().optional(),
  tags: z.string().optional(), // comma-separated tags
  search: z
    .string()
    .max(200, { message: 'Search query must be at most 200 characters' })
    .optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(100000).default(50000), // meters
});

// Schema for official updates query
export const officialUpdatesQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).optional().default('false'),
});

// Schema for social media query parameters
export const socialMediaQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).optional().default('false'),
});

// Schema for nearby disasters query
export const nearbyDisastersQuerySchema = z.object({
  lat: z
    .string()
    .transform(val => parseFloat(val))
    .refine(val => !isNaN(val) && val >= -90 && val <= 90, {
      message: 'Latitude must be a number between -90 and 90',
    }),
  lng: z
    .string()
    .transform(val => parseFloat(val))
    .refine(val => !isNaN(val) && val >= -180 && val <= 180, {
      message: 'Longitude must be a number between -180 and 180',
    }),
  radius: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val) : 50000))
    .refine(val => !isNaN(val) && val > 0 && val <= 500000, {
      message: 'Radius must be a positive number up to 500,000 meters (500km)',
    }),
  tags: z.string().optional(), // Comma-separated tags
});

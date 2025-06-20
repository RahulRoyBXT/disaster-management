import { z } from 'zod';

// Schema for creating a resource
export const createResourceSchema = z.object({
  disasterId: z.string().min(1, { message: 'Disaster ID is required' }),
  name: z
    .string()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name must be at most 100 characters' }),
  locationName: z
    .string()
    .min(1, { message: 'Location name is required' })
    .max(500, { message: 'Location name must be at most 500 characters' }),
  type: z
    .string()
    .min(1, { message: 'Type is required' })
    .max(50, { message: 'Type must be at most 50 characters' }),
});

// Schema for updating a resource
export const updateResourceSchema = z.object({
  resourceId: z.string().min(1, { message: 'Resource ID is required' }),
  name: z
    .string()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name must be at most 100 characters' })
    .optional(),
  locationName: z
    .string()
    .min(1, { message: 'Location name is required' })
    .max(500, { message: 'Location name must be at most 500 characters' })
    .optional(),
  type: z
    .string()
    .min(1, { message: 'Type is required' })
    .max(50, { message: 'Type must be at most 50 characters' })
    .optional(),
});

// Schema for resource ID in params
export const resourceIdParamSchema = z.object({
  id: z.string().min(1, { message: 'Resource ID is required' }),
});

// Schema for disaster ID in params (for getting resources by disaster ID)
export const disasterIdParamSchema = z.object({
  disasterId: z.string().min(1, { message: 'Disaster ID is required' }),
});

// Schema for geospatial query parameters
export const nearbyResourcesQuerySchema = z.object({
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
    .transform(val => (val ? parseInt(val) : 10000))
    .refine(val => !isNaN(val) && val > 0 && val <= 100000, {
      message: 'Radius must be a positive number up to 100,000 meters',
    }),
  disasterId: z.string().optional(),
});

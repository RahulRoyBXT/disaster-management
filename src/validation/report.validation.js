import { z } from 'zod';

// Schema for creating a report
export const createReportSchema = z.object({
  disasterId: z.string().min(1, { message: 'Disaster ID is required' }),
  content: z
    .string()
    .min(1, { message: 'Content is required' })
    .max(2000, { message: 'Content must be at most 2000 characters' }),
  imageURL: z.string().optional(), // Optional field for image URL
  // Note: file validation will be handled by multer middleware
});

// Schema for updating a report
export const updateReportSchema = z.object({
  content: z
    .string()
    .min(1, { message: 'Content is required' })
    .max(2000, { message: 'Content must be at most 2000 characters' }),
  imageUrl: z.string().optional(), // Optional field for image URL
});

// Schema for report ID in params
export const reportIdParamSchema = z.object({
  id: z.string().min(1, { message: 'Report ID is required' }),
});

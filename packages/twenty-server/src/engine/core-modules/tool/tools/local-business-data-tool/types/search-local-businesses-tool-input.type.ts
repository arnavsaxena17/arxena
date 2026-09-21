import { z } from 'zod';

export const SearchLocalBusinessesToolInputZodSchema = z.object({
  query: z
    .string()
    .describe('Google Maps style query, e.g. Hotels in San Francisco, USA'),
  limit: z.number().min(1).max(500).optional().default(20),
  lat: z.number().optional(),
  lng: z.number().optional(),
  zoom: z.number().optional(),
  language: z.string().optional().default('en'),
  region: z.string().optional().default('us'),
  extractEmailsAndContacts: z.boolean().optional().default(false),
  subtypes: z.string().optional(),
  verified: z.boolean().optional(),
  businessStatus: z.string().optional(),
  fields: z.string().optional(),
  mode: z
    .enum(['search', 'search-nearby', 'search-in-area'])
    .optional()
    .default('search'),
});

export type SearchLocalBusinessesToolInput = z.infer<
  typeof SearchLocalBusinessesToolInputZodSchema
>;

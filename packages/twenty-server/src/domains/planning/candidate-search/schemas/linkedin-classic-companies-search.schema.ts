import { z } from 'zod';

/**
 * Zod schema for LinkedIn Classic Companies Search parameters
 */
export const classicCompaniesSearchSchema = z.object({
  keywords: z.string().nullable(),
  industry: z.array(z.string()).nullable(),
  location: z.array(z.string()).nullable(),
  has_job_offers: z.boolean().nullable(),
  headcount: z.array(z.object({
    min: z.number(),
    max: z.number(),
  })).nullable(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).nullable(),
});

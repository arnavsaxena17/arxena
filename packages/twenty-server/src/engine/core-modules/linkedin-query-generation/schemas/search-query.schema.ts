import { z } from 'zod';

/**
 * Shared search query shape used by Agent 3 (primary query) and Agent 4 (factored query).
 */
export const searchQuerySchema = z.object({
  keywords: z.string().nullable(),
  job_title: z.string().nullable(),
  company: z.array(z.string()).nullable(),
  location: z.array(z.string()).nullable(),
  years_of_experience: z.string().nullable(),
});

/**
 * Term counts for keywords, job_title, and combined (for splitting decisions).
 */
export const termCountsSchema = z.object({
  keywords: z.number(),
  job_title: z.number(),
  combined: z.number(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type TermCounts = z.infer<typeof termCountsSchema>;

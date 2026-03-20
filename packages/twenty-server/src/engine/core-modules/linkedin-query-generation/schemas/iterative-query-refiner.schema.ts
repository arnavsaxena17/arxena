import { z } from 'zod';

import { searchQuerySchema } from './search-query.schema';

export const iterativeQueryRefinerSchema = z.object({
  refined_query_set: z.object({
    search_query_set: z.array(searchQuerySchema).min(1).max(12),
  }),
  rationale: z.string(),
  changes_made: z.array(z.string()).min(1).max(10),
});

export type IterativeQueryRefinerResult = z.infer<
  typeof iterativeQueryRefinerSchema
>;

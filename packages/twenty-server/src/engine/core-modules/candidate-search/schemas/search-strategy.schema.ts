import { z } from "zod";

export const searchStrategyTextSchema = z.object({
    strategies: z.array(z.object({
      strategyText: z.string().describe('Natural language description of search strategy (e.g., "Use keywords (job titles: Software Engineer) and location (Mumbai) and industry (Technology)")'),
      label: z.string().nullable().optional().describe('Short label for this strategy (e.g., "Location + Industry Focus")'),
      termsExplanation: z.string().nullable().optional().describe('Explanation of why the terms were chosen, why they are likely to not over filter or underfilter the query relevant candidates are likely to have profiles with selected terms'),
      
    })),
  });
  
  export type SearchStrategyTextResult = z.infer<typeof searchStrategyTextSchema>;
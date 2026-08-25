import { z } from 'zod';

export const gtmFilterProfilesLlmResultSchema = z.object({
  matches: z.boolean(),
  reason: z.string(),
});

export type GtmFilterProfilesLlmResult = z.infer<
  typeof gtmFilterProfilesLlmResultSchema
>;

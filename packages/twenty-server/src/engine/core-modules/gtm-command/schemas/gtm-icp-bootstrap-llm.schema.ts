import { z } from 'zod';

export const gtmIcpBootstrapLlmResultSchema = z.object({
  buyerTitles: z.array(z.string()),
  locations: z.array(z.string()),
});

export type GtmIcpBootstrapLlmResult = z.infer<
  typeof gtmIcpBootstrapLlmResultSchema
>;

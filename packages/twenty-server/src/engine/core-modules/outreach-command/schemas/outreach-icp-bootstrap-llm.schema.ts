import { z } from 'zod';

export const gtmIcpBootstrapLlmResultSchema = z.object({
  buyerTitles: z.array(z.string()),
  locations: z.array(z.string()),
});

export type IcpBootstrapLlmResult = z.infer<
  typeof gtmIcpBootstrapLlmResultSchema
>;

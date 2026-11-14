import { z } from 'zod';

export const outreachSenderProfileLlmSchema = z.object({
  targetTitles: z.array(z.string()),
  locations: z.array(z.string()),
  brief: z.string(),
});

export type OutreachSenderProfileLlmResult = z.infer<
  typeof outreachSenderProfileLlmSchema
>;

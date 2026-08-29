import { z } from 'zod';

export const gtmFakeProfileVerdictSchema = z.enum([
  'fake',
  'likely_fake',
  'uncertain',
  'likely_genuine',
  'genuine',
]);

export const gtmFakeProfileLlmResultSchema = z.object({
  verdict: gtmFakeProfileVerdictSchema,
  confidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(100),
  summary: z.string(),
  redFlags: z.array(z.string()),
  supportingSignals: z.array(z.string()),
});

export type OutreachFakeProfileVerdict = z.infer<typeof gtmFakeProfileVerdictSchema>;
export type OutreachFakeProfileLlmResult = z.infer<
  typeof gtmFakeProfileLlmResultSchema
>;

export const isLikelyFakeVerdict = (verdict: OutreachFakeProfileVerdict): boolean =>
  verdict === 'fake' || verdict === 'likely_fake';

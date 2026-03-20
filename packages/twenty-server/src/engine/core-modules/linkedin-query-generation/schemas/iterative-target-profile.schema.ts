import { z } from 'zod';

export const targetProfileSchema = z.object({
  archetype: z.string(),
  must_have_signals: z.array(z.string()),
  optional_signals: z.array(z.string()),
  likely_titles: z.array(z.string()),
  likely_keywords: z.array(z.string()),
  rationale: z.string(),
});

export const targetProfileSetSchema = z.object({
  positive_profiles: z.array(targetProfileSchema).min(3).max(12),
  negative_profiles: z.array(targetProfileSchema).min(2).max(8),
  retrieval_principles: z.array(z.string()).min(3).max(8),
});

export type TargetProfile = z.infer<typeof targetProfileSchema>;
export type TargetProfileSet = z.infer<typeof targetProfileSetSchema>;

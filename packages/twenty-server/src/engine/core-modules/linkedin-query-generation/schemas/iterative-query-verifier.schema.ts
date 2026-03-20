import { z } from 'zod';

export const queryVerificationFindingSchema = z.object({
  code: z.enum([
    'linkedin_limit_error',
    'empty_field_warning',
    'duplicate_query_warning',
    'overlapping_title_keywords',
    'constraint_load_high',
    'company_filter_too_strict',
    'low_breadth',
    'live_preview_unavailable',
    'live_preview_low_volume',
    'live_preview_low_diversity',
  ]),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
});

export const queryVerificationResultSchema = z.object({
  valid: z.boolean(),
  score: z.number().min(0).max(1),
  overlap_score: z.number().min(0).max(1),
  breadth_score: z.number().min(0).max(1),
  constraint_load_score: z.number().min(0).max(1),
  role_signal_score: z.number().min(0).max(1),
  expected_candidate_volume_score: z.number().min(0).max(1),
  live_preview_score: z.number().min(0).max(1).nullable(),
  relevance_score: z.number().min(0).max(1).nullable(),
  findings: z.array(queryVerificationFindingSchema),
  recommended_actions: z.array(
    z.enum([
      'drop_job_title',
      'drop_keywords',
      'split_mixed_query',
      'relax_company_filter',
      'preserve_location',
      'enforce_limits',
      'add_broader_variant',
    ]),
  ),
  summary: z.string(),
});

export type QueryVerificationResultSchema = z.infer<
  typeof queryVerificationResultSchema
>;

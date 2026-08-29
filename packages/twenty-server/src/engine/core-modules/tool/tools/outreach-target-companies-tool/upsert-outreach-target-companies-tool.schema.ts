import { z } from 'zod';

export const OutreachEphemeralCompanyInputZodSchema = z.object({
  id: z
    .string()
    .optional()
    .describe(
      'Stable ephemeral id. Prefer a UUID. If omitted, one is generated from domain/name.',
    ),
  name: z.string().min(1).describe('Company display name'),
  domain: z
    .string()
    .describe(
      'Website host without protocol (e.g. "google.com"). Empty string if unknown.',
    ),
  industry: z.string().default('').describe('Industry or category label'),
  employees: z.string().default('').describe('Headcount band or count as text'),
  segment: z.string().default('').describe('Optional ICP segment label'),
  icpFit: z
    .string()
    .default('')
    .describe('Optional fit score/label (e.g. "high", "medium")'),
  status: z
    .string()
    .default('new')
    .describe('Pipeline status for the Companies tab (default "new")'),
});

export const UpsertOutreachTargetCompaniesInputZodSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .describe(
      'Project.id from browsing context /outreach-home?projectId=. Required.',
    ),
  mode: z
    .enum(['merge', 'replace'])
    .default('merge')
    .describe(
      'merge = upsert by domain (fallback name) into existing Redis list; replace = overwrite the list.',
    ),
  companies: z
    .array(OutreachEphemeralCompanyInputZodSchema)
    .min(1)
    .max(500)
    .describe('Target companies to write to the ephemeral Companies tab'),
});

export type UpsertOutreachTargetCompaniesInput = z.infer<
  typeof UpsertOutreachTargetCompaniesInputZodSchema
>;

import { z } from 'zod';

import { OUTREACH_LIST_MAX_ROWS } from 'src/engine/core-modules/outreach-list/outreach-list.constants';

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
  otherFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Extra source data shown as table columns, for example linkedinUrl, about, headquartersCity. Existing values (such as AI column answers) are kept on merge.',
    ),
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
    .max(OUTREACH_LIST_MAX_ROWS)
    .describe('Target companies to write to the ephemeral Companies tab'),
});

export type UpsertOutreachTargetCompaniesInput = z.infer<
  typeof UpsertOutreachTargetCompaniesInputZodSchema
>;

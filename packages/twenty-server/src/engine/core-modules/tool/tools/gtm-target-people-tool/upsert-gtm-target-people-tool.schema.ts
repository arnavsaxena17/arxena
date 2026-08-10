import { z } from 'zod';

export const GtmEphemeralPersonInputZodSchema = z.object({
  id: z
    .string()
    .optional()
    .describe(
      'Stable ephemeral id. Prefer a UUID. If omitted, one is generated from linkedinUrl or name+company.',
    ),
  name: z.string().min(1).describe('Person display name'),
  title: z
    .string()
    .default('')
    .describe('Job title / headline (e.g. "CEO & Managing Director")'),
  companyId: z
    .string()
    .default('')
    .describe(
      'Optional ephemeral GTM company id from Companies tab (not a CRM UUID).',
    ),
  companyName: z
    .string()
    .default('')
    .describe('Company display name for the People tab'),
  linkedinUrl: z
    .string()
    .default('')
    .describe('Public LinkedIn profile URL when available'),
  warmPath: z.string().default('—').describe('Warm-path hint if known'),
  stage: z
    .string()
    .default('queued')
    .describe(
      'Display stage for the GTM People tab before CRM enroll (default "queued")',
    ),
  email: z.string().default('').describe('Email when known'),
  connectionDegree: z
    .number()
    .optional()
    .describe('LinkedIn connection degree when known'),
  personaPriorityScore: z
    .number()
    .optional()
    .describe('Optional persona priority score'),
});

export const UpsertGtmTargetPeopleInputZodSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .describe(
      'GTM Project.id from browsing context /gtm-home?projectId=. Required.',
    ),
  mode: z
    .enum(['merge', 'replace'])
    .default('merge')
    .describe(
      'merge = upsert by linkedinUrl (fallback name+company) into existing Redis list; replace = overwrite the list.',
    ),
  people: z
    .array(GtmEphemeralPersonInputZodSchema)
    .min(1)
    .max(500)
    .describe('Target people to write to the ephemeral GTM People tab'),
});

export type UpsertGtmTargetPeopleInput = z.infer<
  typeof UpsertGtmTargetPeopleInputZodSchema
>;

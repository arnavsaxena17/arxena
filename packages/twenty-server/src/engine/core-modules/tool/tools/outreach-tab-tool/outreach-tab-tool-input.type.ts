import { z } from 'zod';

export const OutreachTabToolInputZodSchema = z.object({
  action: z
    .enum(['export', 'dedupe'])
    .describe('export the tab as CSV, or dedupe it against the CRM'),
  projectId: z
    .string()
    .optional()
    .describe(
      'The project whose tab to act on. Defaults to the project the user is on; a project is required',
    ),
  tab: z
    .enum(['companies', 'people'])
    .describe('Which project tab to export or dedupe'),
  against: z
    .enum(['crm'])
    .optional()
    .describe('dedupe only: compare with existing CRM records'),
  remove: z
    .boolean()
    .optional()
    .describe(
      'dedupe only: drop the matching rows instead of only marking them',
    ),
});

export type OutreachTabToolInput = z.infer<
  typeof OutreachTabToolInputZodSchema
>;

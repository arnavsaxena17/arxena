import { z } from 'zod';

export const OutreachTabToolInputZodSchema = z.object({
  action: z
    .enum(['export', 'dedupe', 'remove'])
    .describe(
      'export the tab as CSV, dedupe it (against the CRM and itself), or remove exact rows',
    ),
  projectId: z
    .string()
    .optional()
    .describe(
      'The project whose tab to act on. Defaults to the project the user is on; a project is required',
    ),
  tab: z
    .enum(['companies', 'people'])
    .describe('Which project tab to export, dedupe or remove from'),
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
  rowIds: z
    .array(z.string())
    .optional()
    .describe(
      'remove only: the exact row ids to drop from the tab (ids come from get_outreach_tab). Use this to delete one ephemeral row',
    ),
});

export type OutreachTabToolInput = z.infer<
  typeof OutreachTabToolInputZodSchema
>;

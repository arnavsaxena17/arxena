import { z } from 'zod';

export const SaveOutreachTargetsToCrmInputZodSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .describe(
      'Project.id from the outreachCommand browsing context. Required.',
    ),
  target: z
    .enum(['companies', 'people', 'both'])
    .default('both')
    .describe(
      'Which Find tab to save. Saving people also saves the Companies-tab rows they point at.',
    ),
  companyIds: z
    .array(z.string())
    .optional()
    .describe(
      'Ephemeral Companies-tab ids to save (selected rows). Omit to save every row on the tab.',
    ),
  personIds: z
    .array(z.string())
    .optional()
    .describe(
      'Ephemeral People-tab ids to save (selected rows). Omit to save every row on the tab.',
    ),
});

export type SaveOutreachTargetsToCrmToolInput = z.infer<
  typeof SaveOutreachTargetsToCrmInputZodSchema
>;

import { z } from 'zod';

export const DEFAULT_WORKFLOW_ACTION_ERROR_HANDLING_OPTIONS = {
  retryOnFailure: { value: false },
  continueOnFailure: { value: false },
};

export const workflowActionErrorHandlingOptionsSchema = z.object({
  retryOnFailure: z.object({
    value: z.boolean().describe('Whether to retry the action if it fails.'),
  }),
  continueOnFailure: z.object({
    value: z
      .boolean()
      .describe('Whether to continue to the next step if this action fails.'),
  }),
});

export const baseWorkflowActionSettingsSchema = z.object({
  input: z
    .looseObject({})
    .describe(
      'Input data for the workflow action. Structure depends on the action type.',
    ),
  outputSchema: z
    .looseObject({})
    .describe(
      'Schema defining the output data structure. This data can be referenced in subsequent steps using {{stepId.fieldName}}.',
    ),
  errorHandlingOptions: z.preprocess(
    (value) =>
      value == null ? DEFAULT_WORKFLOW_ACTION_ERROR_HANDLING_OPTIONS : value,
    workflowActionErrorHandlingOptionsSchema,
  ),
});

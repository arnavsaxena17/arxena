import { z } from 'zod';

import { coerceCreateCompleteWorkflowInput } from 'src/modules/workflow/workflow-tools/utils/coerce-create-complete-workflow-input.util';

const createCompleteWorkflowLearnObjectSchema = z.object({
  name: z.string().describe('Workflow name'),
  description: z.string().optional(),
  trigger: z.looseObject({
    type: z.enum(['DATABASE_EVENT', 'MANUAL', 'CRON', 'WEBHOOK']),
    name: z.string().optional(),
    nextStepIds: z.array(z.string()).optional().nullable(),
    settings: z.looseObject({
      eventName: z
        .string()
        .optional()
        .describe(
          'DATABASE_EVENT only. Pattern objectName.action e.g. company.created',
        ),
      outputSchema: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  steps: z
    .array(
      z.looseObject({
        id: z.string().uuid(),
        name: z.string(),
        type: z.string(),
        valid: z.boolean().optional(),
        settings: z.looseObject({
          input: z.record(z.string(), z.unknown()).optional(),
        }),
      }),
    )
    .describe(
      'Action steps. LOGIC_FUNCTION must use settings.input.logicFunctionId + settings.input.logicFunctionInput.',
    ),
  edges: z
    .array(
      z.object({
        source: z
          .string()
          .describe('Source step id. Use "trigger" for the trigger.'),
        target: z.string().describe('Target step UUID'),
      }),
    )
    .optional()
    .describe('Connections. Keys are source/target, never from/to.'),
  activate: z.boolean().optional(),
});

export const createCompleteWorkflowLearnSchema = z.preprocess(
  coerceCreateCompleteWorkflowInput,
  createCompleteWorkflowLearnObjectSchema,
);

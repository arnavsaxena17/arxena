import { type WorkflowActionTriggerSettings } from '@/application';
import { jsonSchemaToInputSchema } from '@/logic-function/json-schema-to-input-schema';

export const CODE_STEP_LOGIC_FUNCTION_NAME = 'A Code Step';

export const SEED_WORKFLOW_ACTION_TRIGGER_SETTINGS: WorkflowActionTriggerSettings =
  {
    inputSchema: jsonSchemaToInputSchema({
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
    }),
  };

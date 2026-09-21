import { z } from 'zod';

import { workflowAiFilteringActionSettingsSchema } from './ai-filtering-action-settings-schema';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';

export const workflowAiFilteringActionSchema = baseWorkflowActionSchema.extend({
  type: z.literal('AI_FILTERING'),
  settings: workflowAiFilteringActionSettingsSchema,
});

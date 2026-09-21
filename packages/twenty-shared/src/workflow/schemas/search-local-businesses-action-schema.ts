import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowSearchLocalBusinessesActionSettingsSchema } from './search-local-businesses-action-settings-schema';

export const workflowSearchLocalBusinessesActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEARCH_LOCAL_BUSINESSES'),
    settings: workflowSearchLocalBusinessesActionSettingsSchema,
  });

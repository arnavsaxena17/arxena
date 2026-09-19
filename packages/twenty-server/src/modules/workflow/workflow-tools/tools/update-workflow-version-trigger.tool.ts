import { workflowTriggerSchema } from 'twenty-shared/workflow';
import { z } from 'zod';

import type { UpdateWorkflowVersionTriggerInput } from 'src/engine/core-modules/workflow/dtos/update-workflow-version-trigger.input';
import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const updateWorkflowVersionTriggerSchema = z.object({
  workflowVersionId: z
    .string()
    .uuid()
    .describe('The UUID of the workflow version containing the trigger'),
  trigger: workflowTriggerSchema.describe('The updated trigger configuration'),
});

export const createUpdateWorkflowVersionTriggerTool = (
  deps: Pick<WorkflowToolDependencies, 'workflowVersionStepService'>,
  context: WorkflowToolContext,
) => ({
  name: 'update_workflow_version_trigger' as const,
  description:
    'Update the trigger of a workflow version. This modifies the trigger configuration (e.g., changing trigger type, settings, or conditions). Content-only updates are allowed on ACTIVE versions; graph changes require a draft.',
  inputSchema: updateWorkflowVersionTriggerSchema,
  execute: async (parameters: UpdateWorkflowVersionTriggerInput) => {
    try {
      return await deps.workflowVersionStepService.updateWorkflowVersionTrigger(
        {
          workspaceId: context.workspaceId,
          workflowVersionId: parameters.workflowVersionId,
          trigger: parameters.trigger,
        },
      );
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to update workflow version trigger: ${error.message}`,
      };
    }
  },
});

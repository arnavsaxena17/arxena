import { z } from 'zod';

import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const deleteWorkflowVersionStepSchema = z.object({
  workflowVersionId: z
    .string()
    .uuid()
    .describe('The UUID of the workflow version containing the step'),
  stepId: z.string().uuid().describe('The UUID of the step to delete'),
});

type DeleteWorkflowVersionStepInput = z.infer<
  typeof deleteWorkflowVersionStepSchema
>;

export const createDeleteWorkflowVersionStepTool = (
  deps: Pick<WorkflowToolDependencies, 'workflowVersionStepService'>,
  context: WorkflowToolContext,
) => ({
  name: 'delete_workflow_version_step' as const,
  description:
    'Delete a single step from a draft workflow version and rewire parents. Prefer updating nextStepIds / IF_ELSE branch targets to skip a gate over deleting many steps. Deleting a step that is the only child of an IF_ELSE branch inserts an EMPTY "Add an Action" placeholder — you must rewire that branch to a real step afterward. Never delete SEND_EMAIL / SEND_WHATSAPP_MESSAGE / SEND_LINKEDIN_* / FORM leaves, or unrelated sibling paths (company vs no-company, replied-channel routers), unless the user explicitly listed those step ids. Confirm the step id+name list before calling. After deletes, re-fetch the draft and verify protected SEND_* steps still exist and remain reachable. Do not use this on ACTIVE versions — draft first.',
  inputSchema: deleteWorkflowVersionStepSchema,
  execute: async (parameters: DeleteWorkflowVersionStepInput) => {
    try {
      return await deps.workflowVersionStepService.deleteWorkflowVersionStep({
        workspaceId: context.workspaceId,
        workflowVersionId: parameters.workflowVersionId,
        stepIdToDelete: parameters.stepId,
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to delete workflow version step: ${error.message}`,
      };
    }
  },
});

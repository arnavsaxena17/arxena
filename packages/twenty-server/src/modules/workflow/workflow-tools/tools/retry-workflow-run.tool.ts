import { z } from 'zod';

import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const retryWorkflowRunSchema = z.object({
  workflowRunId: z.uuid().describe('The UUID of the failed run to retry'),
});

type RetryWorkflowRunInput = z.infer<typeof retryWorkflowRunSchema>;

export const createRetryWorkflowRunTool = (
  deps: Pick<WorkflowToolDependencies, 'workflowTriggerService'>,
  context: WorkflowToolContext,
) => ({
  name: 'retry_workflow_run' as const,
  description:
    'Retry a failed workflow run from its failed step. Never retry a run that shows rate limited: it resumes on its own.',
  inputSchema: retryWorkflowRunSchema,
  execute: async (parameters: RetryWorkflowRunInput) => {
    try {
      await deps.workflowTriggerService.retryWorkflowRun(
        parameters.workflowRunId,
        context.workspaceId,
      );

      return { success: true, workflowRunId: parameters.workflowRunId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: message,
        message: `Failed to retry workflow run: ${message}`,
      };
    }
  },
});

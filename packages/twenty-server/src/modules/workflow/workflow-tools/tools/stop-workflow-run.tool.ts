import { z } from 'zod';

import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const stopWorkflowRunSchema = z.object({
  workflowRunId: z.uuid().describe('The UUID of the workflow run to stop'),
});

type StopWorkflowRunInput = z.infer<typeof stopWorkflowRunSchema>;

export const createStopWorkflowRunTool = (
  deps: Pick<WorkflowToolDependencies, 'workflowTriggerService'>,
  context: WorkflowToolContext,
) => ({
  name: 'stop_workflow_run' as const,
  description:
    'Stop a workflow run that is not started, enqueued, running or waiting. Rate-limited runs resume on their own; only stop one when the user asks.',
  inputSchema: stopWorkflowRunSchema,
  execute: async (parameters: StopWorkflowRunInput) => {
    try {
      await deps.workflowTriggerService.stopWorkflowRun(
        parameters.workflowRunId,
        context.workspaceId,
      );

      return { success: true, workflowRunId: parameters.workflowRunId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: message,
        message: `Failed to stop workflow run: ${message}`,
      };
    }
  },
});

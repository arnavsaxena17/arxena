export type RunWorkflowJobData = {
  workspaceId: string;
  workflowRunId: string;
  workflowVersionId?: string;
  payload?: object;
  lastExecutedStepId?: string;
  stepIdsToRetry?: string[];
};

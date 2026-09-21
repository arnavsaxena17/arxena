export type ProcessWorkflowAiFilteringJobData = {
  workspaceId: string;
  workflowRunId: string;
  workflowStepId: string;
  sessionId: string;
  candidates: Record<string, unknown>[];
  filter: {
    name: string;
    prompt: string;
    selectedModel: string;
    selectedMetadataFields: string[];
    includeResume?: boolean;
    fields: Array<{
      name: string;
      type: string;
      description?: string;
      enumValues?: string[];
    }>;
  };
};

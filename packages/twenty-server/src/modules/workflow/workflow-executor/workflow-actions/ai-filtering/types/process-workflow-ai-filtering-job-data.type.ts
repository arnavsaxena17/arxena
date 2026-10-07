import { type WorkflowAiFilteringField } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-action-input.type';

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
    keepField?: string;
    concurrency?: number;
    batchSize?: number;
    subject?: 'person' | 'company' | 'record';
    context?: string;
    fields: WorkflowAiFilteringField[];
  };
};

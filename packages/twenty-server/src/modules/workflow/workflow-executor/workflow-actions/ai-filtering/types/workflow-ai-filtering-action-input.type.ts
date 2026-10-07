export type WorkflowAiFilteringField = {
  name: string;
  type: string;
  description?: string;
  enumValues?: string[];
  optional?: boolean;
};

export type WorkflowAiFilteringActionInput = {
  candidates?: unknown;
  name?: string;
  prompt?: string;
  selectedModel?: string;
  selectedMetadataFields?: string[];
  includeResume?: boolean;
  fields?: WorkflowAiFilteringField[];
  existingFilterId?: string;
  // Boolean/enum answer that decides keep vs reject; defaults to the first boolean field.
  keepField?: string;
  concurrency?: number;
  batchSize?: number;
  // What is being screened: shapes the model's instructions.
  subject?: 'person' | 'company' | 'record';
  // Extra campaign facts appended to the prompt. Workspace ICP is added on top.
  context?: string;
  filterDescription?: string;
};

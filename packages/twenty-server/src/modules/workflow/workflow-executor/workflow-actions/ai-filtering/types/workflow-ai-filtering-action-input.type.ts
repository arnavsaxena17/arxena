export type WorkflowAiFilteringField = {
  name: string;
  type: string;
  description?: string;
  enumValues?: string[];
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
  filterDescription?: string;
};

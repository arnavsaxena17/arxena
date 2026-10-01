export type WorkflowAiAgentOutputValidationCheckInput = {
  id: string;
  label: string;
  instructions: string;
  invalidWhen: string;
  validWhen: string;
};

export type WorkflowAiAgentOutputValidationInput = {
  enabled: boolean;
  fieldKeys: string[];
  checks?: WorkflowAiAgentOutputValidationCheckInput[];
};

export type WorkflowAiAgentActionInput = {
  agentId?: string;
  prompt?: string;
  outputValidation?: WorkflowAiAgentOutputValidationInput;
};

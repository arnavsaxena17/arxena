export type AiAgentOutputValidationFieldResult = {
  fieldKey: string;
  skipped: boolean;
  codeFailure?: string;
  operatorNote?: number;
  unresolvedPlaceholder?: number;
  checkResults?: Array<{
    id: string;
    label: string;
    noul?: number;
    failed: boolean;
  }>;
  cleared: boolean;
};

export type AiAgentOutputValidationReport = {
  attempts: number;
  cleared: boolean;
  fields: AiAgentOutputValidationFieldResult[];
};

export type AiAgentTestData = {
  output: {
    data?: string;
    duration?: number;
    error?: string;
    outputValidation?: AiAgentOutputValidationReport;
  };
  language: 'plaintext' | 'json';
};

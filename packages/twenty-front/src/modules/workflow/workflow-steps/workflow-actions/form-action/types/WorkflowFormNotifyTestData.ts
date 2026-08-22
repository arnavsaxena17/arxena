export type WorkflowFormNotifyTestSendResult = {
  channel: string;
  status: string;
  detail?: string | null;
};

export type WorkflowFormNotifyTestOutput = {
  testId?: string;
  status?: string;
  pointer?: string;
  fillUrl?: string | null;
  sendResults?: WorkflowFormNotifyTestSendResult[];
  capturedResponse?: Record<string, unknown> | null;
  error?: string | null;
  duration?: number;
};

export type WorkflowFormNotifyTestData = {
  variableValues: { [variablePath: string]: string };
  output: WorkflowFormNotifyTestOutput;
  language: 'plaintext' | 'json';
};

import { type FormFieldMetadata } from 'src/modules/workflow/workflow-executor/workflow-actions/form/types/workflow-form-action-settings.type';

export const WORKFLOW_FORM_NOTIFY_TEST_TTL_MS = 30 * 60 * 1000;

export type WorkflowFormNotifyTestStatus =
  | 'waiting'
  | 'captured'
  | 'failed'
  | 'expired';

export type WorkflowFormNotifyTestSendResult = {
  channel: string;
  status: string;
  detail?: string;
};

export type WorkflowFormNotifyTestSession = {
  testId: string;
  workspaceId: string;
  stepId: string;
  status: WorkflowFormNotifyTestStatus;
  fields: FormFieldMetadata[];
  contextText: string;
  pointer: string;
  fillUrl: string;
  sendResults: WorkflowFormNotifyTestSendResult[];
  capturedResponse?: Record<string, unknown>;
  capturedAt?: string;
  error?: string;
  createdAt: string;
};

export type WorkflowFormNotifyTestResult = {
  testId: string;
  status: WorkflowFormNotifyTestStatus;
  pointer: string;
  fillUrl?: string;
  sendResults: WorkflowFormNotifyTestSendResult[];
  capturedResponse?: Record<string, unknown>;
  error?: string;
};

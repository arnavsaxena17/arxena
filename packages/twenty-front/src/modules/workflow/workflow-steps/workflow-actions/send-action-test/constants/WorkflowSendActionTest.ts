import { type WorkflowSendActionTestData } from '@/workflow/workflow-steps/workflow-actions/send-action-test/types/WorkflowSendActionTestData';

export const DEFAULT_WORKFLOW_SEND_ACTION_TEST_OUTPUT_VALUE: WorkflowSendActionTestData['output'] =
  {
    data: 'Pick a candidate, enter a body, then press Test',
  };

export const WORKFLOW_SEND_ACTION_TAB = {
  CONFIGURATION: 'configuration',
  TEST: 'test',
} as const;

export type WorkflowSendActionTabId =
  (typeof WORKFLOW_SEND_ACTION_TAB)[keyof typeof WORKFLOW_SEND_ACTION_TAB];

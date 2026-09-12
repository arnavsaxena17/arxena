import { createAtomFamilyState } from '@/ui/utilities/state/jotai/utils/createAtomFamilyState';
import { DEFAULT_WORKFLOW_SEND_ACTION_TEST_OUTPUT_VALUE } from '@/workflow/workflow-steps/workflow-actions/send-action-test/constants/WorkflowSendActionTest';
import { type WorkflowSendActionTestData } from '@/workflow/workflow-steps/workflow-actions/send-action-test/types/WorkflowSendActionTestData';

export const workflowSendActionTestDataFamilyState = createAtomFamilyState<
  WorkflowSendActionTestData,
  string
>({
  key: 'workflowSendActionTestDataFamilyState',
  defaultValue: {
    language: 'plaintext',
    output: DEFAULT_WORKFLOW_SEND_ACTION_TEST_OUTPUT_VALUE,
  },
});

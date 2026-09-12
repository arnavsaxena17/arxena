import { gql } from '@apollo/client';

export const TEST_WORKFLOW_SEND_ACTION = gql`
  mutation TestWorkflowSendAction($input: TestWorkflowSendActionInput!) {
    testWorkflowSendAction(input: $input) {
      success
      message
      result
      error
      durationMs
    }
  }
`;

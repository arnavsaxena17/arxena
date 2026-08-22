import { gql } from '@apollo/client';

export const TEST_WORKFLOW_FORM_NOTIFY = gql`
  mutation TestWorkflowFormNotify($input: TestWorkflowFormNotifyInput!) {
    testWorkflowFormNotify(input: $input) {
      testId
      status
      pointer
      fillUrl
      sendResults {
        channel
        status
        detail
      }
      capturedResponse
      error
    }
  }
`;

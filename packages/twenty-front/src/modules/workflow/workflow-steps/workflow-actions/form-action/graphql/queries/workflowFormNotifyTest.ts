import { gql } from '@apollo/client';

export const WORKFLOW_FORM_NOTIFY_TEST = gql`
  query WorkflowFormNotifyTest($testId: UUID!) {
    workflowFormNotifyTest(testId: $testId) {
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

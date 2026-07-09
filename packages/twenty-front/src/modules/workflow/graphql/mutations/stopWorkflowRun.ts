import { gql } from '@apollo/client';

export const STOP_WORKFLOW_RUN = gql`
  mutation StopWorkflowRun($workflowRunId: String!) {
    stopWorkflowRun(workflowRunId: $workflowRunId) {
      id
      status
      __typename
    }
  }
`;

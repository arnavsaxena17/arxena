import { gql } from '@apollo/client';

export const BULK_FORCE_STOP_WORKFLOW_RUNS = gql`
  mutation BulkForceStopWorkflowRuns($workflowId: UUID!) {
    bulkForceStopWorkflowRuns(workflowId: $workflowId) {
      stoppedCount
      __typename
    }
  }
`;

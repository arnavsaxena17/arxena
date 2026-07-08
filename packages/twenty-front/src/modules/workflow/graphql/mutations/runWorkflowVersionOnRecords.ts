import { gql } from '@apollo/client';

export const RUN_WORKFLOW_VERSION_ON_RECORDS = gql`
  mutation RunWorkflowVersionOnRecords($input: RunWorkflowVersionOnRecordsInput!) {
    runWorkflowVersionOnRecords(input: $input) {
      workflowRunIds
    }
  }
`;

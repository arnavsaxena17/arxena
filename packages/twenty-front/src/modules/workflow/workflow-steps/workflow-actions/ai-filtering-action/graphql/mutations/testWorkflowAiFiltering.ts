import { gql } from '@apollo/client';

export const TEST_WORKFLOW_AI_FILTERING = gql`
  mutation TestWorkflowAiFiltering($input: TestWorkflowAiFilteringInput!) {
    testWorkflowAiFiltering(input: $input) {
      success
      message
      result
      error
      durationMs
    }
  }
`;

import { gql } from '@apollo/client';

export const TEST_AI_AGENT = gql`
  mutation TestAiAgent($input: TestAiAgentInput!) {
    testAiAgent(input: $input) {
      success
      message
      result
      error
      durationMs
    }
  }
`;

import { gql } from '@apollo/client';

export const CREATE_ONE_AI_INTERVIEW = gql`
  mutation CreateOneAIInterview($input: AIInterviewCreateInput!) {
    createAIInterview(data: $input) {
      instructions
      name
      id
      jobId
      introduction
      aIModelId
    }
  }
`;

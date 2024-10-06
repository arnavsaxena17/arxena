import { gql } from '@apollo/client';

export const CREATE_ONE_AI_INTERVIEW_QUESTION = gql`
  mutation CreateOneAIInterviewQuestion($input: AIInterviewQuestionCreateInput!) {
    createAIInterviewQuestion(data: $input) {
      retakes
      answerType
      questionType
      questionValue
      updatedAt
      name
      id
      aIInterviewId
      timeLimit
    }
  }
`;

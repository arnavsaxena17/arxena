import { gql } from '@apollo/client';

export const CREATE_ONE_AI_INTERVIEW_QUESTION = gql`
  mutation CreateOneAIInterviewQuestion(
    $input: AIInterviewQuestionCreateInput!
  ) {
    createAIInterviewQuestion(data: $input) {
      __typename
      questionValue
      answerType
      id
      name
      retakes
      timeLimit
      aIInterviewId
      questionType
    }
  }
`;

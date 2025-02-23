import { gql } from '@apollo/client';

export const CREATE_ONE_VIDEO_INTERVIEW_QUESTION = gql`
  mutation CreateOneVideoInterviewQuestion($input: VideoInterviewQuestionCreateInput!) {
    createVideoInterviewQuestion(data: $input) {
      retakes
      answerType
      questionType
      questionValue
      name
      id
      videoInterviewTemplateId
      timeLimit
    }
  }
`;

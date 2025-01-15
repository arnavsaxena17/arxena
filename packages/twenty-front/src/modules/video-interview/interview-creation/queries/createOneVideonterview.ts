import { gql } from '@apollo/client';

export const CREATE_ONE_VIDEO_INTERVIEW_TEMPLATE = gql`
  mutation CreateOneVideoInterviewTemplate($input: VideoInterviewTemplateCreateInput!) {
    createVideoInterviewTemplate(data: $input) {
      instructions
      name
      id
      jobId
      introduction
      videoInterviewModelId
    }
  }
`;

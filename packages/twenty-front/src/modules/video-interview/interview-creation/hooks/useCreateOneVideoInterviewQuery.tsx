import { useMutation } from '@apollo/client';

import { CREATE_ONE_VIDEO_INTERVIEW_TEMPLATE } from '@/video-interview/interview-creation/queries/createOneVideonterview';

export const useCreateOneVideoInterviewQuery = () => {
  const [createOneVideoInterviewTemplate, { data, loading, error }] = useMutation(CREATE_ONE_VIDEO_INTERVIEW_TEMPLATE);

  const createVideoInterview = async (introduction: any, objectRecordId: string, newVideoInterviewTemplateId: string) => {
    let instructionsAll: string | undefined = undefined;

    if (introduction.instructions !== undefined) {
      instructionsAll = introduction.instructions[0];
      for (let i = 1; i <= introduction.instructions.length; i++) {
        instructionsAll = instructionsAll + introduction.instructions[i];
      }
    }

    console.log(introduction.videoInterviewModelId);

    const input = {
      id: newVideoInterviewTemplateId,
      jobId: objectRecordId,
      name: introduction.VideoInterviewTemplateName,
      introduction: introduction.introduction,
      instructions: instructionsAll,
      videoInterviewModelId: introduction.videoInterviewModelId,
    };

    try {
      await createOneVideoInterviewTemplate({
        variables: { input },
      });
    } catch (e) {
      console.error(e);
    }
  };

  return { createVideoInterview };
};

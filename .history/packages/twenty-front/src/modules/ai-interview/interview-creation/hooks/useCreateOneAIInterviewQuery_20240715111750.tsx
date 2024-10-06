import { useMutation } from '@apollo/client';

import { CREATE_ONE_AI_INTERVIEW } from '@/ai-interview/interview-creation/queries/createOneAIInterview';

export const useCreateOneAIInterviewQuery = () => {
  const [createOneAIInterview, { data, loading, error }] = useMutation(
    CREATE_ONE_AI_INTERVIEW,
  );

  const createAIInterview = async (
    introduction: any,
    objectRecordId: string,
    newAIInterviewID: string,
  ) => {
    let instructionsAll: string | undefined = undefined;

    if (introduction.instructions !== undefined) {
      instructionsAll = introduction.instructions[0];
      for (let i = 1; i <= introduction.instructions.length; i++) {
        instructionsAll = instructionsAll + introduction.instructions[i];
      }
    }

    const input = {
      id: newAIInterviewID,
      jobId: objectRecordId,
      name: introduction.aIInterviewName,
      introduction: introduction.introduction,
      instructions: instructionsAll,
      aIModelId: introduction.aIModelId,
    };

    try {
      await createOneAIInterview({
        variables: { input },
      });
    } catch (e) {
      console.error(e);
    }
  };

  return { createAIInterview };
};

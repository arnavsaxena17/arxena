import { useMutation } from '@apollo/client';
import { v4 as uid } from 'uuid';

import { CREATE_ONE_AI_INTERVIEW_QUESTION } from '@/ai-interview/interview-creation/queries/createOneAIInterviewQuestion';
export const useCreateOneAIInterviewQuestionQuery = () => {
  const [createOneAIInterviewQuestion, { data, loading, error }] = useMutation(CREATE_ONE_AI_INTERVIEW_QUESTION);

  const createAIInterviewQuestions = async (questions: any[], newAIInterviewID: string) => {
    const noOfQuestions = questions.length;

    console.log('I am questions - ', questions, noOfQuestions);

    for (let i = 0; i < noOfQuestions; i++) {
      const newQuestionId = uid();

      const inputCreateInterview = {
        questionValue: questions[i].question,
        answerType: questions[i].answerType,
        id: newQuestionId,
        name: `Question-${i + 1}`,
        retakes: questions[i].retakes || undefined,
        timeLimit: questions[i].timeLimit || undefined,
        aIInterviewId: newAIInterviewID,
        questionType: questions[i].questionType,
      };
      console.log('This is the input object:', inputCreateInterview);
      try {
        await createOneAIInterviewQuestion({
          variables: { inputCreateInterview },
        });
      } catch (e) {
        console.error(e);
      }
    }
  };
  return { createAIInterviewQuestions };
};

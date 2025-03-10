import { useMutation } from '@apollo/client';
import { v4 as uid } from 'uuid';

import { CREATE_ONE_VIDEO_INTERVIEW_QUESTION } from '@/video-interview/interview-creation/queries/createOneVideoInterviewQuestion';
import { undefined } from 'zod';
export const useCreateOneVideoInterviewQuestionQuery = () => {
  const [createOneVideoInterviewQuestion, { data, loading, error }] =
    useMutation(CREATE_ONE_VIDEO_INTERVIEW_QUESTION);

  const createVideoInterviewQuestions = async (
    questions: any[],
    newVideoInterviewTemplateID: string,
  ) => {
    const noOfQuestions = questions.length;

    const retakesDataTypeConverter = (num: string) => {
      if (num === '0') {
        return 'ZERO';
      } else if (num === '1') {
        return 'ONE';
      } else if (num === '2') {
        return 'TWO';
      } else {
        return undefined;
      }
    };

    console.log('I am questions - ', questions, noOfQuestions);

    for (let i = 0; i < noOfQuestions; i++) {
      const newQuestionId = uid();
      console.log('Processing question:', questions[i]); // Add this debug log

      const input = {
        questionValue: questions[i].question,
        answerType: questions[i].answerType,
        id: newQuestionId,
        name: `Question-${i + 1}`,
        retakes: retakesDataTypeConverter(questions[i].retakes) || undefined,
        timeLimit: parseInt(questions[i].timeLimit, 10) || undefined,
        videoInterviewTemplateId: newVideoInterviewTemplateID,
        questionType: questions[i].questionType || 'VIDEO', // Fallback to answerType if questionType is undefined
      };
      console.log('This is the input object:', input, error);
      try {
        await createOneVideoInterviewQuestion({
          variables: { input },
        });
      } catch (e) {
        console.error(e);
      }
    }
  };
  return { createVideoInterviewQuestions };
};

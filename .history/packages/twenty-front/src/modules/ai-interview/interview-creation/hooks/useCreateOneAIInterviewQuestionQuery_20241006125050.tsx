import { useMutation } from '@apollo/client';
import { v4 as uid } from 'uuid';

import { CREATE_ONE_AI_INTERVIEW_QUESTION } from '@/ai-interview/interview-creation/queries/createOneAIInterviewQuestion';
import { undefined } from 'zod';
export const useCreateOneAIInterviewQuestionQuery = () => {
  const [createOneAIInterviewQuestion, { data, loading, error }] = useMutation(CREATE_ONE_AI_INTERVIEW_QUESTION);

  const createAIInterviewQuestions = async (questions: any[], newAIInterviewID: string) => {
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

      const input = {
        questionValue: questions[i].question,
        answerType: questions[i].answerType,
        id: newQuestionId,
        name: `Question-${i + 1}`,
        retakes: retakesDataTypeConverter(questions[i].retakes) || undefined,
        timeLimit: questions[i].timeLimit || undefined,
        aIInterviewId: newAIInterviewID,
        questionType: questions[i].questionType,
      };
      console.log('This is the input object:', input);
try {
      const response = await createOneAIInterviewQuestion({
        variables: { input },
      });
      console.log('Response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('Error creating question:', e);
      if (e.graphQLErrors) {
        console.error('GraphQL errors:', e.graphQLErrors);
      }
      if (e.networkError) {
        console.error('Network error:', e.networkError);
      }
    }
    }
  };
  return { createAIInterviewQuestions };
};

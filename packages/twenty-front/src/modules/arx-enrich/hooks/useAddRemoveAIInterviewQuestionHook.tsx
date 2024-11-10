import { useRecoilState } from 'recoil';
import { v4 as uid } from 'uuid';

import { useQuestionToDisplay } from '@/ai-interview/interview-creation/hooks/useQuestionToDisplay';
import { QuestionNavElement } from '@/ai-interview/interview-creation/left-side/components/ai-interview-modal-nav-container/question/QuestionNavElement';
import { AIInterviewQuestion } from '@/ai-interview/interview-creation/right-side/components/question/AIInterviewQuestion';
import { questionsArrState } from '@/ai-interview/interview-creation/states/questionsArrState';
import { leftAndRightCombined } from '@/ai-interview/interview-creation/types/leftAndRightCombined';

export const useAddRemoveAIInterviewQuestion = () => {
  const [questionsArr, setQuestionsArr] =
    useRecoilState<leftAndRightCombined[]>(questionsArrState);

  const { changeQuestionToDisplay } = useQuestionToDisplay();

  const addQuestion = () => {
    const newId = uid();
    const newQuestion: leftAndRightCombined = {
      id: newId,
      leftQuestion: (questionNumber = 1) => (
        <QuestionNavElement
          id={newId}
          questionNumber={questionNumber}
          deleteQuestion={deleteQuestion}
        />
      ),
      rightQuestion: (questionNumber = 1) => (
        <AIInterviewQuestion id={newId} questionNumber={questionNumber} />
      ),
    };
    setQuestionsArr((previousQuestions) => [...previousQuestions, newQuestion]);
    changeQuestionToDisplay(newId);
  };

  const deleteQuestion = (id: string) => {
    setQuestionsArr((prevQuestions) =>
      prevQuestions.filter((question) => question.id !== id),
    );
  };

  return { addQuestion, questionsArr };
};

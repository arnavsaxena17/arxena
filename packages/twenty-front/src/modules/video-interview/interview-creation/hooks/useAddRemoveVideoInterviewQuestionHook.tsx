import { useRecoilState } from 'recoil';
import { v4 as uid } from 'uuid';

import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';
import { QuestionNavElement } from '@/video-interview/interview-creation/left-side/components/video-interview-modal-nav-container/question/QuestionNavElement';
import { VideoInterviewQuestion } from '@/video-interview/interview-creation/right-side/components/question/VideoInterviewQuestion';
import { questionsArrState } from '@/video-interview/interview-creation/states/questionsArrState';
import { leftAndRightCombined } from '@/video-interview/interview-creation/types/leftAndRightCombined';

export const useAddRemoveVideoInterviewQuestion = () => {
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
        <VideoInterviewQuestion id={newId} questionNumber={questionNumber} />
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

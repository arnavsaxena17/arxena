import styled from '@emotion/styled';

import { useQuestionToDisplay } from '@/ai-interview/interview-creation/hooks/useQuestionToDisplay';
import { AnswerTypeSelect } from '@/ai-interview/interview-creation/right-side/components/question/answer-type-selection/AnswerTypeSelect';
import { SELECT_ANSWER_TYPE_DROPDOWN_ID } from '@/ai-interview/interview-creation/right-side/components/question/answer-type-selection/selectAnswerTypeDropdownId';
import { QuestionTypeSelectionContainer } from '@/ai-interview/interview-creation/right-side/components/question/question-type-selection/QuestionTypeSelectionContainer';
import { SELECT_QUESTION_TYPE_DROPDOWN_ID } from '@/ai-interview/interview-creation/right-side/components/question/question-type-selection/selectQuestionTypeDropdownId';
const StyledContainer = styled.div`
  flex-direction: column;
  gap: 44px;
  overflow-y: scroll;
  scroll-behavior: smooth;
  flex-grow: 1;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

export const AIInterviewQuestion = ({
  id,
  questionNumber,
}: {
  id: string;
  questionNumber: number;
}) => {
  const { questionToDisplay } = useQuestionToDisplay();

  return (
    <StyledContainer
      id={id}
      style={{ display: id === questionToDisplay ? 'flex' : 'none' }}
    >
      <QuestionTypeSelectionContainer
        id={`${SELECT_QUESTION_TYPE_DROPDOWN_ID}-${id}`}
        questionNumber={questionNumber}
      />
      <AnswerTypeSelect
        id={`${SELECT_ANSWER_TYPE_DROPDOWN_ID}-${id}`}
        questionNumber={questionNumber}
      />
    </StyledContainer>
  );
};

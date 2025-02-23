import styled from '@emotion/styled';

import { QuestionTextArea } from '@/video-interview/interview-creation/right-side/components/question/question-type-selection/QuestionTextArea';
import { QuestionTypeSelect } from '@/video-interview/interview-creation/right-side/components/question/question-type-selection/QuestionTypeSelect';
import { H2Title } from '@/ui/display/typography/components/H2Title';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

export const QuestionTypeSelectionContainer = ({ id, questionNumber }: { id: string; questionNumber: number }) => {
  return (
    <StyledContainer>
      <H2Title title={`Question ${questionNumber}`} />
      <QuestionTypeSelect id={id} questionNumber={questionNumber} />
      <QuestionTextArea questionNumber={questionNumber} />
    </StyledContainer>
  );
};

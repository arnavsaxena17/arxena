import { IconTrash } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React from 'react';

import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';

const StyledQuestionNavElement = styled.div`
  display: flex;
  flex-direction: row;
  max-width: 200px;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 6px;
  justify-content: space-between;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  &.active {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  color: ${themeCssVariables.grayScale.gray5};
  border-radius: 4px;
  &:hover #question-delete-icon {
    opacity: 1;
    cursor: pointer;
    transition: display 0.2 ease-in-out;
  }
  cursor: pointer;
`;

const StyledTrashIconContainer = styled.div`
  display: flex;
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  gap: ${themeCssVariables.spacing[1]};
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
`;

export const QuestionNavElement = ({
  id,
  questionNumber,
  deleteQuestion,
}: {
  id: string;
  questionNumber?: number;
  deleteQuestion: (id: string) => void;
}) => {
  const { questionToDisplay, changeQuestionToDisplay } = useQuestionToDisplay();

  const deleteCurrentQuestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteQuestion(id);
    changeQuestionToDisplay('introduction');
  };

  const changeQuestionToDisplayId = () => {
    changeQuestionToDisplay(id);
  };

  return (
    <StyledQuestionNavElement
      onClick={changeQuestionToDisplayId}
      className={questionToDisplay === id ? 'active' : ''}
    >
      {`Question ${questionNumber}`}
      {questionNumber !== 1 ? (
        <StyledTrashIconContainer
          id="question-delete-icon"
          onClick={deleteCurrentQuestion}
        >
          <IconTrash size={14} />
        </StyledTrashIconContainer>
      ) : (
        <></>
      )}
    </StyledQuestionNavElement>
  );
};

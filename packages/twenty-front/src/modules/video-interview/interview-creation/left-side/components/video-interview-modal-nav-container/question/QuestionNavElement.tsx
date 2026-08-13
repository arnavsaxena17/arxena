import { IconTrash } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React from 'react';

import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';

const StyledQuestionNavElement = styled.div`
  border-radius: 4px;
  color: ${themeCssVariables.grayScale.gray5};
  cursor: pointer;
  display: flex;
  flex-direction: row;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  justify-content: space-between;
  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  &.active {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  max-width: 200px;
  padding: 6px;
  &:hover #question-delete-icon {
    cursor: pointer;
    opacity: 1;
    transition: display 0.2 ease-in-out;
  }
  transition: background-color 0.3s ease;
`;

const StyledTrashIconContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
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

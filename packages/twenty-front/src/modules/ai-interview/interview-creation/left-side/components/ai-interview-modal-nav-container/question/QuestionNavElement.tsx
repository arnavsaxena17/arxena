import React from 'react';
import styled from '@emotion/styled';
import { IconTrash } from 'twenty-ui';

import { useQuestionToDisplay } from '@/ai-interview/interview-creation/hooks/useQuestionToDisplay';

const StyledQuestionNavElement = styled.div`
  display: flex;
  flex-direction: row;
  max-width: 200px;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 6px;
  justify-content: space-between;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  &.active {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  color: ${({ theme }) => theme.grayScale.gray50};
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
  color: ${({ theme }) => theme.font.color.tertiary};
  gap: ${({ theme }) => theme.spacing(1)};
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

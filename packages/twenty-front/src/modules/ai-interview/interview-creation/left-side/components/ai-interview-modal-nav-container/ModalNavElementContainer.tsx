import styled from '@emotion/styled';

import { useAddRemoveAIInterviewQuestion } from '@/ai-interview/interview-creation/hooks/useAddRemoveAIInterviewQuestionHook';
import { IntroductionNavElement } from '@/ai-interview/interview-creation/left-side/components/ai-interview-modal-nav-container/introduction/IntroductionNavElement';

const StyledModalNavElementContainer = styled.nav`
  display: flex;
  gap: 4px;
  padding: 6px 0 6px 0;
  flex-direction: column;
`;

const StyledButton = styled.div`
  border: none;
  font-family: inherit;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  cursor: pointer;
  background-color: none;
  margin-top: 16px;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 8px;
  padding: 0;
  margin: 0px;
  list-style-type: none;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const StyledListItem = styled.li`
  &::marker {
    display: none;
    font-family: inherit;
    color: ${({ theme }) => theme.font.color.light};
    font-size: ${({ theme }) => theme.font.size.md};
    font-weight: ${({ theme }) => theme.font.weight.regular};
  }
`;

export const ModalNavElementContainer = () => {
  const { questionsArr, addQuestion } = useAddRemoveAIInterviewQuestion();

  return (
    <StyledModalNavElementContainer>
      <StyledQuestionsContainer type="1">
        <IntroductionNavElement id={'introduction'} />
        {questionsArr.map((question, index) => (
          <StyledListItem key={question.id}>
            {question.leftQuestion(index + 1)}
          </StyledListItem>
        ))}
      </StyledQuestionsContainer>
      <StyledButton onClick={addQuestion}>{'+ Add Question'}</StyledButton>
    </StyledModalNavElementContainer>
  );
};


import { useAddRemoveVideoInterviewQuestion } from '@/video-interview/interview-creation/hooks/useAddRemoveVideoInterviewQuestionHook';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IntroductionNavElement } from '@/video-interview/interview-creation/left-side/components/video-interview-modal-nav-container/introduction/IntroductionNavElement';
import { type Key, type ReactElement, type JSXElementConstructor, type ReactNode, type ReactPortal } from 'react';



const StyledModalNavElementContainer = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0 6px 0;
`;

const StyledButton = styled.div`
  background-color: none;
  border: none;
  color: ${themeCssVariables.font.color.light};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  margin-top: 16px;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 8px;
  list-style-type: none;
  margin: 0px;
  overflow-y: scroll;
  padding: 0;
  scroll-behavior: smooth;
`;

const StyledListItem = styled.li`
  &::marker {
    color: ${themeCssVariables.font.color.light};
    display: none;
    font-family: inherit;
    font-size: ${themeCssVariables.font.size.md};
    font-weight: ${themeCssVariables.font.weight.regular};
  }
`;

export const ModalNavElementContainer = () => {
  const { questionsArr, addQuestion } = useAddRemoveVideoInterviewQuestion();

  return (
    <StyledModalNavElementContainer>
      <StyledQuestionsContainer type="1">
        <IntroductionNavElement id={'introduction'} />
        {questionsArr.map((question: { id: Key | null | undefined; leftQuestion: (arg0: any) => string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; }, index: number) => (
          <StyledListItem key={question.id}>
            {question.leftQuestion(index + 1)}
          </StyledListItem>
        ))}
      </StyledQuestionsContainer>
      <StyledButton onClick={addQuestion}>{'+ Add Question'}</StyledButton>
    </StyledModalNavElementContainer>
  );
};

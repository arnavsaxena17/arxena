import styled from '@emotion/styled';
import { v4 as uid } from 'uuid';

import { useAddRemoveAIInterviewQuestion } from '@/ai-interview/interview-creation/hooks/useAddRemoveAIInterviewQuestionHook';
import { useCreateOneAIInterviewQuery } from '@/ai-interview/interview-creation/hooks/useCreateOneAIInterviewQuery';
import { useCreateOneAIInterviewQuestionQuery } from '@/ai-interview/interview-creation/hooks/useCreateOneAIInterviewQuestionQuery';
import { useFormDataConversion } from '@/ai-interview/interview-creation/hooks/useFormDataConversion';
import { AIInterviewName } from '@/ai-interview/interview-creation/right-side/components/ai-interview-name/AIInterviewName';
import { AIInterviewIntroduction } from '@/ai-interview/interview-creation/right-side/components/introduction/AIInterviewIntroduction';

const StyledAllContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 44px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (2 / 3));
  min-width: 264px;
  flex-shrink: 1;
`;

const StyledFormElement = styled.form`
  display: flex;
  gap: 44px;
  flex-grow: 1;
  flex-direction: column;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
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

export const AIInterviewRightSideContainer = ({
  aIModelsArr,
  closeModal,
  objectNameSingular,
  objectRecordId,
}: {
  aIModelsArr: any;
  closeModal: () => void;
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const { questionsArr } = useAddRemoveAIInterviewQuestion();

  const { convertFormData } = useFormDataConversion();
  const { createAIInterview } = useCreateOneAIInterviewQuery();
  const { createAIInterviewQuestions } = useCreateOneAIInterviewQuestionQuery();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const newAIInterviewID = uid();

    const form = event.currentTarget;

    const formData = new FormData(form);
    console.log('Form data', formData);

    const { introduction, questions } = convertFormData(formData);

    console.log(questions);

    await createAIInterview(introduction, objectRecordId, newAIInterviewID);
    await createAIInterviewQuestions(questions, newAIInterviewID);

    closeModal();
  };

  return (
    <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
      <StyledFormElement onSubmit={handleSubmit} id="NewAIInterviewForm">
        <AIInterviewName closeModal={closeModal} />
        <StyledQuestionsContainer type="1">
          <AIInterviewIntroduction
            id={'introduction'}
            aIModelsArr={aIModelsArr}
          />
          {questionsArr.map((question, index) => (
            <StyledListItem key={question.id}>
              {question.rightQuestion(index + 1)}
            </StyledListItem>
          ))}
        </StyledQuestionsContainer>
      </StyledFormElement>
    </StyledAllContainer>
  );
};

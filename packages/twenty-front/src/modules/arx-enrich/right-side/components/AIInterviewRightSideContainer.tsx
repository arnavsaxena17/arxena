import styled from '@emotion/styled';
import { v4 as uid } from 'uuid';

import { useAddRemoveAIInterviewQuestion } from '@/arx-enrich/hooks/useAddRemoveAIInterviewQuestionHook';
import { useCreateOneAIInterviewQuery } from '@/arx-enrich/hooks/useCreateOneAIInterviewQuery';
import { useCreateOneAIInterviewQuestionQuery } from '@/arx-enrich/hooks/useCreateOneAIInterviewQuestionQuery';
import { useFormDataConversion } from '@/arx-enrich/hooks/useFormDataConversion';
import { AIInterviewName } from '@/arx-enrich/right-side/components/ai-interview-name/AIInterviewName';
import { AIInterviewIntroduction } from '@/arx-enrich/right-side/components/introduction/AIInterviewIntroduction';
import DynamicModelCreator from './formCreator';

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

export const AIInterviewRightSideContainer = ({ aIModelsArr, closeModal, objectNameSingular, objectRecordId }: { aIModelsArr: any; closeModal: () => void; objectNameSingular: string; objectRecordId: string }) => {
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



    <DynamicModelCreator/>




    </StyledAllContainer>
  );
};

import styled from '@emotion/styled';
import { v4 as uid } from 'uuid';

import { useAddRemoveVideoInterviewQuestion } from '@/video-interview/interview-creation/hooks/useAddRemoveVideoInterviewQuestionHook';
import { useCreateOneVideoInterviewQuery } from '@/video-interview/interview-creation/hooks/useCreateOneVideoInterviewQuery';
import { useCreateOneVideoInterviewQuestionQuery } from '@/video-interview/interview-creation/hooks/useCreateOneVideoInterviewQuestionQuery';
import { useFormDataConversion } from '@/video-interview/interview-creation/hooks/useFormDataConversion';
import { VideoInterviewName } from '@/video-interview/interview-creation/right-side/components/ai-interview-name/VideoInterviewName';
import { VideoInterviewIntroduction } from '@/video-interview/interview-creation/right-side/components/introduction/VideoInterviewIntroduction';

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

export const VideoInterviewRightSideContainer = ({ videoInterviewModelsArr, closeModal, objectNameSingular, objectRecordId }: { videoInterviewModelsArr: any; closeModal: () => void; objectNameSingular: string; objectRecordId: string }) => {
  const { questionsArr } = useAddRemoveVideoInterviewQuestion();

  const { convertFormData } = useFormDataConversion();
  const { createVideoInterview } = useCreateOneVideoInterviewQuery();
  const { createVideoInterviewQuestions } = useCreateOneVideoInterviewQuestionQuery();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const newVideoInterviewId = uid();

    const form = event.currentTarget;

    const formData = new FormData(form);
    console.log('Form data', formData);

    const { introduction, questions } = convertFormData(formData);

    console.log(questions);

    await createVideoInterview(introduction, objectRecordId, newVideoInterviewId);
    await createVideoInterviewQuestions(questions, newVideoInterviewId);

    closeModal();
  };

  return (
    <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
      <StyledFormElement onSubmit={handleSubmit} id="NewVideoInterviewForm">
        <VideoInterviewName closeModal={closeModal} />
        <StyledQuestionsContainer type="1">
          <VideoInterviewIntroduction id={'introduction'} videoInterviewModelsArr={videoInterviewModelsArr} />
          {questionsArr.map((question, index) => (
            <StyledListItem key={question.id}>{question.rightQuestion(index + 1)}</StyledListItem>
          ))}
        </StyledQuestionsContainer>
      </StyledFormElement>
    </StyledAllContainer>
  );
};

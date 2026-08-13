import { v4 as uid } from 'uuid';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useAddRemoveVideoInterviewQuestion } from '@/video-interview/interview-creation/hooks/useAddRemoveVideoInterviewQuestionHook';
import { useCreateOneVideoInterviewQuery } from '@/video-interview/interview-creation/hooks/useCreateOneVideoInterviewQuery';
import { useCreateOneVideoInterviewQuestionQuery } from '@/video-interview/interview-creation/hooks/useCreateOneVideoInterviewQuestionQuery';
import { useFormDataConversion } from '@/video-interview/interview-creation/hooks/useFormDataConversion';
import { VideoInterviewIntroduction } from '@/video-interview/interview-creation/right-side/components/introduction/VideoInterviewIntroduction';
import { VideoInterviewName } from '@/video-interview/interview-creation/right-side/components/video-interview-name/VideoInterviewName';

const StyledAllContainer = styled.div`
  background-color: ${themeCssVariables.background.primary};
  display: flex;
  flex-direction: column;
  flex-shrink: 1;
  gap: 44px;
  min-width: 264px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (2 / 3));
`;


const StyledFormElement = styled.form`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 44px;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
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

import { useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useRecoilState, useResetRecoilState } from 'recoil';

import { VideoInterviewLeftSideContainer } from '@/video-interview/interview-creation/left-side/components/VideoInterviewLeftSideContainer';
import { FIND_MANY_VIDEO_INTERVIEW_MODELS } from '@/video-interview/interview-creation/queries/findManyVideoInterviewModels';
import { VideoInterviewRightSideContainer } from '@/video-interview/interview-creation/right-side/components/VideoInterviewRightSideContainer';
import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';
import { questionsArrState } from '@/video-interview/interview-creation/states/questionsArrState';
import { questionToDisplayState } from '@/video-interview/interview-creation/states/questionToDisplay';
const StyledModalContainer = styled.div`
  background-color: transparent;
  top: 0px;
  left: 0px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 100vh;
  width: 100vw;
  z-index: 1000;
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
`;

const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 1001;
  overflow: hidden;
  max-height: 680px;
  box-sizing: border-box;
`;

export const InterviewCreationModal = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [isVideoInterviewModalOpen, setIsVideoInterviewModalOpen] = useRecoilState(
    isVideoInterviewModalOpenState,
  );

  const resetQuestionsArr = useResetRecoilState(questionsArrState);
  const resetQuestionToDisplay = useResetRecoilState(questionToDisplayState);
  const closeModal = () => {
    resetQuestionsArr();
    resetQuestionToDisplay();
    setIsVideoInterviewModalOpen(false);
  };

  const { loading, error, data } = useQuery(FIND_MANY_VIDEO_INTERVIEW_MODELS);

  if (loading) {
    return (
      <StyledModalContainer onClick={closeModal}>
        <StyledAdjuster>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <div>Loading...</div>
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    );
  }

  if (error != null) {
    return <div>Error: {error.message}</div>;
  }

  const videoInterviewModelsArr: any = data.videoInterviewModelModels.edges;

  if (!isVideoInterviewModalOpen) {
    return null;
  }

  return (
    <StyledModalContainer onClick={closeModal}>
      <StyledAdjuster>
        <StyledModal onClick={(e) => e.stopPropagation()}>
          <VideoInterviewLeftSideContainer />
          <VideoInterviewRightSideContainer
            videoInterviewModelsArr={videoInterviewModelsArr}
            closeModal={closeModal}
            objectNameSingular={objectNameSingular}
            objectRecordId={objectRecordId}
          />
        </StyledModal>
      </StyledAdjuster>
    </StyledModalContainer>
  );
};

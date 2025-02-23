import styled from '@emotion/styled';

import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';
import { AdditionalInformation } from '@/video-interview/interview-creation/right-side/components/introduction/additional-information/AdditionalInformation';
import { EthnicityAndModelSelectionContainer } from '@/video-interview/interview-creation/right-side/components/introduction/ai-model-selection/EthnicityAndModelSelectionContainer';
import { Instructions } from '@/video-interview/interview-creation/right-side/components/introduction/instructions/Instructions';
const StyledContainer = styled.div`
  flex-direction: column;
  // gap: 44px;
  overflow-y: scroll;
  scroll-behavior: smooth;
  flex-grow: 1;
  flex-shrink: 0;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

export const VideoInterviewIntroduction = ({ id, videoInterviewModelsArr }: { id: string; videoInterviewModelsArr: any }) => {
  const { questionToDisplay } = useQuestionToDisplay();

  return (
    <StyledContainer id={id} style={{ display: id === questionToDisplay ? 'flex' : 'none' }}>
      <EthnicityAndModelSelectionContainer videoInterviewModelsArr={videoInterviewModelsArr} />
      <AdditionalInformation />
      <Instructions />
    </StyledContainer>
  );
};

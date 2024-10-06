import styled from '@emotion/styled';

import { useQuestionToDisplay } from '@/ai-interview/interview-creation/hooks/useQuestionToDisplay';
import { AdditionalInformation } from '@/ai-interview/interview-creation/right-side/components/introduction/additional-information/AdditionalInformation';
import { EthnicityAndModelSelectionContainer } from '@/ai-interview/interview-creation/right-side/components/introduction/ai-model-selection/EthnicityAndModelSelectionContainer';
import { Instructions } from '@/ai-interview/interview-creation/right-side/components/introduction/instructions/Instructions';
const StyledContainer = styled.div`
  flex-direction: column;
  gap: 44px;
  overflow-y: scroll;
  scroll-behavior: smooth;
  flex-grow: 1;
  flex-shrink: 0;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

export const AIInterviewIntroduction = ({ id, aIModelsArr }: { id: string; aIModelsArr: any }) => {
  const { questionToDisplay } = useQuestionToDisplay();

  return (
    <StyledContainer id={id} style={{ display: id === questionToDisplay ? 'flex' : 'none' }}>
      <EthnicityAndModelSelectionContainer aIModelsArr={aIModelsArr} />
      <AdditionalInformation />
      <Instructions />
    </StyledContainer>
  );
};

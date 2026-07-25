
import { ModalNavElementContainer } from '@/video-interview/interview-creation/left-side/components/video-interview-modal-nav-container/ModalNavElementContainer';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: 32px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (1 / 3));
  max-width: 300px;
  min-width: 224px;
  flex-shrink: 1;
`;

export const VideoInterviewLeftSideContainer = () => {
  return (
    <StyledContainer>
      <div>New Video Interview</div>
      <ModalNavElementContainer />
    </StyledContainer>
  );
};

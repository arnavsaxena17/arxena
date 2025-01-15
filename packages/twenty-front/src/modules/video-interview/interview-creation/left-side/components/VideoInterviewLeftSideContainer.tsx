import styled from '@emotion/styled';

import { ModalNavElementContainer } from '@/video-interview/interview-creation/left-side/components/video-interview-modal-nav-container/ModalNavElementContainer';

const StyledContainer = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
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

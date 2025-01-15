import styled from '@emotion/styled';

import { VideoInterviewCreateButton } from '@/video-interview/interview-creation/right-side/components/video-interview-name/VideoInterviewCreateButton';
import { VideoInterviewModalCloseButton } from '@/video-interview/interview-creation/right-side/components/video-interview-name/VideoInterviewModalCloseButton';

const StyledVideoInterviewNameContainer = styled.div`
  display: flex;
`;

const StyledInput = styled.input`
  align-items: flex-start;
  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
    font-size: ${({ theme }) => theme.font.size.lg};
    font-weight: ${({ theme }) => theme.font.weight.medium};
    font-family: ${({ theme }) => theme.font.family};
  }
  &:focus {
    outline: none;
  }
  display: flex;
  flex-grow: 1;
  border: none;
  height: auto;
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: min-content;
  gap: 8px;
`;

export const VideoInterviewName = ({ closeModal }: { closeModal: () => void }) => {
  return (
    <StyledVideoInterviewNameContainer>
      <StyledInput
        type="text"
        placeholder="Interview Name..."
        name="newVideoInterviewTemplate[0][VideoInterviewTemplateName]"
        required
      />
      <StyledButtonsContainer>
        <VideoInterviewModalCloseButton closeModal={closeModal} />
        <VideoInterviewCreateButton />
      </StyledButtonsContainer>
    </StyledVideoInterviewNameContainer>
  );
};

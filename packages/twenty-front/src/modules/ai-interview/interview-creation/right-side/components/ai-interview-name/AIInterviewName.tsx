import styled from '@emotion/styled';

import { AIInterviewCreateButton } from '@/ai-interview/interview-creation/right-side/components/ai-interview-name/AIInterviewCreateButton';
import { AIInterviewModalCloseButton } from '@/ai-interview/interview-creation/right-side/components/ai-interview-name/AIInterviewModalCloseButton';

const StyledAIInterviewNameContainer = styled.div`
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

export const AIInterviewName = ({ closeModal }: { closeModal: () => void }) => {
  return (
    <StyledAIInterviewNameContainer>
      <StyledInput
        type="text"
        placeholder="Interview Name..."
        name="newAIInterview[0][aIInterviewName]"
        required
      />
      <StyledButtonsContainer>
        <AIInterviewModalCloseButton closeModal={closeModal} />
        <AIInterviewCreateButton />
      </StyledButtonsContainer>
    </StyledAIInterviewNameContainer>
  );
};

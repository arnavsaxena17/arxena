import styled from '@emotion/styled';

export const StyledActionBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

export const StyledLoaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  justify-content: center;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  flex-shrink: 0;
`;

export const StyledActionButton = styled.button<{
  disabled?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

export const StyledChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  gap: ${({ theme }) => theme.spacing(1)};
`;

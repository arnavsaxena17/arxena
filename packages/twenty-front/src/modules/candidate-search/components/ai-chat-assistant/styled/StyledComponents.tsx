import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledActionBar = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

export const StyledLoaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  justify-content: center;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  flex-shrink: 0;
`;

export const StyledActionButton = styled.button<{
  disabled?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.strong};
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
  gap: ${themeCssVariables.spacing[1]};
`;

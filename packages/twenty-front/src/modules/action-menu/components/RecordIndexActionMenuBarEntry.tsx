import { ActionMenuEntry } from '@/action-menu/types/ActionMenuEntry';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { i18n } from '@lingui/core';
import { Mixpanel } from '~/mixpanel';

type RecordIndexActionMenuBarEntryProps = {
  entry: ActionMenuEntry;
  trackAsCandidateAction?: boolean;
};

const StyledButton = styled.div`
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(2)};
  transition: background ${({ theme }) => theme.animation.duration.fast} ease;
  user-select: none;
  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledButtonLabel = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-left: ${({ theme }) => theme.spacing(1)};
`;

export const RecordIndexActionMenuBarEntry = ({
  entry,
  trackAsCandidateAction = false,
}: RecordIndexActionMenuBarEntryProps) => {
  const theme = useTheme();

  const handleClick = () => {
    if (trackAsCandidateAction) {
      Mixpanel.track('candidate_action', { actionKey: entry.key });
    }
    entry.onClick?.();
  };

  return (
    <StyledButton onClick={handleClick}>
      {entry.Icon && <entry.Icon size={theme.icon.size.md} />}
      <StyledButtonLabel>{i18n._(entry.label)}</StyledButtonLabel>
    </StyledButton>
  );
};

import { actionMenuEntriesComponentSelector } from '@/action-menu/states/actionMenuEntriesComponentSelector';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import styled from '@emotion/styled';
import { i18n } from '@lingui/core';
import React from 'react';
import { MenuItemCommand } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledGroupHeading = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  padding-bottom: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(2)};
  padding-right: ${({ theme }) => theme.spacing(1)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  user-select: none;
`;

const StyledGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

// Create a CommandGroup-like component for consistency
const ActionGroup = ({ heading, children }: { heading: string, children: React.ReactNode }) => {
  if (!children || !React.Children.count(children)) {
    return null;
  }
  return (
    <>
      <StyledGroupHeading>{heading}</StyledGroupHeading>
      <StyledGroup>{children}</StyledGroup>
    </>
  );
};

export const RightDrawerAllActionsContent = () => {
  const actionMenuEntries = useRecoilComponentValueV2(
    actionMenuEntriesComponentSelector,
  );

  const pinnedEntries = actionMenuEntries.filter((entry) => entry.isPinned);
  const nonPinnedEntries = actionMenuEntries.filter((entry) => !entry.isPinned);

  return (
    <StyledContainer>
      {pinnedEntries.length > 0 && (
        <ActionGroup heading="Pinned Actions">
          {pinnedEntries.map((entry) => (
            <MenuItemCommand
              key={entry.key}
              LeftIcon={entry.Icon}
              text={i18n._(entry.label)}
              onClick={() => entry.onClick?.()}
            />
          ))}
        </ActionGroup>
      )}
      {nonPinnedEntries.length > 0 && (
        <ActionGroup heading="Other Actions">
          {nonPinnedEntries.map((entry) => (
            <MenuItemCommand
              key={entry.key}
              LeftIcon={entry.Icon}
              text={i18n._(entry.label)}
              onClick={() => entry.onClick?.()}
            />
          ))}
        </ActionGroup>
      )}
    </StyledContainer>
  );
}; 
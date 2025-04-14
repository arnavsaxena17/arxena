import { actionMenuEntriesComponentSelector } from '@/action-menu/states/actionMenuEntriesComponentSelector';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import styled from '@emotion/styled';
import { i18n } from '@lingui/core';
import { MenuItemCommand } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledSectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.light};
  margin-top: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

export const RightDrawerAllActionsContent = () => {
  const actionMenuEntries = useRecoilComponentValueV2(
    actionMenuEntriesComponentSelector,
  );

  const pinnedEntries = actionMenuEntries.filter((entry) => entry.isPinned);
  const nonPinnedEntries = actionMenuEntries.filter((entry) => !entry.isPinned);

  return (
    <StyledContainer>
      <StyledTitle>All Actions</StyledTitle>
      
      {pinnedEntries.length > 0 && (
        <>
          <StyledSectionTitle>Pinned Actions</StyledSectionTitle>
          <StyledItemsContainer>
            {pinnedEntries.map((entry) => (
              <MenuItemCommand
                key={entry.key}
                LeftIcon={entry.Icon}
                text={i18n._(entry.label)}
                onClick={() => entry.onClick?.()}
              />
            ))}
          </StyledItemsContainer>
        </>
      )}

      {nonPinnedEntries.length > 0 && (
        <>
          <StyledSectionTitle>Other Actions</StyledSectionTitle>
          <StyledItemsContainer>
            {nonPinnedEntries.map((entry) => (
              <MenuItemCommand
                key={entry.key}
                LeftIcon={entry.Icon}
                text={i18n._(entry.label)}
                onClick={() => entry.onClick?.()}
              />
            ))}
          </StyledItemsContainer>
        </>
      )}
    </StyledContainer>
  );
}; 
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { IconLayoutSidebarRightExpand } from 'twenty-ui';

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

const StyledSeparator = styled.div<{ size: 'sm' | 'md' }>`
  background: ${({ theme }) => theme.border.color.light};
  height: ${({ theme, size }) => theme.spacing(size === 'sm' ? 4 : 8)};
  margin: 0 ${({ theme }) => theme.spacing(1)};
  width: 1px;
`;

export const RecordIndexActionMenuBarAllActionsButton = () => {
  const theme = useTheme();
  const { openRightDrawer } = useRightDrawer();

  const handleClick = () => {
    openRightDrawer(RightDrawerPages.AllActions, {
      title: 'All Actions',
      Icon: IconLayoutSidebarRightExpand,
    });
  };

  return (
    <>
      <StyledSeparator size="md" />
      <StyledButton onClick={handleClick}>
        <IconLayoutSidebarRightExpand size={theme.icon.size.md} />
        <StyledButtonLabel>All Actions</StyledButtonLabel>
      </StyledButton>
    </>
  );
};

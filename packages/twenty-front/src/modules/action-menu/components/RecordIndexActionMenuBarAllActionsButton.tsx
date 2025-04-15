import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLocation } from 'react-router-dom';
import { getOsControlSymbol, IconLayoutSidebarRightExpand } from 'twenty-ui';

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

const StyledShortcutLabel = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.strong};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  padding: ${({ theme }) => theme.spacing(0, 1)};
`;

export const RecordIndexActionMenuBarAllActionsButton = () => {
  const theme = useTheme();
  const { openRightDrawer } = useRightDrawer();
  const { openRootCommandMenu } = useCommandMenu();
  const location = useLocation();

  const isJobPath = location.pathname.startsWith('/job/');

  const handleClick = () => {
    if (isJobPath) {
      openRightDrawer(RightDrawerPages.AllActions, {
        title: 'All Actions',
        Icon: IconLayoutSidebarRightExpand,
      });
    } else {
      openRootCommandMenu();
    }
  };

  return (
    <>
      <StyledSeparator size="md" />
      <StyledButton onClick={handleClick}>
        <IconLayoutSidebarRightExpand size={theme.icon.size.md} />
        <StyledButtonLabel>All Actions</StyledButtonLabel>
        {!isJobPath && (
          <>
            <StyledSeparator size="sm" />
            <StyledShortcutLabel>{getOsControlSymbol()}K</StyledShortcutLabel>
          </>
        )}
      </StyledButton>
    </>
  );
};

import { styled } from '@linaria/react';
import { type ReactNode } from 'react';
import { IconRefresh } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { TopBar } from '@/ui/layout/top-bar/components/TopBar';

const StyledProjectTopBar = styled(TopBar)`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;
`;

const StyledRightCluster = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.betweenSiblingsGap};
`;

type ProjectTopBarProps = {
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  showRefetch?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export const ProjectTopBar = ({
  leftComponent,
  rightComponent,
  showRefetch = true,
  onRefresh,
  isRefreshing = false,
}: ProjectTopBarProps) => {
  const refreshButton =
    showRefetch === true ? (
      <IconButton
        Icon={IconRefresh}
        variant="secondary"
        size="small"
        ariaLabel="Refresh"
        onClick={onRefresh}
        disabled={isRefreshing}
      />
    ) : null;

  return (
    <StyledProjectTopBar
      leftComponent={leftComponent}
      rightComponent={
        <StyledRightCluster>
          {refreshButton}
          {rightComponent}
        </StyledRightCluster>
      }
    />
  );
};

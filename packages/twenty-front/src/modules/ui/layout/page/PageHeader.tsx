import { ComponentProps, ReactNode } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';
import { IconChevronLeft, IconComponent, IconRefresh, MOBILE_VIEWPORT, OverflowingTextWithTooltip } from 'twenty-ui';
import { useParams } from 'react-router-dom';

import { IconButton } from '@/ui/input/button/components/IconButton';
import { UndecoratedLink } from '@/ui/navigation/link/components/UndecoratedLink';
import { NavigationDrawerCollapseButton } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerCollapseButton';
import { isNavigationDrawerOpenState } from '@/ui/navigation/states/isNavigationDrawerOpenState';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { Button } from '@/ui/input/button/components/Button';
import { useSetRecordValue } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useRecordTable } from '@/object-record/record-table/hooks/useRecordTable';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { ShowPageAddButton } from '../show-page/components/ShowPageAddButton';
import { ShowPageMoreButton } from '../show-page/components/ShowPageMoreButton';

export const PAGE_BAR_MIN_HEIGHT = 40;

const StyledTopBarContainer = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.noisy};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  flex-direction: row;
  font-size: ${({ theme }) => theme.font.size.lg};
  justify-content: space-between;
  min-height: ${PAGE_BAR_MIN_HEIGHT}px;
  padding: ${({ theme }) => theme.spacing(2)};
  padding-left: 0;
  padding-right: ${({ theme }) => theme.spacing(3)};
  z-index: 20;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding-left: ${({ theme }) => theme.spacing(3)};
  }
`;

const StyledLeftContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(1)};
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding-left: ${({ theme }) => theme.spacing(1)};
  }
`;

const StyledTitleContainer = styled.div`
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  margin-left: ${({ theme }) => theme.spacing(1)};
  max-width: 50%;
`;

const StyledTopBarIconStyledTitleContainer = styled.div`
  align-items: center;
  display: flex;
  flex: 1 0 auto;
  flex-direction: row;
`;

const StyledPageActionContainer = styled.div`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTopBarButtonContainer = styled.div`
  margin-left: ${({ theme }) => theme.spacing(1)};
  margin-right: ${({ theme }) => theme.spacing(1)};
`;

const StyledSkeletonLoader = () => {
  const theme = useTheme();
  return (
    <SkeletonTheme baseColor={theme.background.quaternary} highlightColor={theme.background.transparent.light} borderRadius={50}>
      <Skeleton height={24} width={108} />
    </SkeletonTheme>
  );
};

type PageHeaderProps = ComponentProps<'div'> & {
  title: string;
  hasBackButton?: boolean;
  Icon: IconComponent;
  children?: ReactNode;
  loading?: boolean;
  recordId?: string;
  isRecordTable?: boolean;
};

export const PageHeader = ({ title, hasBackButton, Icon, children, loading, recordId, isRecordTable = false }: PageHeaderProps) => {
  const isMobile = useIsMobile();
  const theme = useTheme();
  const isNavigationDrawerOpen = useRecoilValue(isNavigationDrawerOpenState);
  // const { setPendingRecordId } = useRecordTable({
  //   recordTableId: recordId,
  // });
  // const handleRefresh = () => {
  //   if (!recordId) return;
  // };
  console.log("this is use params", useParams());
  return (
    <StyledTopBarContainer>
      <StyledLeftContainer>
      {!isMobile && !isNavigationDrawerOpen && (
        <StyledTopBarButtonContainer>
        <NavigationDrawerCollapseButton direction="right" />
        </StyledTopBarButtonContainer>
      )}
      {hasBackButton && (
        <UndecoratedLink to={-1}>
        <IconButton Icon={IconChevronLeft} size="small" variant="tertiary" />
        </UndecoratedLink>
      )}
      {loading ? (
        <StyledSkeletonLoader />
      ) : (
        <StyledTopBarIconStyledTitleContainer>
        {Icon && <Icon size={theme.icon.size.md} />}
        <StyledTitleContainer data-testid="top-bar-title">
          <OverflowingTextWithTooltip text={title} />
        </StyledTitleContainer>

        {/* {isRecordTable && <Button Icon={IconRefresh} title="Refetch" variant="secondary" accent="default" onClick={handleRefresh} />} */}

        </StyledTopBarIconStyledTitleContainer>
      )}
      </StyledLeftContainer>
      <StyledPageActionContainer>{children}</StyledPageActionContainer>
      {isRecordTable && <ShowPageMoreButton key="more" recordId={recordId ?? '0'} objectNameSingular={useParams().objectNamePlural?.slice(0, -1) ?? 'candidate'} />}
    </StyledTopBarContainer>
  );
};

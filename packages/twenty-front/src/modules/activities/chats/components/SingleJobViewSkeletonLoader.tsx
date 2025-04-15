import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';

import { SKELETON_LOADER_HEIGHT_SIZES } from '@/activities/components/SkeletonLoader';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
`;

const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;
`;

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
`;

const StyledTopBar = styled(TopBar)`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledTabListContainer = styled.div`
  align-items: end;
  display: flex;
  height: 40px;
  padding: 0 16px;
`;

const StyledRightSection = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.betweenSiblingsGap};
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSkeletonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
  flex: 1;
`;

const StyledHeaderButtonLoader = () => {
  const theme = useTheme();
  return (
    <SkeletonTheme
      baseColor={theme.background.tertiary}
      highlightColor={theme.background.transparent.lighter}
      borderRadius={4}
    >
      <Skeleton
        width={100}
        height={SKELETON_LOADER_HEIGHT_SIZES.standard.l}
      />
    </SkeletonTheme>
  );
};

const StyledTopBarButtonLoader = () => {
  const theme = useTheme();
  return (
    <SkeletonTheme
      baseColor={theme.background.tertiary}
      highlightColor={theme.background.transparent.lighter}
      borderRadius={4}
    >
      <Skeleton
        width={80}
        height={SKELETON_LOADER_HEIGHT_SIZES.standard.m}
      />
    </SkeletonTheme>
  );
};

const StyledChatAreaLoader = () => {
  const theme = useTheme();
  const chatItems = Array.from({ length: 5 }).map((_, index) => ({
    id: `chat-item-${index}`,
  }));

  return (
    <SkeletonTheme
      baseColor={theme.background.tertiary}
      highlightColor={theme.background.transparent.lighter}
      borderRadius={4}
    >
      <StyledSkeletonContainer>
        {chatItems.map(({ id }) => (
          <Skeleton
            key={id}
            width="100%"
            height={SKELETON_LOADER_HEIGHT_SIZES.standard.xl}
          />
        ))}
      </StyledSkeletonContainer>
    </SkeletonTheme>
  );
};

export const SingleJobViewSkeletonLoader = () => {
  const theme = useTheme();

  return (
    <StyledPageContainer>
      <StyledPageHeader 
        title={
          <SkeletonTheme
            baseColor={theme.background.tertiary}
            highlightColor={theme.background.transparent.lighter}
            borderRadius={4}
          >
            <Skeleton
              width={200}
              height={SKELETON_LOADER_HEIGHT_SIZES.standard.m}
            />
          </SkeletonTheme>
        }
      >
        <StyledButtonsContainer>
          <StyledHeaderButtonLoader />
          <StyledHeaderButtonLoader />
          <StyledHeaderButtonLoader />
        </StyledButtonsContainer>
      </StyledPageHeader>
      <StyledPageBody>
        <StyledTopBar
          leftComponent={<StyledTabListContainer />}
          rightComponent={
            <StyledRightSection>
              <StyledTopBarButtonLoader />
              <StyledTopBarButtonLoader />
              <StyledTopBarButtonLoader />
            </StyledRightSection>
          }
        />
        <StyledChatAreaLoader />
      </StyledPageBody>
    </StyledPageContainer>
  );
}; 
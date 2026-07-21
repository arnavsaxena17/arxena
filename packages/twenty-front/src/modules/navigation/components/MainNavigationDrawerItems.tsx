import { IconBriefcase, IconVideo, IconLayout } from 'twenty-ui/icons';
import { IconSearch, IconSettings } from 'twenty-ui/icons';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { WorkspaceFavorites } from '@/favorites/components/WorkspaceFavorites';
import { JobsNavigationDrawerItems } from '@/navigation/components/JobsNavigationDrawerItems';
import { OrgChartsNavigationDrawerItems } from '@/navigation/components/OrgChartsNavigationDrawerItems';
import { NavigationDrawerOpenedSection } from '@/object-metadata/components/NavigationDrawerOpenedSection';
import { RemoteNavigationDrawerSection } from '@/object-metadata/components/RemoteNavigationDrawerSection';
import { AppPath } from '@/types/AppPath';
import { SettingsPath } from '@/types/SettingsPath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { IconMessage2 } from 'twenty-ui/icons';
import { getAppPath } from '~/utils/navigation/getAppPath';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

const StyledMainSection = styled(NavigationDrawerSection)`
  min-height: fit-content;
`;
const StyledInnerContainer = styled.div`
  height: 100%;
`;

export const MainNavigationDrawerItems = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );

  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );

  const { t } = useLingui();

  const { openRecordsSearchPage } = useCommandMenu();

  const isOrgChartEnabled = useRecoilValue(isOrgChartEnabledState);

  return (
    <>
      {!isMobile && (
        <StyledMainSection>
          <NavigationDrawerItem
            label={t`Search`}
            Icon={IconSearch}
            onClick={openRecordsSearchPage}
            keyboard={['/']}
          />
          {/* {!isOrgChartEnabled && ( */}
            <NavigationDrawerItem
              label={t`Assistant`}
              to={getAppPath(AppPath.Assistant)}
              onClick={() => {
                setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
                setIsNavigationDrawerExpanded(true);
                setNavigationMemorizedUrl(location.pathname + location.search);
              }}
              Icon={IconMessage2}
            />
          {/* )} */}
          <NavigationDrawerItem
            label={t`Settings`}
            to={getSettingsPath(SettingsPath.ProfilePage)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconSettings}
          />
          {/* <NavigationDrawerItem
            label={`Dashboard`}
            to={getAppPath(AppPath.Dashboard)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconBriefcase}
          /> */}
          {/* <NavigationDrawerItem
            label={`Client Candidate Search`}
            to={getAppPath(AppPath.ClientCandidateSearch)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconBriefcase}
          /> */}
          {/* <NavigationDrawerItem
            label={`Interview`}
            to={getAppPath(AppPath.Interview)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconVideo}
          />
          <NavigationDrawerItem
            label={`Custom Layout Candidate`}
            to={getAppPath(AppPath.CustomLayoutCandidate)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconLayout}
          />
          <NavigationDrawerItem
            label={`Custom Layout Job`}
            to={getAppPath(AppPath.CustomLayoutJob)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconLayout}
          /> */}
          {/* <NavigationDrawerItem
            label={`Custom Layout Merged`}
            to={getAppPath(AppPath.CustomLayoutMerged)}
            onClick={() => {
              setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
              setIsNavigationDrawerExpanded(true);
              setNavigationMemorizedUrl(location.pathname + location.search);
            }}
            Icon={IconLayout}
          /> */}
        </StyledMainSection>
      )}
      <ScrollWrapper
        contextProviderName="navigationDrawer"
        componentInstanceId={`scroll-wrapper-navigation-drawer`}
        defaultEnableXScroll={false}
        scrollbarVariant="no-padding"
      >
        <StyledInnerContainer>
          <JobsNavigationDrawerItems />
          <OrgChartsNavigationDrawerItems/>
          {/* {!isOrgChartEnabled && ( */}
            {/* <> */}
              <NavigationDrawerOpenedSection />
              <WorkspaceFavorites />
              <RemoteNavigationDrawerSection />
            {/* </>
          )} */}
        </StyledInnerContainer>
      </ScrollWrapper>
    </>
  );
};

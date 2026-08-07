import { useLocation, useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { IconLayoutDashboard, IconTargetArrow } from 'twenty-ui/icon';

import { useGtmCommandDashboardPath } from '@/gtm-home/hooks/useGtmCommandDashboardPath';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';

export const GtmHomeNavigationDrawerItem = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();
  const { dashboardPath } = useGtmCommandDashboardPath();

  // AppPath.GtmHome is relative (`gtm-home`); prefix `/` so Link is absolute.
  const shellPath = `/${getAppPath(AppPath.GtmHome)}`;
  const isShellActive =
    location.pathname === shellPath ||
    location.pathname.startsWith(`${shellPath}/`);
  const isDashboardActive =
    location.pathname === dashboardPath ||
    location.pathname.startsWith(`${dashboardPath}/`);

  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle label="GTM" />
      <NavigationDrawerItem
        label="GTM Command"
        to={shellPath}
        Icon={IconTargetArrow}
        active={isShellActive}
        onClick={() => {
          // useMouseDownNavigation skips navigate(to) when onClick is set
          navigate(shellPath);
          openAskAiPage({ resetNavigationStack: true });
        }}
      />
      <NavigationDrawerItem
        label="CRM dashboard"
        to={dashboardPath}
        Icon={IconLayoutDashboard}
        active={isDashboardActive}
      />
    </NavigationDrawerSection>
  );
};

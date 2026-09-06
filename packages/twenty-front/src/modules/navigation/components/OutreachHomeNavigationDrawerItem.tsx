import { useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { IconLayoutDashboard, IconTargetArrow } from 'twenty-ui/icon';

import { OutreachSafeDashboardPath } from '@/outreach-home/components/OutreachSafeDashboardPath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';

export const OutreachHomeNavigationDrawerItem = () => {
  return (
    <OutreachSafeDashboardPath>
      {(dashboardPath) => (
        <OutreachHomeNavigationDrawerItemView dashboardPath={dashboardPath} />
      )}
    </OutreachSafeDashboardPath>
  );
};

type OutreachHomeNavigationDrawerItemViewProps = {
  dashboardPath: string;
};

const OutreachHomeNavigationDrawerItemView = ({
  dashboardPath,
}: OutreachHomeNavigationDrawerItemViewProps) => {
  const location = useLocation();

  // AppPath.OutreachHome is relative (`outreach-home`); prefix `/` so Link is absolute.
  const shellPath = `/${getAppPath(AppPath.OutreachHome)}`;
  const isShellActive =
    location.pathname === shellPath ||
    location.pathname.startsWith(`${shellPath}/`);
  const isDashboardActive =
    location.pathname === dashboardPath ||
    location.pathname.startsWith(`${dashboardPath}/`);

  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle label="Outreach" />
      <NavigationDrawerItem
        label="Outreach"
        to={shellPath}
        Icon={IconTargetArrow}
        active={isShellActive}
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

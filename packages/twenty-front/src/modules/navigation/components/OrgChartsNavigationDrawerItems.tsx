import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';
import { IconHierarchy2 } from 'twenty-ui';

import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useOptionalObjectMetadataItem } from '@/object-metadata/hooks/useOptionalObjectMetadataItem';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { AppPath } from '@/types/AppPath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemGroup } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemGroup';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { getNavigationSubItemLeftAdornment } from '@/ui/navigation/navigation-drawer/utils/getNavigationSubItemLeftAdornment';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { useLingui } from '@lingui/react/macro';
import { getAppPath } from '~/utils/navigation/getAppPath';

type OrgChartNavRecord = ObjectRecord & {
  name?: string;
  externalCompanyId?: string | null;
  linkedinCompanyUrl?: string | null;
};

type OrgChartsNavigationDrawerItemsContentProps = {
  workspaceMemberId: string;
};

/**
 * Only mounted when `orgChart` exists in workspace metadata so `useFindManyRecords`
 * (which uses `useObjectMetadataItem` internally) does not throw.
 */
const OrgChartsNavigationDrawerItemsContent = ({
  workspaceMemberId,
}: OrgChartsNavigationDrawerItemsContentProps) => {
  const { t } = useLingui();
  const location = useLocation();
  const navigate = useNavigate();

  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );

  const { records } = useFindManyRecords<OrgChartNavRecord>({
    objectNameSingular: 'orgChart',
    filter: {
      recruiterId: {
        eq: workspaceMemberId,
      },
    },
    orderBy: [{ createdAt: 'DescNullsFirst' }],
    limit: 10,
  });

  const chartsForNav = useMemo(
    () =>
      records.filter(
        (r) =>
          typeof r.externalCompanyId === 'string' &&
          r.externalCompanyId.length > 0,
      ),
    [records],
  );

  const selectedCompanyIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/org-chart\/([^/]+)/);

    return match?.[1] ?? null;
  }, [location.pathname]);

  const allOrgChartsPath = `/${AppPath.OrgChart}`;
  const isAllOrgChartsRoute =
    location.pathname === allOrgChartsPath ||
    location.pathname === getAppPath(AppPath.OrgChart) ||
    location.pathname.startsWith(`${allOrgChartsPath}/`);
  const isAllOrgChartsActive =
    isAllOrgChartsRoute && selectedCompanyIdFromRoute === null;

  const selectedChartIndexInNav = useMemo(() => {
    if (selectedCompanyIdFromRoute === null) {
      return -1;
    }

    return chartsForNav.findIndex(
      (c) => c.externalCompanyId === selectedCompanyIdFromRoute,
    );
  }, [chartsForNav, selectedCompanyIdFromRoute]);

  const handleSectionInteraction = () => {
    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
  };

  const handleChartNavigate = (record: OrgChartNavRecord) => {
    handleSectionInteraction();
    const companyId = record.externalCompanyId ?? '';
    const label =
      typeof record.name === 'string' && record.name.length > 0
        ? record.name
        : companyId;

    navigate(`/${AppPath.OrgChart}/${companyId}`, {
      state: {
        company: {
          companyId,
          companyName: label,
          linkedinUrl: record.linkedinCompanyUrl ?? undefined,
        },
      },
    });
  };

  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle label={t`Org Charts`} />
      <NavigationDrawerItemGroup>
        <NavigationDrawerItem
          label={t`All org charts`}
          to={getAppPath(AppPath.OrgChart)}
          onClick={handleSectionInteraction}
          Icon={IconHierarchy2}
          active={isAllOrgChartsActive}
        />
        {chartsForNav.map((chart, index) => (
          <NavigationDrawerItem
            key={chart.id}
            label={
              typeof chart.name === 'string' && chart.name.length > 0
                ? chart.name
                : chart.externalCompanyId ?? 'Org chart'
            }
            onClick={() => handleChartNavigate(chart)}
            Icon={IconHierarchy2}
            active={chart.externalCompanyId === selectedCompanyIdFromRoute}
            subItemState={getNavigationSubItemLeftAdornment({
              arrayLength: chartsForNav.length,
              index,
              selectedIndex: selectedChartIndexInNav,
            })}
          />
        ))}
      </NavigationDrawerItemGroup>
    </NavigationDrawerSection>
  );
};

export const OrgChartsNavigationDrawerItems = () => {
  const isOrgChartEnabled = useRecoilValue(isOrgChartEnabledState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const { objectMetadataItem: orgChartMetadataItem } =
    useOptionalObjectMetadataItem({
      objectNameSingular: 'orgChart',
    });

  const workspaceMemberId = currentWorkspaceMember?.id;
  const canShowOrgChartsNav =
    isOrgChartEnabled &&
    isDefined(orgChartMetadataItem) &&
    isDefined(workspaceMemberId);

  if (!canShowOrgChartsNav) {
    return null;
  }

  return (
    <OrgChartsNavigationDrawerItemsContent
      workspaceMemberId={workspaceMemberId}
    />
  );
};

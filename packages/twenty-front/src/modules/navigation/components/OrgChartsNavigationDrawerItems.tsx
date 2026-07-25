import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { AppPath } from 'twenty-shared/types';
import { getLogoUrlFromDomainName, isDefined } from 'twenty-shared/utils';
import {
  IconHierarchy2,
  type TablerIconsProps,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { type Company } from '@/companies/types/Company';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { getCompanyDomainName } from '@/object-metadata/utils/getCompanyDomainName';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useOrgChartsRefetch } from '@/orgchart/hooks/useOrgChartsRefetch';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemGroup } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemGroup';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { getNavigationSubItemLeftAdornment } from '@/ui/navigation/navigation-drawer/utils/getNavigationSubItemLeftAdornment';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import {
  normalizeLinkedInUrl,
  reconstructLinkedInUrlForDisplay,
} from '~/utils/linkedinUrlUtils';

const StyledOrgChartNavCompanyLogo = styled.img`
  border-radius: ${themeCssVariables.border.radius.sm};
  object-fit: contain;
  background: ${themeCssVariables.background.tertiary};
  flex-shrink: 0;
`;

const getCompanyLinkedinPrimaryUrl = (record: ObjectRecord): string => {
  const link = record.linkedinLink as
    | { primaryLinkUrl?: string | null }
    | undefined;

  return typeof link?.primaryLinkUrl === 'string'
    ? link.primaryLinkUrl.trim()
    : '';
};

const toComparableLinkedinHref = (raw: string): string | null => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const candidates = [
    trimmed,
    normalizeLinkedInUrl(trimmed),
    reconstructLinkedInUrlForDisplay(trimmed),
  ];

  for (const candidate of candidates) {
    try {
      const withProtocol = /^https?:\/\//iu.test(candidate)
        ? candidate
        : `https://${candidate}`;

      return new URL(withProtocol).href.replace(/\/+$/u, '');
    } catch {
      continue;
    }
  }

  return null;
};

const linkedinUrlsReferToSameCompany = (first: string, second: string): boolean => {
  const firstHref = toComparableLinkedinHref(first);
  const secondHref = toComparableLinkedinHref(second);

  if (firstHref !== null && secondHref !== null) {
    return firstHref === secondHref;
  }

  return (
    normalizeLinkedInUrl(first).replace(/\/+$/u, '') ===
    normalizeLinkedInUrl(second).replace(/\/+$/u, '')
  );
};

// Matches persisted org chart title: `${companyName} — ${suffix}`
const extractCompanyLabelFromOrgChartName = (name?: string | null): string => {
  if (typeof name !== 'string') {
    return '';
  }

  return name.split(/\s*[—–-]\s*/u)[0]?.trim() ?? '';
};

const escapeIlikeMetacharacters = (value: string): string =>
  value
    .replace(/\\/gu, '\\\\')
    .replace(/%/gu, '\\%')
    .replace(/_/gu, '\\_');

type OrgChartNavRecord = ObjectRecord & {
  name?: string;
  externalCompanyId?: string | null;
  linkedinCompanyUrl?: string | null;
};

const companyMatchScoreForOrgChartNav = (
  chart: OrgChartNavRecord,
  company: ObjectRecord,
): number => {
  const chartLinkedin = chart.linkedinCompanyUrl?.trim() ?? '';
  const companyLinkedin = getCompanyLinkedinPrimaryUrl(company);

  if (
    chartLinkedin.length > 0 &&
    companyLinkedin.length > 0 &&
    linkedinUrlsReferToSameCompany(companyLinkedin, chartLinkedin)
  ) {
    return 4;
  }

  const label = extractCompanyLabelFromOrgChartName(chart.name).toLowerCase();
  const companyName =
    typeof company.name === 'string' ? company.name.trim().toLowerCase() : '';

  if (!label || !companyName) {
    return 0;
  }

  if (companyName === label) {
    return 3;
  }

  if (companyName.startsWith(label) || companyName.endsWith(label)) {
    return 2;
  }

  if (companyName.includes(label) || label.includes(companyName)) {
    return 1;
  }

  return 0;
};

type OrgChartNavCompanyLogoIconProps = TablerIconsProps & {
  src: string;
};

const OrgChartNavCompanyLogoIcon = ({
  src,
  ...props
}: OrgChartNavCompanyLogoIconProps) => {
  const sizePx = typeof props.size === 'number' ? props.size : 20;

  return (
    <StyledOrgChartNavCompanyLogo
      src={src}
      alt=""
      loading="lazy"
      width={sizePx}
      height={sizePx}
      style={{ minWidth: sizePx }}
    />
  );
};

type OrgChartsNavigationDrawerItemsContentProps = {
  workspaceMemberId: string;
};

// Only mounted when `orgChart` exists in workspace metadata
const OrgChartsNavigationDrawerItemsContent = ({
  workspaceMemberId,
}: OrgChartsNavigationDrawerItemsContentProps) => {
  const { t } = useLingui();
  const location = useLocation();
  const navigate = useNavigate();

  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useAtomState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetAtomState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetAtomState(
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

  const { refetchOrgCharts, orgChartsRefetchTrigger } = useOrgChartsRefetch();
  const refetchOrgChartsRef = useRef(refetchOrgCharts);
  refetchOrgChartsRef.current = refetchOrgCharts;

  useEffect(() => {
    if (orgChartsRefetchTrigger > 0) {
      refetchOrgChartsRef.current();
    }
  }, [orgChartsRefetchTrigger]);

  const chartsForNav = useMemo(
    () =>
      records.filter(
        (record) =>
          typeof record.externalCompanyId === 'string' &&
          record.externalCompanyId.length > 0,
      ),
    [records],
  );

  const companyLogoLookupFilter = useMemo(() => {
    const parts: Array<{ name: { ilike: string } }> = [];
    const seen = new Set<string>();

    for (const chart of chartsForNav) {
      const label = extractCompanyLabelFromOrgChartName(chart.name);

      if (!label) {
        continue;
      }

      const pattern = `%${escapeIlikeMetacharacters(label)}%`;

      if (seen.has(pattern)) {
        continue;
      }

      seen.add(pattern);
      parts.push({ name: { ilike: pattern } });
    }

    return parts.length > 0 ? { or: parts } : undefined;
  }, [chartsForNav]);

  const { records: companiesForNavLogos } = useFindManyRecords({
    objectNameSingular: 'company',
    filter: companyLogoLookupFilter,
    limit: 80,
    skip: companyLogoLookupFilter === undefined,
  });

  const logoUrlByOrgChartId = useMemo(() => {
    const map = new Map<string, string>();

    for (const chart of chartsForNav) {
      let bestCompany: ObjectRecord | undefined;
      let bestScore = 0;

      for (const company of companiesForNavLogos) {
        const score = companyMatchScoreForOrgChartNav(chart, company);

        if (score > bestScore) {
          bestScore = score;
          bestCompany = company;
        }
      }

      if (!bestCompany || bestScore < 1) {
        continue;
      }

      const domain = getCompanyDomainName(bestCompany as Company);
      const logo = getLogoUrlFromDomainName(domain ?? '');

      if (logo) {
        map.set(chart.id, logo);
      }
    }

    return map;
  }, [chartsForNav, companiesForNavLogos]);

  const selectedCompanyIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/org-chart\/([^/]+)/);

    return match?.[1] ?? null;
  }, [location.pathname]);

  const allOrgChartsPath = `/${AppPath.OrgChart}`;
  const isAllOrgChartsRoute =
    location.pathname === allOrgChartsPath ||
    location.pathname.startsWith(`${allOrgChartsPath}/`);
  const isAllOrgChartsActive =
    isAllOrgChartsRoute && selectedCompanyIdFromRoute === null;

  const selectedChartIndexInNav = useMemo(() => {
    if (selectedCompanyIdFromRoute === null) {
      return -1;
    }

    return chartsForNav.findIndex(
      (chart) => chart.externalCompanyId === selectedCompanyIdFromRoute,
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
    const labelFromName = extractCompanyLabelFromOrgChartName(record.name);
    const label =
      labelFromName.length > 0
        ? labelFromName
        : typeof record.name === 'string' && record.name.length > 0
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
          to={`/${AppPath.OrgChart}`}
          Icon={IconHierarchy2}
          active={isAllOrgChartsActive}
        />
        {chartsForNav.map((chart, index) => {
          const logoUrl = logoUrlByOrgChartId.get(chart.id);

          return (
            <NavigationDrawerItem
              key={chart.id}
              label={
                typeof chart.name === 'string' && chart.name.length > 0
                  ? chart.name
                  : (chart.externalCompanyId ?? 'Org chart')
              }
              onClick={() => handleChartNavigate(chart)}
              Icon={
                logoUrl
                  ? (iconProps: TablerIconsProps) => (
                      <OrgChartNavCompanyLogoIcon
                        {...iconProps}
                        src={logoUrl}
                      />
                    )
                  : IconHierarchy2
              }
              active={chart.externalCompanyId === selectedCompanyIdFromRoute}
              subItemState={getNavigationSubItemLeftAdornment({
                arrayLength: chartsForNav.length,
                index,
                selectedIndex: selectedChartIndexInNav,
              })}
            />
          );
        })}
      </NavigationDrawerItemGroup>
    </NavigationDrawerSection>
  );
};

export const OrgChartsNavigationDrawerItems = () => {
  const isOrgChartEnabled = useAtomStateValue(isOrgChartEnabledState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const { objectMetadataItems } = useObjectMetadataItems();
  const orgChartMetadataItem = objectMetadataItems.find(
    (item) => item.nameSingular === 'orgChart',
  );

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

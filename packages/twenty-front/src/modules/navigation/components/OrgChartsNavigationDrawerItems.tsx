import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';
import { IconHierarchy2, type TablerIconsProps } from 'twenty-ui';

import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { Company } from '@/companies/types/Company';
import { useOptionalObjectMetadataItem } from '@/object-metadata/hooks/useOptionalObjectMetadataItem';
import { getCompanyDomainName } from '@/object-metadata/utils/getCompanyDomainName';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useOrgChartsRefetch } from '@/orgchart/hooks/useOrgChartsRefetch';
import { AppPath } from '@/types/AppPath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemGroup } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemGroup';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { getNavigationSubItemLeftAdornment } from '@/ui/navigation/navigation-drawer/utils/getNavigationSubItemLeftAdornment';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { getLogoUrlFromDomainName } from '~/utils';
import {
  normalizeLinkedInUrl,
  reconstructLinkedInUrlForDisplay,
} from '~/utils/linkedinUrlUtils';
import { getAppPath } from '~/utils/navigation/getAppPath';

const StyledOrgChartNavCompanyLogo = styled.img`
  border-radius: ${({ theme }) => theme.border.radius.sm};
  object-fit: contain;
  background: ${({ theme }) => theme.background.tertiary};
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
  for (const c of candidates) {
    try {
      const withProto = /^https?:\/\//iu.test(c) ? c : `https://${c}`;
      return new URL(withProto).href.replace(/\/+$/u, '');
    } catch {
      continue;
    }
  }
  return null;
};

const linkedinUrlsReferToSameCompany = (a: string, b: string): boolean => {
  const ha = toComparableLinkedinHref(a);
  const hb = toComparableLinkedinHref(b);
  if (ha !== null && hb !== null) {
    return ha === hb;
  }
  return (
    normalizeLinkedInUrl(a).replace(/\/+$/u, '') ===
    normalizeLinkedInUrl(b).replace(/\/+$/u, '')
  );
};

/** Matches persisted org chart title: `${companyName} — ${suffix}` (see org-chart-record-workspace.service). */
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

const companyMatchScoreForOrgChartNav = (
  chart: OrgChartNavRecord,
  company: ObjectRecord,
): number => {
  const chartLi = chart.linkedinCompanyUrl?.trim() ?? '';
  const coLi = getCompanyLinkedinPrimaryUrl(company);
  if (
    chartLi.length > 0 &&
    coLi.length > 0 &&
    linkedinUrlsReferToSameCompany(coLi, chartLi)
  ) {
    return 4;
  }
  const label = extractCompanyLabelFromOrgChartName(chart.name).toLowerCase();
  const cname =
    typeof company.name === 'string' ? company.name.trim().toLowerCase() : '';
  if (!label || !cname) {
    return 0;
  }
  if (cname === label) {
    return 3;
  }
  if (cname.startsWith(label) || cname.endsWith(label)) {
    return 2;
  }
  if (cname.includes(label) || label.includes(cname)) {
    return 1;
  }
  return 0;
};

type OrgChartNavRecord = ObjectRecord & {
  name?: string;
  externalCompanyId?: string | null;
  linkedinCompanyUrl?: string | null;
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
        (r) =>
          typeof r.externalCompanyId === 'string' &&
          r.externalCompanyId.length > 0,
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
      let best: ObjectRecord | undefined;
      let bestScore = 0;
      for (const co of companiesForNavLogos) {
        const score = companyMatchScoreForOrgChartNav(chart, co);
        if (score > bestScore) {
          bestScore = score;
          best = co;
        }
      }
      if (!best || bestScore < 1) {
        continue;
      }
      const domain = getCompanyDomainName(best as Company);
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
          to={getAppPath(AppPath.OrgChart)}
          onClick={handleSectionInteraction}
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
                  : chart.externalCompanyId ?? 'Org chart'
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

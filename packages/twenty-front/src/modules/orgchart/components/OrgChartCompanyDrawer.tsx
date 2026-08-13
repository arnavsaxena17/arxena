import { Button, IconButton } from 'twenty-ui';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconX } from 'twenty-ui/icon';
import { IconBrandLinkedin, IconWorld } from 'twenty-ui/icon';
import { useEffect, useMemo, useState } from 'react';

import { RootStackingContextZIndices } from '@/ui/layout/constants/RootStackingContextZIndices';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isValidLinkedInProfileUrl, toTitleCase } from 'twenty-shared/utils';

import { getCompanyLogoAbbreviation } from '../utils/orgChartUtils';
import type { OrgChartCompanyInfoProps } from './OrgChartCompanyInfo';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledDrawerBackdrop = styled.div`
  animation: fadeIn 0.2s ease-out;
  background: rgba(15, 23, 42, 0.25);
  inset: 0;
  position: fixed;
  z-index: ${RootStackingContextZIndices.RootModalBackDrop};
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const StyledDrawer = styled.div`
  animation: slideIn 0.25s ease-out;
  background: ${themeCssVariables.background.primary};
  bottom: 0;
  box-shadow: -4px 0 24px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  position: fixed;
  right: 0;
  top: 0;
  width: min(420px, 100vw);
  z-index: ${RootStackingContextZIndices.RootModal};
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

const StyledDrawerHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledDrawerTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: 600;
  margin: 0;
`;

const StyledDrawerBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  overflow: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledCompanyHeader = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledCompanyLogo = styled.img`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.md};
  flex-shrink: 0;
  height: 64px;
  object-fit: contain;
  width: 64px;
`;

const StyledCompanyLogoPlaceholder = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-shrink: 0;
  font-size: 24px;
  font-weight: 600;
  height: 64px;
  justify-content: center;
  width: 64px;
`;

const StyledCompanyTitleBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledCompanyName = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 ${themeCssVariables.spacing[0.5]};
`;

const StyledTagline = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  margin: 0;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSectionTitle = styled.h4`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: 600;
  letter-spacing: 0.05em;
  margin: 0;
  text-transform: uppercase;
`;

const StyledSectionContent = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
`;

const StyledLinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledMetaGrid = styled.div`
  display: grid;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMetaRow = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledMetaLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
`;

const StyledMetaValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  text-align: right;
`;

const StyledActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTabsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTimelineTabList = styled(TabList)`
  border-bottom: none;
`;

const StyledWindowButton = styled(Button)`
  min-width: 48px;
`;

const StyledProfilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledProfileRow = styled.div`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[1]};
`;

const StyledProfileMain = styled.div`
  min-width: 0;
`;

const StyledProfileTitle = styled.div`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledProfileRight = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledProfileFunction = styled.div`
  color: ${themeCssVariables.font.color.primary};
`;

const StyledFunctionGroup = styled.details`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

const StyledFunctionSummary = styled.summary`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-weight: 500;
  justify-content: space-between;
  list-style: none;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1.5]};
  &::-webkit-details-marker {
    display: none;
  }
`;

const StyledFunctionGroupLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
`;

const StyledFunctionGroupCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledNewsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1.5]};
`;

const StyledNewsCard = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[1.5]};
`;

const StyledNewsSummary = styled.div`
  color: ${themeCssVariables.font.color.primary};
  line-height: 1.5;
`;

const StyledNewsMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledNewsLink = styled.a`
  color: ${themeCssVariables.color.blue};
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledNewsNotes = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
`;

const StyledTechCategory = styled.details`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1.5]};
`;

const StyledTechCategorySummary = styled.summary`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-weight: 600;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }
`;

const StyledTechList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledTechRow = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: ${themeCssVariables.spacing[1]};
`;

const StyledTechName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: 500;
`;

const StyledTechMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTechBadge = styled.span`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 ${themeCssVariables.spacing[1]};
`;

const StyledCacheSection = styled(StyledSection)`
  margin-top: auto;
`;

export type OrgChartCompanyDrawerProps = OrgChartCompanyInfoProps & {
  isOpen: boolean;
  onClose: () => void;
  onClearCompanyCache?: () => void;
  timelineMetrics?: Record<string, unknown> | null;
  timelineProfilesOptions?: {
    baseUrl: string;
    accessToken?: string;
    companyId: string;
    asOfMonth?: string;
    companyName?: string;
    sampleSource?: string;
    sampleProfiles?: string;
    includeOrgIntelligence?: string;
  };
};

type CompanyNewsItem = {
  summary: string;
  date: string;
  url: string;
  fetchedAt?: string;
};

type CompanyNewsStorageResult = {
  companyId: string;
  companyName: string;
  location?: string;
  updatedAt: string;
  fetches: Array<{
    fetchedAt: string;
    result: {
      company_name: string;
      location: string;
      news_items: CompanyNewsItem[];
      notes: string;
    };
  }>;
  mergedNewsItems?: CompanyNewsItem[];
};

type BuiltWithDetailedTechnology = {
  category: string;
  name: string;
  slug: string;
  trendCategory: string;
  firstDetected: string | null;
  lastDetected: string | null;
  isHistorical: boolean;
  dataTypes: string[];
};

type BuiltWithDomainResult = {
  domain: string;
  profileUrl: string;
  detailedUrl: string;
  title: string | null;
  meta: {
    liveTechnologiesCount: number | null;
    lastTechnologyDetected: string | null;
    siteAgeLabel: string | null;
    topSiteRank: number | null;
    aiIndex: { score: string | null; label: string | null };
    technologySpend: string | null;
  };
  detailedTechnologies: BuiltWithDetailedTechnology[];
  fetchedAt: string;
  errors: string[];
  message?: string;
};

type CompanyTechnologyStorageResult = {
  companyId: string;
  companyName: string;
  domain: string;
  updatedAt: string;
  fetches: Array<{
    fetchedAt: string;
    result: BuiltWithDomainResult;
  }>;
  latestResult?: BuiltWithDomainResult | null;
};

export const OrgChartCompanyDrawer = ({
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  employeeCount,
  linkedinDisplayName,
  description,
  tagline,
  logoUrl: logoUrlProp,
  hideProfileCountWhenUnipile,
  isOpen,
  onClose,
  onClearCompanyCache,
  timelineMetrics,
  timelineProfilesOptions,
}: OrgChartCompanyDrawerProps) => {
  const [logoError, setLogoError] = useState(false);
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken =
    timelineProfilesOptions?.accessToken ??
    tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const timelineTabListInstanceId = 'orgchart-company-drawer-timeline-tabs';
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    timelineTabListInstanceId,
  );
  const activeTab = (
    activeTabId ?? 'company'
  ) as 'company' | 'joined' | 'left' | 'current' | 'past' | 'news' | 'technology';
  const [activeWindow, setActiveWindow] = useState<'1m' | '3m' | '6m' | '1y'>(
    '1m',
  );
  const [timelineProfiles, setTimelineProfiles] = useState<Record<string, unknown> | null>(null);
  const [isTimelineProfilesLoading, setIsTimelineProfilesLoading] = useState(false);
  const [companyNews, setCompanyNews] = useState<CompanyNewsStorageResult | null>(null);
  const [isCompanyNewsLoading, setIsCompanyNewsLoading] = useState(false);
  const [isCompanyNewsFetching, setIsCompanyNewsFetching] = useState(false);
  const [companyNewsError, setCompanyNewsError] = useState<string | null>(null);
  const [companyTechnology, setCompanyTechnology] =
    useState<CompanyTechnologyStorageResult | null>(null);
  const [isTechnologyLoading, setIsTechnologyLoading] = useState(false);
  const [isTechnologyFetching, setIsTechnologyFetching] = useState(false);
  const [technologyError, setTechnologyError] = useState<string | null>(null);
  const [showHistoricalTechnologies, setShowHistoricalTechnologies] =
    useState(false);
  const getLogoUrl = (site?: string): string | null => {
    if (!site?.trim()) return null;
    const base = REACT_APP_SERVER_BASE_URL ?? '';
    if (!base) return null;
    return `${base.replace(/\/$/, '')}/org-chart/company-logo?website=${encodeURIComponent(
      site,
    )}`;
  };

  const getDisplayDomain = (site?: string): string | null => {
    if (!site?.trim()) return null;
    try {
      const withProtocol = site.startsWith('http') ? site : `https://${site}`;
      const { hostname } = new URL(withProtocol);
      return hostname.replace(/^www\./u, '');
    } catch {
      return site;
    }
  };

  const logoUrl = logoUrlProp?.trim() ? logoUrlProp : getLogoUrl(website);
  const websiteDomain = getDisplayDomain(website);
  const displayCompanyName = toTitleCase(companyName);
  const displayLocationName = toTitleCase(locationName);
  const displayIndustry = toTitleCase(industry);
  const linkedinLabel =
    toTitleCase(linkedinDisplayName) || displayCompanyName || 'LinkedIn';
  const websiteUrl = website
    ? website.startsWith('http')
      ? website
      : `https://${website}`
    : null;
  const logoAbbreviation = getCompanyLogoAbbreviation(
    website,
    displayCompanyName || companyName,
  );

  const shouldFetchProfiles =
    activeTab === 'joined' ||
    activeTab === 'left' ||
    activeTab === 'current' ||
    activeTab === 'past';

  const shouldLoadCompanyNews = activeTab === 'news';
  const shouldLoadCompanyTechnology = activeTab === 'technology';

  const formatDateTime = (value?: string): string => {
    if (!value?.trim()) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  useEffect(() => {
    if (!shouldLoadCompanyNews || !timelineProfilesOptions?.baseUrl?.trim()) {
      setCompanyNews(null);
      setCompanyNewsError(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsCompanyNewsLoading(true);
      setCompanyNewsError(null);
      try {
        const url = `${timelineProfilesOptions.baseUrl.replace(
          /\/$/,
          '',
        )}/org-chart/${encodeURIComponent(
          timelineProfilesOptions.companyId,
        )}/company-news`;
        const res = await fetch(url, {
          headers: {
            ...(timelineProfilesOptions.accessToken
              ? { Authorization: `Bearer ${timelineProfilesOptions.accessToken}` }
              : {}),
          },
        });
        const json = (await res.json()) as {
          result?: CompanyNewsStorageResult | null;
          message?: string;
        };
        if (!cancelled) {
          if (!res.ok) {
            setCompanyNews(null);
            setCompanyNewsError(json.message ?? 'Failed to load company news');
            return;
          }
          setCompanyNews(json.result ?? null);
        }
      } catch {
        if (!cancelled) {
          setCompanyNews(null);
          setCompanyNewsError('Failed to load company news');
        }
      } finally {
        if (!cancelled) setIsCompanyNewsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadCompanyNews, timelineProfilesOptions]);

  useEffect(() => {
    if (
      !shouldLoadCompanyTechnology ||
      !timelineProfilesOptions?.baseUrl?.trim()
    ) {
      setCompanyTechnology(null);
      setTechnologyError(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsTechnologyLoading(true);
      setTechnologyError(null);
      try {
        const url = `${timelineProfilesOptions.baseUrl.replace(
          /\/$/,
          '',
        )}/org-chart/${encodeURIComponent(
          timelineProfilesOptions.companyId,
        )}/company-technology`;
        const res = await fetch(url, {
          headers: {
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {}),
          },
        });
        const json = (await res.json()) as {
          result?: CompanyTechnologyStorageResult | null;
          message?: string;
        };
        if (!cancelled) {
          if (!res.ok) {
            setCompanyTechnology(null);
            setTechnologyError(
              json.message ?? 'Failed to load company technology',
            );
            return;
          }
          setCompanyTechnology(json.result ?? null);
        }
      } catch {
        if (!cancelled) {
          setCompanyTechnology(null);
          setTechnologyError('Failed to load company technology');
        }
      } finally {
        if (!cancelled) setIsTechnologyLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, shouldLoadCompanyTechnology, timelineProfilesOptions]);

  const handleFetchCompanyNews = async () => {
    if (!timelineProfilesOptions?.baseUrl?.trim()) return;

    setIsCompanyNewsFetching(true);
    setCompanyNewsError(null);
    try {
      const url = `${timelineProfilesOptions.baseUrl.replace(
        /\/$/,
        '',
      )}/org-chart/${encodeURIComponent(
        timelineProfilesOptions.companyId,
      )}/company-news/fetch`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(timelineProfilesOptions.accessToken
            ? { Authorization: `Bearer ${timelineProfilesOptions.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          companyName: displayCompanyName || companyName,
          location: displayLocationName || locationName,
        }),
      });
      const json = (await res.json()) as {
        result?: CompanyNewsStorageResult;
        message?: string;
      };
      if (!res.ok) {
        setCompanyNewsError(json.message ?? 'Failed to fetch company news');
        return;
      }
      setCompanyNews(json.result ?? null);
    } catch {
      setCompanyNewsError('Failed to fetch company news');
    } finally {
      setIsCompanyNewsFetching(false);
    }
  };

  const handleFetchTechnologyDetails = async () => {
    if (!timelineProfilesOptions?.baseUrl?.trim()) {
      setTechnologyError('Server URL is not configured.');
      return;
    }

    const domain = websiteDomain?.trim();
    if (!domain) {
      setTechnologyError(
        'No company website/domain available to look up technologies.',
      );
      return;
    }

    setIsTechnologyFetching(true);
    setTechnologyError(null);

    try {
      const url = `${timelineProfilesOptions.baseUrl.replace(
        /\/$/,
        '',
      )}/org-chart/${encodeURIComponent(
        timelineProfilesOptions.companyId,
      )}/company-technology/fetch`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          companyName: displayCompanyName || companyName,
          domain,
          website: website ?? domain,
        }),
      });
      const json = (await res.json()) as {
        result?: CompanyTechnologyStorageResult;
        message?: string | string[];
      };

      if (!res.ok) {
        const message = Array.isArray(json.message)
          ? json.message.join(', ')
          : json.message;
        setTechnologyError(message ?? 'Failed to fetch technology details');
        return;
      }

      setCompanyTechnology(json.result ?? null);
    } catch {
      setTechnologyError('Failed to fetch technology details');
    } finally {
      setIsTechnologyFetching(false);
    }
  };

  useEffect(() => {
    setCompanyTechnology(null);
    setTechnologyError(null);
    setShowHistoricalTechnologies(false);
  }, [websiteDomain, companyName, timelineProfilesOptions?.companyId]);

  const technologyResult = useMemo(() => {
    if (companyTechnology?.latestResult) {
      return companyTechnology.latestResult;
    }
    const latestFetch =
      companyTechnology?.fetches?.[companyTechnology.fetches.length - 1];
    return latestFetch?.result ?? null;
  }, [companyTechnology]);

  const technologyGroups = useMemo(() => {
    const technologies = technologyResult?.detailedTechnologies ?? [];
    const filtered = showHistoricalTechnologies
      ? technologies
      : technologies.filter((technology) => !technology.isHistorical);
    const groups = new Map<string, BuiltWithDetailedTechnology[]>();

    for (const technology of filtered) {
      const category = technology.category?.trim() || 'Other';
      const current = groups.get(category) ?? [];
      current.push(technology);
      groups.set(category, current);
    }

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items,
    }));
  }, [showHistoricalTechnologies, technologyResult]);

  const companyNewsItems = useMemo(() => {
    if (companyNews?.mergedNewsItems?.length) {
      return companyNews.mergedNewsItems;
    }
    const latestFetch = companyNews?.fetches?.[companyNews.fetches.length - 1];
    return latestFetch?.result.news_items ?? [];
  }, [companyNews]);

  const latestCompanyNewsNotes = useMemo(() => {
    const latestFetch = companyNews?.fetches?.[companyNews.fetches.length - 1];
    return latestFetch?.result.notes?.trim() ?? '';
  }, [companyNews]);

  useEffect(() => {
    if (!shouldFetchProfiles || !timelineProfilesOptions?.baseUrl?.trim()) {
      setTimelineProfiles(null);
      return;
    }
    const event =
      activeTab === 'joined' || activeTab === 'left' || activeTab === 'current' || activeTab === 'past'
        ? activeTab
        : 'current';
    let cancelled = false;
    const run = async () => {
      setIsTimelineProfilesLoading(true);
      try {
        const params = new URLSearchParams();
        if (timelineProfilesOptions.companyName?.trim()) {
          params.set('companyName', timelineProfilesOptions.companyName.trim());
        }
        if (timelineProfilesOptions.asOfMonth?.trim()) {
          params.set('asOfMonth', timelineProfilesOptions.asOfMonth.trim());
        }
        if (timelineProfilesOptions.sampleSource?.trim()) {
          params.set('sampleSource', timelineProfilesOptions.sampleSource.trim());
        }
        if (timelineProfilesOptions.sampleProfiles?.trim()) {
          params.set('sampleProfiles', timelineProfilesOptions.sampleProfiles.trim());
        }
        if (timelineProfilesOptions.includeOrgIntelligence?.trim()) {
          params.set(
            'includeOrgIntelligence',
            timelineProfilesOptions.includeOrgIntelligence.trim(),
          );
        }
        params.set('event', event);
        params.set('window', activeWindow);
        params.set('limit', '100');
        const url = `${timelineProfilesOptions.baseUrl.replace(
          /\/$/,
          '',
        )}/org-chart/${encodeURIComponent(
          timelineProfilesOptions.companyId,
        )}/timeline/profiles?${params.toString()}`;
        const res = await fetch(url, {
          headers: {
            ...(timelineProfilesOptions.accessToken
              ? { Authorization: `Bearer ${timelineProfilesOptions.accessToken}` }
              : {}),
          },
        });
        const json = (await res.json()) as {
          result?: Record<string, unknown>;
        };
        if (!cancelled) {
          setTimelineProfiles(res.ok ? json.result ?? null : null);
        }
      } catch {
        if (!cancelled) setTimelineProfiles(null);
      } finally {
        if (!cancelled) setIsTimelineProfilesLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, activeWindow, shouldFetchProfiles, timelineProfilesOptions]);

  const timelineProfilesRows = useMemo(() => {
    const rows = timelineProfiles?.profiles;
    return Array.isArray(rows) ? rows : [];
  }, [timelineProfiles]);

  const normalizeLinkedInUrl = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!isValidLinkedInProfileUrl(trimmed)) return null;
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  };

  const activeWindowMetrics = useMemo(() => {
    const windows = timelineMetrics?.windows as Record<string, unknown> | undefined;
    const slot =
      windows && typeof windows === 'object'
        ? (windows[activeWindow] as Record<string, unknown> | undefined)
        : undefined;
    const joined =
      slot?.joined && typeof slot.joined === 'object'
        ? (slot.joined as Record<string, unknown>).total
        : undefined;
    const left =
      slot?.left && typeof slot.left === 'object'
        ? (slot.left as Record<string, unknown>).total
        : undefined;
    return {
      joined: typeof joined === 'number' ? joined : '—',
      left: typeof left === 'number' ? left : '—',
    };
  }, [activeWindow, timelineMetrics]);

  const timelineMetricsByWindow = useMemo(() => {
    const windows = timelineMetrics?.windows as Record<string, unknown> | undefined;
    return (['1m', '3m', '6m', '1y'] as const).map((w) => {
      const slot =
        windows && typeof windows === 'object'
          ? (windows[w] as Record<string, unknown> | undefined)
          : undefined;
      const joined =
        slot?.joined && typeof slot.joined === 'object'
          ? (slot.joined as Record<string, unknown>).total
          : undefined;
      const left =
        slot?.left && typeof slot.left === 'object'
          ? (slot.left as Record<string, unknown>).total
          : undefined;
      const rates =
        slot?.rates && typeof slot.rates === 'object'
          ? (slot.rates as Record<string, unknown>)
          : undefined;
      const hiringRatePct =
        typeof rates?.hiringRatePct === 'number' ? rates.hiringRatePct : null;
      const attritionRatePct =
        typeof rates?.attritionRatePct === 'number' ? rates.attritionRatePct : null;
      return {
        window: w,
        joined: typeof joined === 'number' ? joined : '—',
        left: typeof left === 'number' ? left : '—',
        hiringRatePct:
          hiringRatePct === null ? '—' : `${hiringRatePct.toFixed(1)}%`,
        attritionRatePct:
          attritionRatePct === null ? '—' : `${attritionRatePct.toFixed(1)}%`,
      };
    });
  }, [timelineMetrics]);

  const groupedTimelineRows = useMemo(() => {
    const showGrouped = activeTab === 'joined' || activeTab === 'left';
    if (!showGrouped) return null;
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const row of timelineProfilesRows) {
      const item = row as Record<string, unknown>;
      const raw = String(item.functionRoot ?? 'unclassified');
      const root = toTitleCase(raw);
      const current = groups.get(root) ?? [];
      current.push(item);
      groups.set(root, current);
    }
    return Array.from(groups.entries())
      .map(([functionRoot, items]) => ({
        functionRoot,
        items: items.sort((a, b) =>
          String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')),
        ),
      }))
      .sort((a, b) => a.functionRoot.localeCompare(b.functionRoot));
  }, [activeTab, timelineProfilesRows]);

  if (!isOpen) return null;

  return (
    <>
      <StyledDrawerBackdrop onClick={onClose} aria-hidden="true" />
      <StyledDrawer role="dialog" aria-modal="true" aria-label="Company details">
        <StyledDrawerHeader>
          <StyledDrawerTitle>Company details</StyledDrawerTitle>
          <IconButton
            Icon={IconX}
            onClick={onClose}
            variant="tertiary"
            aria-label="Close company details"
          />
        </StyledDrawerHeader>
        <StyledDrawerBody>
          <StyledCompanyHeader>
            {logoUrl && !logoError ? (
              <StyledCompanyLogo
                src={logoUrl}
                alt=""
                loading="lazy"
                onError={() => setLogoError(true)}
              />
            ) : (
              <StyledCompanyLogoPlaceholder>
                {logoAbbreviation}
              </StyledCompanyLogoPlaceholder>
            )}
            <StyledCompanyTitleBlock>
              <StyledCompanyName>{displayCompanyName || 'Company'}</StyledCompanyName>
              {tagline?.trim() && (
                <StyledTagline>{tagline.trim()}</StyledTagline>
              )}
            </StyledCompanyTitleBlock>
          </StyledCompanyHeader>

          {(linkedinUrl || website) && (
            <StyledSection>
              <StyledSectionTitle>Links</StyledSectionTitle>
              <StyledLinkRow>
                {linkedinUrl && (
                  <Button
                    title={linkedinLabel}
                    variant="secondary"
                    size="small"
                    onClick={() => window.open(linkedinUrl, '_blank', 'noopener,noreferrer')}
                    ariaLabel="Open LinkedIn company page"
                  />
                )}
                {websiteUrl && (
                  <Button
                    title={websiteDomain || 'Website'}
                    variant="secondary"
                    size="small"
                    Icon={IconWorld}
                    onClick={() => window.open(websiteUrl, '_blank', 'noopener,noreferrer')}
                    ariaLabel="Open company website"
                  />
                )}
              </StyledLinkRow>
            </StyledSection>
          )}

          <StyledSection>
            <StyledSectionTitle>Overview</StyledSectionTitle>
            <StyledMetaGrid>
              {displayLocationName && (
                <StyledMetaRow>
                  <StyledMetaLabel>Location</StyledMetaLabel>
                  <StyledMetaValue>{displayLocationName}</StyledMetaValue>
                </StyledMetaRow>
              )}
              {displayIndustry && (
                <StyledMetaRow>
                  <StyledMetaLabel>Industry</StyledMetaLabel>
                  <StyledMetaValue>{displayIndustry}</StyledMetaValue>
                </StyledMetaRow>
              )}
              {typeof employeeCount === 'number' && (
                <StyledMetaRow>
                  <StyledMetaLabel>Employees</StyledMetaLabel>
                  <StyledMetaValue>
                    {employeeCount.toLocaleString()}
                  </StyledMetaValue>
                </StyledMetaRow>
              )}
              {typeof profileCount === 'number' && !hideProfileCountWhenUnipile && (
                <StyledMetaRow>
                  <StyledMetaLabel>Profiles</StyledMetaLabel>
                  <StyledMetaValue>
                    {profileCount.toLocaleString()}
                  </StyledMetaValue>
                </StyledMetaRow>
              )}
            </StyledMetaGrid>
          </StyledSection>

          <StyledSection>
            <StyledSectionTitle>Timeline</StyledSectionTitle>
            <StyledTimelineTabList
              componentInstanceId={timelineTabListInstanceId}
              behaveAsLinks={false}
              isInSidePanel
              tabs={[
                { id: 'company', title: 'Company info' },
                { id: 'news', title: 'News' },
                { id: 'technology', title: 'Technology' },
                { id: 'joined', title: 'Who joined' },
                { id: 'left', title: 'Who left' },
                { id: 'current', title: 'Current' },
                { id: 'past', title: 'Past' },
              ]}
            />
            {activeTab !== 'company' &&
              activeTab !== 'news' &&
              activeTab !== 'technology' && (
              <StyledTabsRow>
                {(['1m', '3m', '6m', '1y'] as const).map((w) => (
                  <StyledWindowButton
                    key={w}
                    title={w}
                    variant={activeWindow === w ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => setActiveWindow(w)}
                  />
                ))}
              </StyledTabsRow>
            )}
          </StyledSection>

          {timelineMetrics &&
            activeTab !== 'news' &&
            activeTab !== 'technology' && (            <StyledSection>
              <StyledSectionTitle>Timeline metrics</StyledSectionTitle>
              <StyledSectionContent>
                <StyledMetaGrid>
                  <StyledMetaRow>
                    <StyledMetaLabel>As of</StyledMetaLabel>
                    <StyledMetaValue>
                      {typeof timelineMetrics.asOfMonth === 'string'
                        ? timelineMetrics.asOfMonth
                        : '—'}
                    </StyledMetaValue>
                  </StyledMetaRow>
                  <StyledMetaRow>
                    <StyledMetaLabel>Headcount</StyledMetaLabel>
                    <StyledMetaValue>
                      {typeof timelineMetrics.headcount === 'number'
                        ? timelineMetrics.headcount
                        : '—'}
                    </StyledMetaValue>
                  </StyledMetaRow>
                  <StyledMetaRow>
                    <StyledMetaLabel>{activeWindow}</StyledMetaLabel>
                    <StyledMetaValue>
                      joined {activeWindowMetrics.joined} · left {activeWindowMetrics.left}
                    </StyledMetaValue>
                  </StyledMetaRow>
                  {/* {timelineMetricsByWindow.map((slot) => (
                    <StyledMetaRow key={slot.window}>
                      <StyledMetaLabel>{slot.window} rates</StyledMetaLabel>
                      <StyledMetaValue>
                        hiring {slot.hiringRatePct} · attrition {slot.attritionRatePct}
                      </StyledMetaValue>
                    </StyledMetaRow>
                  ))} */}
                </StyledMetaGrid>
              </StyledSectionContent>
            </StyledSection>
          )}

          {activeTab === 'news' && (
            <StyledSection>
              <StyledSectionTitle>Company news</StyledSectionTitle>
              <StyledActionsRow>
                <Button
                  title={
                    isCompanyNewsFetching
                      ? 'Fetching latest news…'
                      : 'Fetch latest news'
                  }
                  variant="primary"
                  size="small"
                  onClick={() => void handleFetchCompanyNews()}
                  disabled={
                    isCompanyNewsFetching ||
                    !timelineProfilesOptions?.baseUrl?.trim()
                  }
                />
              </StyledActionsRow>
              <StyledSectionContent>
                {companyNews?.updatedAt && (
                  <StyledMetaRow>
                    <StyledMetaLabel>Last updated</StyledMetaLabel>
                    <StyledMetaValue>
                      {formatDateTime(companyNews.updatedAt)}
                    </StyledMetaValue>
                  </StyledMetaRow>
                )}
                {isCompanyNewsLoading && <div>Loading saved news…</div>}
                {companyNewsError && <div>{companyNewsError}</div>}
                {!isCompanyNewsLoading &&
                  !companyNewsError &&
                  companyNewsItems.length === 0 && (
                    <div>
                      No saved news yet. Fetch the latest company news to store
                      it for this org chart.
                    </div>
                  )}
                {!isCompanyNewsLoading && companyNewsItems.length > 0 && (
                  <StyledNewsList>
                    {companyNewsItems.map((item, idx) => (
                      <StyledNewsCard key={`${item.url}-${idx}`}>
                        <StyledNewsSummary>{item.summary}</StyledNewsSummary>
                        <StyledNewsMeta>
                          <span>{item.date || 'unknown'}</span>
                          {item.fetchedAt && (
                            <span>Fetched {formatDateTime(item.fetchedAt)}</span>
                          )}
                        </StyledNewsMeta>
                        {item.url?.trim() && (
                          <StyledNewsLink
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.url}
                          </StyledNewsLink>
                        )}
                      </StyledNewsCard>
                    ))}
                  </StyledNewsList>
                )}
                {latestCompanyNewsNotes && (
                  <StyledNewsNotes>{latestCompanyNewsNotes}</StyledNewsNotes>
                )}
              </StyledSectionContent>
            </StyledSection>
          )}

          {activeTab === 'technology' && (
            <StyledSection>
              <StyledSectionTitle>Technology</StyledSectionTitle>
              <StyledActionsRow>
                <Button
                  title={
                    isTechnologyFetching
                      ? 'Fetching technology details…'
                      : 'Fetch technology details'
                  }
                  variant="primary"
                  size="small"
                  onClick={() => void handleFetchTechnologyDetails()}
                  disabled={
                    isTechnologyFetching ||
                    !websiteDomain?.trim() ||
                    !timelineProfilesOptions?.baseUrl?.trim()
                  }
                />
                {technologyResult && (
                  <Button
                    title={
                      showHistoricalTechnologies
                        ? 'Hide historical'
                        : 'Show historical'
                    }
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      setShowHistoricalTechnologies((current) => !current)
                    }
                  />
                )}
              </StyledActionsRow>
              <StyledSectionContent>
                {!websiteDomain?.trim() && (
                  <div>
                    Add a company website to look up BuiltWith technology
                    details.
                  </div>
                )}
                {companyTechnology?.updatedAt && (
                  <StyledMetaRow>
                    <StyledMetaLabel>Last updated</StyledMetaLabel>
                    <StyledMetaValue>
                      {formatDateTime(companyTechnology.updatedAt)}
                    </StyledMetaValue>
                  </StyledMetaRow>
                )}
                {isTechnologyLoading && <div>Loading saved technology…</div>}
                {technologyError && <div>{technologyError}</div>}
                {isTechnologyFetching && <div>Fetching technology stack…</div>}
                {technologyResult && (
                  <>
                    <StyledMetaGrid>
                      <StyledMetaRow>
                        <StyledMetaLabel>Domain</StyledMetaLabel>
                        <StyledMetaValue>
                          {technologyResult.domain}
                        </StyledMetaValue>
                      </StyledMetaRow>
                      {technologyResult.meta.technologySpend && (
                        <StyledMetaRow>
                          <StyledMetaLabel>Tech spend</StyledMetaLabel>
                          <StyledMetaValue>
                            {technologyResult.meta.technologySpend}
                          </StyledMetaValue>
                        </StyledMetaRow>
                      )}
                      <StyledMetaRow>
                        <StyledMetaLabel>Technologies</StyledMetaLabel>
                        <StyledMetaValue>
                          {
                            technologyResult.detailedTechnologies.filter(
                              (technology) => !technology.isHistorical,
                            ).length
                          }{' '}
                          live
                          {showHistoricalTechnologies
                            ? ` · ${
                                technologyResult.detailedTechnologies.filter(
                                  (technology) => technology.isHistorical,
                                ).length
                              } historical`
                            : ''}
                        </StyledMetaValue>
                      </StyledMetaRow>
                      {technologyResult.meta.aiIndex.score && (
                        <StyledMetaRow>
                          <StyledMetaLabel>AI index</StyledMetaLabel>
                          <StyledMetaValue>
                            {technologyResult.meta.aiIndex.score}
                            {technologyResult.meta.aiIndex.label
                              ? ` (${technologyResult.meta.aiIndex.label})`
                              : ''}
                          </StyledMetaValue>
                        </StyledMetaRow>
                      )}
                      <StyledMetaRow>
                        <StyledMetaLabel>Fetched</StyledMetaLabel>
                        <StyledMetaValue>
                          {formatDateTime(technologyResult.fetchedAt)}
                        </StyledMetaValue>
                      </StyledMetaRow>
                      {technologyResult.detailedUrl && (
                        <StyledMetaRow>
                          <StyledMetaLabel>Source</StyledMetaLabel>
                          <StyledMetaValue>
                            <StyledNewsLink
                              href={technologyResult.detailedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              BuiltWith detailed
                            </StyledNewsLink>
                          </StyledMetaValue>
                        </StyledMetaRow>
                      )}
                    </StyledMetaGrid>

                    {technologyGroups.length === 0 ? (
                      <div>No technologies found for this domain.</div>
                    ) : (
                      <StyledNewsList>
                        {technologyGroups.map((group, groupIndex) => (
                          <StyledTechCategory
                            key={group.category}
                            open={groupIndex < 3}
                          >
                            <StyledTechCategorySummary>
                              <span>{group.category}</span>
                              <StyledTechBadge>
                                {group.items.length}
                              </StyledTechBadge>
                            </StyledTechCategorySummary>
                            <StyledTechList>
                              {group.items.map((technology) => (
                                <StyledTechRow
                                  key={`${technology.category}-${technology.slug}-${technology.firstDetected}-${technology.lastDetected}`}
                                >
                                  <StyledTechName>
                                    {technology.name}
                                    {technology.isHistorical
                                      ? ' (historical)'
                                      : ''}
                                  </StyledTechName>
                                  <StyledTechMeta>
                                    {technology.firstDetected && (
                                      <span>
                                        First {technology.firstDetected}
                                      </span>
                                    )}
                                    {technology.lastDetected && (
                                      <span>
                                        Last {technology.lastDetected}
                                      </span>
                                    )}
                                    {technology.dataTypes
                                      .filter((dataType) => dataType !== 'hist')
                                      .slice(0, 3)
                                      .map((dataType) => (
                                        <StyledTechBadge key={dataType}>
                                          {dataType}
                                        </StyledTechBadge>
                                      ))}
                                  </StyledTechMeta>
                                </StyledTechRow>
                              ))}
                            </StyledTechList>
                          </StyledTechCategory>
                        ))}
                      </StyledNewsList>
                    )}
                  </>
                )}
                {!isTechnologyLoading &&
                  !isTechnologyFetching &&
                  !technologyResult &&
                  !technologyError &&
                  websiteDomain?.trim() && (
                    <div>
                      No saved technology yet. Fetch technology details for{' '}
                      {websiteDomain} from BuiltWith to store it for this org
                      chart.
                    </div>
                  )}
              </StyledSectionContent>
            </StyledSection>
          )}

          {shouldFetchProfiles && (
            <StyledSection>
              <StyledSectionTitle>
                {activeTab === 'joined'
                  ? 'Joined profiles'
                  : activeTab === 'left'
                    ? 'Left profiles'
                    : activeTab === 'current'
                      ? 'Current profiles'
                      : 'Past profiles'}
              </StyledSectionTitle>
              <StyledSectionContent>
                {isTimelineProfilesLoading && <div>Loading profiles…</div>}
                {!isTimelineProfilesLoading && timelineProfilesRows.length === 0 && (
                  <div>No profiles found for this selection.</div>
                )}
                {!isTimelineProfilesLoading && timelineProfilesRows.length > 0 && groupedTimelineRows && (
                  <StyledProfilesList>
                    {groupedTimelineRows.map((group, groupIdx) => (
                      <StyledFunctionGroup key={group.functionRoot} open={groupIdx === 0}>
                        <StyledFunctionSummary>
                          <StyledFunctionGroupLabel>{group.functionRoot}</StyledFunctionGroupLabel>
                          <StyledFunctionGroupCount>
                            {group.items.length}
                          </StyledFunctionGroupCount>
                        </StyledFunctionSummary>
                        <StyledProfilesList>
                          {group.items.map((item, idx) => {
                            const itemLinkedInUrl = normalizeLinkedInUrl(item.linkedinUrl);
                            return (
                              <StyledProfileRow key={`${String(item.id ?? idx)}`}>
                                <StyledProfileMain>
                                  <div>{String(item.fullName ?? 'Unknown')}</div>
                                  <StyledProfileTitle>
                                    {String(item.titleAtAsOf ?? '')}
                                    {item.eventMonth ? ` · ${String(item.eventMonth)}` : ''}
                                  </StyledProfileTitle>
                                </StyledProfileMain>
                                <StyledProfileRight>
                                  {itemLinkedInUrl && (
                                    <IconButton
                                      Icon={IconBrandLinkedin}
                                      onClick={() =>
                                        window.open(itemLinkedInUrl, '_blank', 'noopener,noreferrer')
                                      }
                                      variant="tertiary"
                                      size="small"
                                      aria-label={`Open ${String(item.fullName ?? 'profile')} on LinkedIn`}
                                    />
                                  )}
                                </StyledProfileRight>
                              </StyledProfileRow>
                            );
                          })}
                        </StyledProfilesList>
                      </StyledFunctionGroup>
                    ))}
                  </StyledProfilesList>
                )}
                {!isTimelineProfilesLoading && timelineProfilesRows.length > 0 && !groupedTimelineRows && (
                  <StyledProfilesList>
                    {timelineProfilesRows.map((row, idx) => {
                      const item = row as Record<string, unknown>;
                      const itemLinkedInUrl = normalizeLinkedInUrl(item.linkedinUrl);
                      return (
                        <StyledProfileRow key={`${String(item.id ?? idx)}`}>
                          <StyledProfileMain>
                            <div>{String(item.fullName ?? 'Unknown')}</div>
                            <StyledProfileTitle>
                              {String(item.titleAtAsOf ?? '')}
                              {item.eventMonth ? ` · ${String(item.eventMonth)}` : ''}
                            </StyledProfileTitle>
                          </StyledProfileMain>
                          <StyledProfileRight>
                            <StyledProfileFunction>
                              {toTitleCase(String(item.functionRoot ?? 'unclassified'))}
                            </StyledProfileFunction>
                            {itemLinkedInUrl && (
                              <IconButton
                                Icon={IconBrandLinkedin}
                                onClick={() =>
                                  window.open(itemLinkedInUrl, '_blank', 'noopener,noreferrer')
                                }
                                variant="tertiary"
                                size="small"
                                aria-label={`Open ${String(item.fullName ?? 'profile')} on LinkedIn`}
                              />
                            )}
                          </StyledProfileRight>
                        </StyledProfileRow>
                      );
                    })}
                  </StyledProfilesList>
                )}
              </StyledSectionContent>
            </StyledSection>
          )}

          {description?.trim() && activeTab === 'company' && (
            <StyledSection>
              <StyledSectionTitle>About</StyledSectionTitle>
              <StyledSectionContent
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {description.trim()}
              </StyledSectionContent>
            </StyledSection>
          )}

          {onClearCompanyCache && (
            <StyledCacheSection>
              <StyledSectionTitle>Cache</StyledSectionTitle>
              <StyledActionsRow>
                <Button
                  title="Clear cached org chart"
                  variant="secondary"
                  size="small"
                  onClick={onClearCompanyCache}
                />
              </StyledActionsRow>
            </StyledCacheSection>
          )}
        </StyledDrawerBody>
      </StyledDrawer>
    </>
  );
};

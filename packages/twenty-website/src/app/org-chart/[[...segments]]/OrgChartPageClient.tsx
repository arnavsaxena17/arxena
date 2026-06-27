'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';

import { useOrgChartDiagramReady } from '@/app/_components/cookie-consent/OrgChartDiagramReadyProvider';
import { useFreeTrialFlow } from '@/app/_components/free-trial/FreeTrialFlowProvider';
import { FreeTrialModal } from '@/app/_components/free-trial/FreeTrialModal';
import { useFreeTrialCta } from '@/app/_components/free-trial/useFreeTrialCta';
import { OrgChartCompanyInfo } from '@/app/_components/orgchart/OrgChartCompanyInfo';
import { OrgChartHiredFromRibbon } from '@/app/_components/orgchart/OrgChartHiredFromRibbon';
import { trackGA4Event } from '@/lib/analytics';
import { companySearchLightTheme } from '@/lib/company-search';
import { FREE_TRIAL_CTA_LABEL } from '@/lib/free-trial-flow';
import { trackWebsiteEvent } from '@/lib/mixpanel';
import {
    mergeOrgChartCompanyField,
    needsOrgChartCompanyInfoLookup,
    normalizeOptionalCompanyField,
} from '@/lib/org-chart-company-metadata';
import { processPublishedOrgChartPayload } from '@/lib/process-published-org-chart-payload';
// eslint-disable-next-line @nx/enforce-module-boundaries -- orgchart-core is used alongside dynamic OrgChartDiagram
import {
    OrgChartDiagramHandle,
    OrgChartFilters,
    OrgChartSearchControls,
    OrgChartSignUpModal,
    OrgChartTimelineSlider,
    useCompanyInfoLookup,
    useOrgChartFilterOptions,
} from 'twenty-orgchart/orgchart-core';
import { loadOrgChartDiagramComponent } from './loadOrgChartDiagram';

import {
    DEFAULT_ORG_CHART_GRADE_VISIBILITY,
    filterOrgChartNodeDataArray,
    hasMeaningfulOrgChartCountryFilter,
    hasMeaningfulOrgChartFunctionRootFilter,
    navigateToOrgChartSignup,
    OrgChartNodeData,
    toSlug,
    type OrgChartGradeTier,
    type OrgChartGradeVisibility,
} from 'twenty-shared';

const OrgChartDiagram = dynamic(() => loadOrgChartDiagramComponent(), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        minHeight: 400,
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  ),
});

type OrgChartPageClientProps = {
  children?: React.ReactNode;
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  nodeDataArray: OrgChartNodeData[];
  orgData: Record<string, unknown> | null;
  initialCountry?: string;
  initialFunctionRoot?: string;
  signUpUrl: string;
  breadcrumb?: React.ReactNode;
  /** When true (published /org/ pages), filter dropdowns slice the loaded chart in place instead of navigating to /org-chart/... */
  filterInPlace?: boolean;
  publishSlug?: string;
  initialAsOfMonth?: string;
};

const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  align-self: stretch;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledStructureWrapper = styled.div<{ $hidden: boolean }>`
  ${({ $hidden }) => $hidden && 'display: none;'}
`;

const StyledHeader = styled.header`
  container-type: inline-size;
  container-name: orgchart-header;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;

  @container orgchart-header (min-width: 721px) {
    padding: ${({ theme }) => theme.spacing(2)}
      ${({ theme }) => theme.spacing(4)};
  }
`;

const StyledOrgChartHeaderTopRow = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
  min-width: 0;

  @container orgchart-header (min-width: 721px) {
    align-items: flex-end;
    flex-wrap: wrap;
  }
`;

const StyledOrgChartHeaderCompany = styled.div`
  flex: 1 1 0;
  min-width: 0;
`;

const StyledOrgChartHeaderFilters = styled.div`
  flex: 0 1 min(210px, 46%);
  min-width: 0;
  max-width: min(210px, 48%);

  @container orgchart-header (min-width: 721px) {
    flex: 0 1 auto;
    max-width: none;
    margin-left: auto;
  }
`;

const StyledDiagramArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledDiagramBody = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
`;

const StyledPreviewPersistentBanner = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

const StyledPreviewBannerSignupLink = styled(Link)`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(0.75)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme }) => theme.color.blue};
  color: #ffffff;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    opacity: 0.92;
    color: #ffffff;
  }

  &:active {
    opacity: 0.85;
  }
`;

const StyledPreviewBannerSignupButton = styled.button`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(0.75)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme }) => theme.color.blue};
  color: #ffffff;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    opacity: 0.92;
    color: #ffffff;
  }

  &:active {
    opacity: 0.85;
  }
`;

const StyledSearchOverlay = styled.div`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

const StyledTopRightActionsOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  right: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};

  @media (max-width: 720px) {
    display: none;
  }
`;

const StyledTimelineOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  pointer-events: auto;

  @media (max-width: 720px) {
    left: ${({ theme }) => theme.spacing(2)};
    right: ${({ theme }) => theme.spacing(2)};
    transform: none;
    max-width: calc(100% - ${({ theme }) => theme.spacing(4)});
  }
`;

const StyledAsOfMonthPicker = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(0.75)}
    ${({ theme }) => theme.spacing(1)};
`;

const StyledTopRightActionButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover:enabled {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const StyledUnlockBanner = styled.div`
  margin: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  text-align: center;
`;

const StyledUnlockTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledUnlockText = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledUnlockButton = styled(Link)`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.font.color.primary};
  color: ${({ theme }) => theme.background.primary};
  text-decoration: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-weight: 500;
  font-size: ${({ theme }) => theme.font.size.sm};
  transition: color 0.15s ease;

  &:hover {
    color: #9e9e9e;
  }
`;

export const OrgChartPageClient = ({
  children,
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  nodeDataArray,
  orgData,
  initialCountry,
  initialFunctionRoot,
  signUpUrl,
  breadcrumb,
  filterInPlace = false,
  publishSlug,
  initialAsOfMonth,
}: OrgChartPageClientProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);
  const timelineEnabled = filterInPlace && !!publishSlug?.trim();
  const { markDiagramReady, markInteractiveOrgChartAbsent } =
    useOrgChartDiagramReady();

  const handleDiagramReady = useCallback(
    (handle: OrgChartDiagramHandle) => {
      diagramHandleRef.current = handle;
      setIsDiagramVisible(true);
      markDiagramReady();
    },
    [markDiagramReady],
  );

  const [isDiagramVisible, setIsDiagramVisible] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState<string | undefined>(
    initialCountry,
  );
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >(initialFunctionRoot);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(
    null,
  );
  const [gradeVisibility, setGradeVisibility] = useState<OrgChartGradeVisibility>(
    DEFAULT_ORG_CHART_GRADE_VISIBILITY,
  );
  const [clickedNode, setClickedNode] = useState<OrgChartNodeData | null>(null);
  const [exactEmployeeCount, setExactEmployeeCount] = useState<number | null>(
    null,
  );
  const [publishedNodeDataArray, setPublishedNodeDataArray] =
    useState(nodeDataArray);
  const [publishedOrgData, setPublishedOrgData] = useState(orgData);
  const [timelineMetrics, setTimelineMetrics] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isTimelineChartLoading, setIsTimelineChartLoading] = useState(false);

  const asOfFromUrl = useMemo(() => {
    const raw = searchParams.get('asOf')?.trim() ?? '';
    if (!raw || !monthKeyRegex.test(raw)) {
      return '';
    }
    return raw;
  }, [searchParams]);

  const [committedAsOfMonth, setCommittedAsOfMonth] = useState(() => {
    if (!filterInPlace || !publishSlug?.trim()) {
      return '';
    }
    const fromInitial = initialAsOfMonth?.trim() ?? '';
    if (fromInitial && monthKeyRegex.test(fromInitial)) {
      return fromInitial;
    }
    return asOfFromUrl;
  });

  useEffect(() => {
    if (!timelineEnabled) {
      return;
    }
    setCommittedAsOfMonth((previous) =>
      previous === asOfFromUrl ? previous : asOfFromUrl,
    );
  }, [timelineEnabled, asOfFromUrl]);

  const activeAsOfMonth = timelineEnabled ? committedAsOfMonth : '';

  const chartNodeDataArray = timelineEnabled
    ? publishedNodeDataArray
    : nodeDataArray;
  const chartOrgData = timelineEnabled ? publishedOrgData : orgData;

  const {
    availableCountries,
    availableFunctionRoots,
    countryPercentLabels,
    countryCounts,
    functionRootPercentLabels,
    functionRootCounts,
  } = useOrgChartFilterOptions(chartOrgData);

  const normalizeFilterCountry = useCallback((country?: string) => {
    if (!hasMeaningfulOrgChartCountryFilter(country)) {
      return undefined;
    }
    return country?.trim();
  }, []);

  const normalizeFilterFunctionRoot = useCallback((functionRoot?: string) => {
    if (!hasMeaningfulOrgChartFunctionRootFilter(functionRoot)) {
      return undefined;
    }
    return functionRoot?.trim();
  }, []);

  const displayedNodeDataArray = useMemo(() => {
    if (!filterInPlace) {
      return filterOrgChartNodeDataArray(chartNodeDataArray, {
        gradeVisibility,
      });
    }
    return filterOrgChartNodeDataArray(chartNodeDataArray, {
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      gradeVisibility,
    });
  }, [
    filterInPlace,
    chartNodeDataArray,
    selectedCountry,
    selectedFunctionRoot,
    gradeVisibility,
  ]);

  const handleGradeVisibilityChange = useCallback(
    (tier: OrgChartGradeTier, checked: boolean) => {
      setGradeVisibility((current) => ({ ...current, [tier]: checked }));
    },
    [],
  );

  useEffect(() => {
    if (!timelineEnabled) {
      return;
    }
    setPublishedNodeDataArray(nodeDataArray);
    setPublishedOrgData(orgData);
  }, [timelineEnabled, nodeDataArray, orgData]);

  useEffect(() => {
    if (!timelineEnabled || !publishSlug?.trim()) {
      setTimelineMetrics(null);
      return;
    }

    let cancelled = false;
    const fetchTimelineMetrics = async () => {
      try {
        const res = await fetch(
          `/api/org/${encodeURIComponent(publishSlug)}/timeline`,
        );
        const json = (await res.json()) as { result?: Record<string, unknown> };
        if (cancelled) {
          return;
        }
        if (res.ok && json.result) {
          setTimelineMetrics(json.result);
        } else {
          setTimelineMetrics(null);
        }
      } catch {
        if (!cancelled) {
          setTimelineMetrics(null);
        }
      }
    };

    void fetchTimelineMetrics();
    return () => {
      cancelled = true;
    };
  }, [timelineEnabled, publishSlug]);

  useEffect(() => {
    if (!timelineEnabled || !publishSlug?.trim()) {
      return;
    }

    const normalizedInitial = initialAsOfMonth?.trim() ?? '';
    if (activeAsOfMonth === normalizedInitial) {
      return;
    }

    let cancelled = false;
    const fetchPublishedChart = async () => {
      setIsTimelineChartLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeAsOfMonth) {
          params.set('asOfMonth', activeAsOfMonth);
        }
        const query = params.toString();
        const res = await fetch(
          `/api/org/${encodeURIComponent(publishSlug)}${query ? `?${query}` : ''}`,
        );
        const json = (await res.json()) as {
          status?: string;
          result?: Record<string, unknown>;
        };
        if (cancelled || json.status !== 'ok' || !json.result) {
          return;
        }
        const processed = processPublishedOrgChartPayload(
          json.result,
          '/api/org-chart',
        );
        setPublishedNodeDataArray(processed.nodeDataArray);
        setPublishedOrgData(
          processed.orgData as Record<string, unknown> | null,
        );
      } catch {
        if (!cancelled) {
          setPublishedNodeDataArray(nodeDataArray);
          setPublishedOrgData(orgData);
        }
      } finally {
        if (!cancelled) {
          setIsTimelineChartLoading(false);
        }
      }
    };

    void fetchPublishedChart();
    return () => {
      cancelled = true;
    };
  }, [
    timelineEnabled,
    publishSlug,
    activeAsOfMonth,
    initialAsOfMonth,
    nodeDataArray,
    orgData,
  ]);

  const handleAsOfMonthChange = useCallback(
    (nextMonth: string) => {
      if (!timelineEnabled || !publishSlug?.trim()) {
        return;
      }

      const trimmed = nextMonth.trim();
      const currentMonthKey = (() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      })();

      const committed = !trimmed || trimmed === currentMonthKey ? '' : trimmed;
      setCommittedAsOfMonth(committed);

      const params = new URLSearchParams(window.location.search);
      if (!committed) {
        params.delete('asOf');
      } else {
        params.set('asOf', committed);
      }

      const query = params.toString();
      const nextPath = `/org/${encodeURIComponent(publishSlug)}${query ? `?${query}` : ''}`;
      window.history.replaceState(null, '', nextPath);

      trackGA4Event('org_chart_timeline', {
        as_of_month: trimmed || 'current',
      });
      trackWebsiteEvent('org_chart_timeline', {
        asOfMonth: trimmed || 'current',
        publishSlug,
      });
    },
    [timelineEnabled, publishSlug],
  );

  const showTimelineSlider = timelineEnabled && timelineMetrics !== null;

  const { company: fallbackCompanyInfo, lookupByName } = useCompanyInfoLookup({
    baseUrl: '/api/org-chart',
    autocompletePath: '/autocomplete',
  });

  const ssrCompanyMetadata = useMemo(
    () => ({
      website: normalizeOptionalCompanyField(website),
      locationName: normalizeOptionalCompanyField(locationName),
      industry: normalizeOptionalCompanyField(industry),
      linkedinUrl: normalizeOptionalCompanyField(linkedinUrl),
    }),
    [website, locationName, industry, linkedinUrl],
  );

  const needsCompanyInfoLookup =
    needsOrgChartCompanyInfoLookup(ssrCompanyMetadata);

  // Fill missing header fields via public autocomplete (PDL proxy).
  useEffect(() => {
    if (!needsCompanyInfoLookup) {
      return;
    }
    const lookupKey = companyName?.trim() || companyId;
    if (lookupKey) {
      lookupByName(lookupKey);
    }
  }, [needsCompanyInfoLookup, lookupByName, companyName, companyId]);

  const displayWebsite = mergeOrgChartCompanyField(
    website,
    fallbackCompanyInfo?.website,
  );
  const displayLocationName = mergeOrgChartCompanyField(
    locationName,
    fallbackCompanyInfo?.locationName,
  );
  const displayIndustry = mergeOrgChartCompanyField(
    industry,
    fallbackCompanyInfo?.industry,
  );
  const displayProfileCount = profileCount ?? fallbackCompanyInfo?.profileCount;
  const displayLinkedinUrl = mergeOrgChartCompanyField(
    linkedinUrl,
    fallbackCompanyInfo?.linkedinUrl,
  );
  const displayEmployeeCount =
    exactEmployeeCount ?? fallbackCompanyInfo?.employeeCount;

  // Employee count uses Apify on the server when autocomplete did not provide it.
  useEffect(() => {
    if (typeof fallbackCompanyInfo?.employeeCount === 'number') {
      return;
    }

    const linkedinUrlToUse = displayLinkedinUrl;
    if (!linkedinUrlToUse && needsCompanyInfoLookup && !fallbackCompanyInfo) {
      return;
    }

    const identifier = linkedinUrlToUse ?? companyId;
    if (!identifier?.trim()) {
      return;
    }

    let cancelled = false;
    const fetchEmployeeCount = async () => {
      try {
        const params = new URLSearchParams();
        if (linkedinUrlToUse) {
          params.set('linkedinUrl', linkedinUrlToUse);
        } else {
          params.set('companyId', companyId);
        }
        const res = await fetch(
          `/api/org-chart/companies/employee-count?${params.toString()}`,
        );
        if (cancelled) {
          return;
        }
        const data = (await res.json()) as { employeeCount?: number | null };
        if (res.ok && typeof data.employeeCount === 'number') {
          setExactEmployeeCount(data.employeeCount);
        }
      } catch {
        if (!cancelled) {
          setExactEmployeeCount(null);
        }
      }
    };
    fetchEmployeeCount();
    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    displayLinkedinUrl,
    fallbackCompanyInfo,
    needsCompanyInfoLookup,
  ]);

  const buildPath = useCallback(
    (country?: string, fn?: string) => {
      let path = `/org-chart/${encodeURIComponent(companyId)}`;
      if (country && country !== 'global') {
        path += `/${toSlug(country)}`;
      }
      if (fn && fn !== 'fullcompany') {
        if (!country || country === 'global') {
          path += '/global';
        }
        path += `/${toSlug(fn)}`;
      }
      return path;
    },
    [companyId],
  );

  const handleCountryChange = useCallback(
    (country: string | undefined) => {
      const normalizedCountry = normalizeFilterCountry(country);
      trackGA4Event('org_chart_filter', {
        filter_type: 'country',
        value: normalizedCountry ?? country,
      });
      trackWebsiteEvent('org_chart_filter', {
        filterType: 'country',
        value: normalizedCountry ?? country,
      });
      setSelectedCountry(normalizedCountry);
      if (!filterInPlace) {
        router.push(buildPath(normalizedCountry, selectedFunctionRoot));
      }
    },
    [
      router,
      buildPath,
      selectedFunctionRoot,
      filterInPlace,
      normalizeFilterCountry,
    ],
  );

  const handleFunctionRootChange = useCallback(
    (fn: string | undefined) => {
      const normalizedFunctionRoot = normalizeFilterFunctionRoot(fn);
      trackGA4Event('org_chart_filter', {
        filter_type: 'function_root',
        value: normalizedFunctionRoot ?? fn,
      });
      trackWebsiteEvent('org_chart_filter', {
        filterType: 'functionRoot',
        value: normalizedFunctionRoot ?? fn,
      });
      setSelectedFunctionRoot(normalizedFunctionRoot);
      if (!filterInPlace) {
        router.push(buildPath(selectedCountry, normalizedFunctionRoot));
      }
    },
    [
      router,
      buildPath,
      selectedCountry,
      filterInPlace,
      normalizeFilterFunctionRoot,
    ],
  );

  const handleSearch = useCallback(() => {
    trackGA4Event('org_chart_search_person', { query: searchTerm });
    trackWebsiteEvent('org_chart_search_person', { query: searchTerm });
    const count = diagramHandleRef.current?.search(searchTerm) ?? 0;
    setSearchResultCount(count);
  }, [searchTerm]);

  const handleClearSearch = useCallback(() => {
    diagramHandleRef.current?.clearSearch();
    setSearchResultCount(null);
  }, []);

  const handleNodeClick = useCallback((node: OrgChartNodeData) => {
    trackGA4Event('sign_up_cta_click', { source: 'modal' });
    trackWebsiteEvent('sign_up_cta_click', { source: 'modal' });
    setClickedNode(node);
  }, []);

  const handleCloseSignUpModal = useCallback(() => {
    setClickedNode(null);
  }, []);

  const hasFilters = !!chartOrgData;

  const handleOrgChartSignUpNavigate = useCallback(
    (event?: { preventDefault: () => void }) => {
      event?.preventDefault();
      navigateToOrgChartSignup(signUpUrl, {
        companyName,
        selectedCountry,
        selectedFunctionRoot,
      });
    },
    [signUpUrl, companyName, selectedCountry, selectedFunctionRoot],
  );

  const orgChartContext = useMemo(
    () => ({
      companyName,
      selectedCountry,
      selectedFunctionRoot,
    }),
    [companyName, selectedCountry, selectedFunctionRoot],
  );

  const { isFreeTrialFlow } = useFreeTrialFlow();

  const { onCtaClick: onBannerFreeTrialClick } = useFreeTrialCta({
    source: 'org_chart_banner',
    orgChartContext,
    legacyMixpanelEvent: 'sign_up_click',
    legacyGa4Event: 'sign_up_click',
    legacyGa4Props: { source: 'org_chart_banner' },
  });

  const nodeModalOrgChartContext = useMemo(
    () => ({
      ...orgChartContext,
      nodeHeadline: clickedNode?.headline,
    }),
    [clickedNode?.headline, orgChartContext],
  );

  useEffect(() => {
    trackGA4Event('org_chart_view', {
      company_id: companyId,
      company_name: companyName,
      country: initialCountry,
      function_root: initialFunctionRoot,
    });
    trackWebsiteEvent('org_chart_view', {
      companyId,
      companyName,
      country: initialCountry,
      functionRoot: initialFunctionRoot,
      nodeCount: nodeDataArray.length,
    });
  }, [
    companyId,
    companyName,
    initialCountry,
    initialFunctionRoot,
    nodeDataArray.length,
  ]);

  const filtersProps = {
    availableCountries,
    countryPercentLabels,
    countryCounts,
    selectedCountry,
    onCountryChange: handleCountryChange,
    availableFunctionRoots,
    functionRootPercentLabels,
    functionRootCounts,
    selectedFunctionRoot,
    onFunctionRootChange: handleFunctionRootChange,
    omitMarginLeft: true,
  };

  const searchControlsProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    searchResultCount,
    onSearch: handleSearch,
    onClearSearch: handleClearSearch,
    diagramHandleRef: diagramHandleRef,
    gradeVisibility,
    onGradeVisibilityChange: handleGradeVisibilityChange,
    onGetAll: () => {},
    onGetLeaders: () => {},
    onViewAllCandidates: () => {},
  };

  const hasPreviewOrgChartNodes = useMemo(
    () =>
      displayedNodeDataArray.some(
        (node: OrgChartNodeData) => node.nodeState === 'preview',
      ),
    [displayedNodeDataArray],
  );

  const showFilteredEmptyState =
    filterInPlace &&
    chartNodeDataArray.length > 0 &&
    displayedNodeDataArray.length === 0 &&
    !isTimelineChartLoading;

  const showPreviewPersistentBanner =
    hasPreviewOrgChartNodes && displayedNodeDataArray.length > 0;

  const showNodeCapabilitiesHoverHint =
    process.env.NEXT_PUBLIC_EXPERIMENTAL_ORGCHART_NODE_HOVER_HINTS === 'true';

  useEffect(() => {
    if (isTimelineChartLoading) {
      return;
    }

    if (displayedNodeDataArray.length === 0) {
      markInteractiveOrgChartAbsent();
    }
  }, [
    displayedNodeDataArray.length,
    isTimelineChartLoading,
    markInteractiveOrgChartAbsent,
  ]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <ThemeProvider theme={companySearchLightTheme}>
        <StyledContainer>
          {breadcrumb && (
            <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
              {breadcrumb}
            </div>
          )}
          <StyledHeader>
            <StyledOrgChartHeaderTopRow>
              <StyledOrgChartHeaderCompany>
                <OrgChartCompanyInfo
                  companyName={companyName}
                  website={displayWebsite}
                  locationName={displayLocationName}
                  industry={displayIndustry}
                  profileCount={displayProfileCount}
                  linkedinUrl={displayLinkedinUrl}
                  employeeCount={displayEmployeeCount}
                  logoBaseUrl="/api/org-chart"
                />
              </StyledOrgChartHeaderCompany>
              {hasFilters && (
                <StyledOrgChartHeaderFilters>
                  <OrgChartFilters {...filtersProps} />
                </StyledOrgChartHeaderFilters>
              )}
            </StyledOrgChartHeaderTopRow>
          </StyledHeader>

          <StyledDiagramArea>
            {showPreviewPersistentBanner && (
              <StyledPreviewPersistentBanner>
                <span>Get access to 10M Real Time Org Charts, Sign up</span>
                {isFreeTrialFlow ? (
                  <StyledPreviewBannerSignupButton
                    type="button"
                    onClick={onBannerFreeTrialClick}
                  >
                    {FREE_TRIAL_CTA_LABEL}
                  </StyledPreviewBannerSignupButton>
                ) : (
                  <StyledPreviewBannerSignupLink
                    href={signUpUrl}
                    onClick={handleOrgChartSignUpNavigate}
                  >
                    Sign up free
                  </StyledPreviewBannerSignupLink>
                )}
              </StyledPreviewPersistentBanner>
            )}
            <StyledDiagramBody>
              {showFilteredEmptyState && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    padding: 24,
                    textAlign: 'center',
                    color: '#666',
                  }}
                >
                  No people match this country and function filter. Try another
                  selection.
                </div>
              )}
              {showTimelineSlider && (
                <StyledTimelineOverlay>
                  <StyledAsOfMonthPicker>
                    <OrgChartTimelineSlider
                      asOfMonth={activeAsOfMonth || undefined}
                      onAsOfMonthChange={handleAsOfMonthChange}
                      nodeDataArray={chartNodeDataArray}
                      timelineMetrics={
                        (timelineMetrics as {
                          startMonth?: unknown;
                          startMonthYear?: unknown;
                        } | null) ?? null
                      }
                    />
                  </StyledAsOfMonthPicker>
                </StyledTimelineOverlay>
              )}
              {isTimelineChartLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.72)',
                    zIndex: 15,
                    fontSize: 14,
                    color: '#666',
                  }}
                >
                  Updating org chart…
                </div>
              )}
              {displayedNodeDataArray.length > 0 && (
                <>
                  <OrgChartDiagram
                    onDiagramReady={handleDiagramReady}
                    nodeDataArray={displayedNodeDataArray}
                    onNodeClick={handleNodeClick}
                    showNodeCapabilitiesHoverHint={
                      showNodeCapabilitiesHoverHint
                    }
                    nodeCapabilitiesHoverCompanyName={companyName}
                    defaultAvatarUrl="/img/default-avatar.jpg"
                    iconUrls={{
                      lock: '/img/lock.png',
                      linkedin: '/img/linkedin-icon-png-circle-2.png',
                      download: '/img/download-icon.png',
                      similarItems: '/img/similar-items.png',
                    }}
                  />
                  <StyledTopRightActionsOverlay>
                    <StyledTopRightActionButton
                      type="button"
                      onClick={() => diagramHandleRef.current?.zoomToFit()}
                    >
                      Zoom to fit
                    </StyledTopRightActionButton>
                    <StyledTopRightActionButton
                      type="button"
                      onClick={() => diagramHandleRef.current?.centerContent()}
                    >
                      Center
                    </StyledTopRightActionButton>
                  </StyledTopRightActionsOverlay>
                  <StyledSearchOverlay>
                    <OrgChartSearchControls {...searchControlsProps} />
                  </StyledSearchOverlay>
                </>
              )}
              {clickedNode && isFreeTrialFlow && (
                <FreeTrialModal
                  isOpen
                  source="org_chart_node_modal"
                  orgChartContext={nodeModalOrgChartContext}
                  intro={{
                    node: clickedNode,
                    companyName,
                    selectedCountry,
                    selectedFunctionRoot,
                  }}
                  onClose={handleCloseSignUpModal}
                />
              )}
              {clickedNode && !isFreeTrialFlow && (
                <OrgChartSignUpModal
                  node={clickedNode}
                  onClose={handleCloseSignUpModal}
                  signUpUrl={signUpUrl}
                  onSignUpClick={handleOrgChartSignUpNavigate}
                  companyName={companyName}
                  selectedCountry={selectedCountry}
                  selectedFunctionRoot={selectedFunctionRoot}
                />
              )}
            </StyledDiagramBody>
          </StyledDiagramArea>

          <OrgChartHiredFromRibbon companyId={companyId} />

          {/* <StyledUnlockBanner>
          <StyledUnlockTitle>Unlock {companyName} Org Chart</StyledUnlockTitle>
          <StyledUnlockText>
            See all names, titles, emails & phone numbers. Your first org chart
            is free. No credit card required.
          </StyledUnlockText>
          <StyledUnlockButton href={signUpUrl}>
            Continue with LinkedIn / Google / Email
          </StyledUnlockButton>
        </StyledUnlockBanner> */}
          {children && (
            <StyledStructureWrapper
              $hidden={isDiagramVisible}
              aria-hidden={isDiagramVisible}
            >
              {children}
            </StyledStructureWrapper>
          )}
        </StyledContainer>
      </ThemeProvider>
    </div>
  );
};

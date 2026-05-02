import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useDebouncedCallback } from 'use-debounce';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';
import { orgChartContactsByKeyState } from '@/orgchart/states/orgChartContactsByKeyState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { orgChartSelectedCompanyInfoState } from '@/orgchart/states/orgChartSelectedCompanyInfoState';
import { AppPath } from '@/types/AppPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
import {
    OrgChartDiagramHandle,
    normalizeCompanyIdForUrl,
    useCompanyInfoLookup,
    useOrgChartData,
    useOrgChartFilterOptions,
} from 'twenty-orgchart';
import { OrgChartNodeData, extractOrgData, toTitleCase } from 'twenty-shared';

import { OrgChartShareModal } from '../components/OrgChartShareModal';
import { useJobOrgChartData } from '../hooks/useJobOrgChartData';
import { useOrgChartActions } from '../hooks/useOrgChartActions';
import {
    StyledOrgChartConfirmDd,
    StyledOrgChartConfirmDt,
    StyledOrgChartConfirmIntro,
    StyledOrgChartConfirmRow,
    StyledOrgChartConfirmRows,
    StyledOrgChartConfirmSummary,
} from './ArxOrgChart.styles';
import { ArxOrgChartView } from './ArxOrgChartView';
import { useOrgChartBanners } from './hooks/useOrgChartBanners';
import { useOrgChartNodeDataArray } from './hooks/useOrgChartNodeDataArray';
import { hydrateContactsByKeyFromOrgData } from './utils/contactCacheHydration';

export type ArxOrgChartContainerProps = {
  companyId: string;
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  companyDomain?: string;
  onBack?: () => void;
  jobId?: string;
};

const ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR =
  'Contact Support. Org chart agent service is not available. Ensure the Python service is running and reachable.';

const leadershipOrgChartPythonFailureMessage = (detail: string) =>
  `Could not create the Leadership Org Chart because the org chart agent (Python service) failed. ${detail}`;

const DEFAULT_ORG_CHART_COUNTRY = 'global';
const DEFAULT_ORG_CHART_FUNCTION_ROOT = 'fullcompany';
const APOLLO_QUEUE_POLL_INTERVAL_MS = 5000;
const APOLLO_QUEUE_MAX_ATTEMPTS = 24;

const MULTI_SOURCE_SLUGS = [
  'unipile',
  'apollo',
  'theorg',
  'officialboard',
] as const;
type MultiSourceSlug = (typeof MULTI_SOURCE_SLUGS)[number];

const normalizeMultiSourceSlug = (raw: string): MultiSourceSlug | null => {
  const input = raw.trim();
  const lowered = input.toLowerCase();

  // Accept already-normalized slugs.
  if ((MULTI_SOURCE_SLUGS as readonly string[]).includes(lowered)) {
    return lowered as MultiSourceSlug;
  }

  // Defensive mapping in case UI ever passes display labels.
  const mapped =
    lowered === 'linkedin (unipile)' || lowered === 'linkedin unipile'
      ? 'unipile'
      : lowered === 'apollo'
        ? 'apollo'
        : lowered === 'theorg leadership' ||
            lowered === 'the org leadership' ||
            lowered === 'theorg'
          ? 'theorg'
          : lowered === 'officialboard' || lowered === 'official board'
            ? 'officialboard'
            : null;

  return mapped as MultiSourceSlug | null;
};

export const ArxOrgChartContainer = ({
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  companyDomain,
  onBack,
  jobId,
}: ArxOrgChartContainerProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyDomainFromQuery =
    searchParams.get('companyDomain')?.trim() || undefined;
  const websiteFromQuery = searchParams.get('website')?.trim() || undefined;
  const companyNameFromQuery =
    searchParams.get('companyName')?.trim() || undefined;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showApolloFallbackModal, setShowApolloFallbackModal] = useState(false);
  const [apolloQueuePollAttempts, setApolloQueuePollAttempts] = useState(0);
  const [apolloQueuePollingTimedOut, setApolloQueuePollingTimedOut] =
    useState(false);
  const [timelineMetrics, setTimelineMetrics] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(
    null,
  );
  const [businessDivisionQuery, setBusinessDivisionQuery] = useState('');
  const [isEnrichedLeadershipLoading, setIsEnrichedLeadershipLoading] =
    useState(false);
  const [multiSourceSelectedSources, setMultiSourceSelectedSources] = useState<
    string[]
  >(['apollo', 'theorg']);
  const [exactEmployeeCount, setExactEmployeeCount] = useState<number | null>(
    null,
  );
  const [unipileCompanyProfile, setUnipileCompanyProfile] = useState<{
    employee_count?: number;
    description?: string;
    tagline?: string;
    logo?: string;
    logo_large?: string;
    website?: string;
    name?: string;
    profile_url?: string;
    locations?: Array<{ city?: string; country?: string; area?: string }>;
    industry?: string[];
  } | null>(null);

  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);
  const skipNextRefetchRef = useRef(false);
  const prevCompanyIdForFiltersRef = useRef<string | null>(null);

  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;

  const orgChartLinkedinCandidateSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const orgChartLinkedInSearchType = useRecoilValue(
    orgChartLinkedInSearchTypeState,
  );

  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const showNodeCapabilitiesHoverHint =
    process.env.REACT_APP_EXPERIMENTAL_ORGCHART_NODE_HOVER_HINTS === 'true';

  const { isLinkedinConnected } = useUnipile();
  const setSelectedCompanyInfo = useSetRecoilState(
    orgChartSelectedCompanyInfoState,
  );
  const setContactsByKey = useSetRecoilState(orgChartContactsByKeyState);
  const setOrgChartLinkedinCandidateSource = useSetRecoilState(
    orgChartLinkedinCandidateSourceState,
  );

  const { refetchJobs } = useJobRefetch();
  const { enqueueSnackBar } = useSnackBar();

  const toggleMultiSource = useCallback((source: string) => {
    const slug = normalizeMultiSourceSlug(source);
    if (!slug) return;
    setMultiSourceSelectedSources((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const normalized = list
        .map((s) => normalizeMultiSourceSlug(s))
        .filter((s): s is MultiSourceSlug => !!s);
      const unique = Array.from(new Set(normalized));
      return unique.includes(slug)
        ? unique.filter((s) => s !== slug)
        : [...unique, slug];
    });
  }, []);
  const { t } = useLingui();

  const multiSourceSelectedSlugs = useMemo(() => {
    const normalized = (
      Array.isArray(multiSourceSelectedSources)
        ? multiSourceSelectedSources
        : []
    )
      .map((s) => normalizeMultiSourceSlug(s))
      .filter((s): s is MultiSourceSlug => !!s);

    return Array.from(new Set(normalized));
  }, [multiSourceSelectedSources]);

  const effectiveEmployeeCount =
    unipileCompanyProfile?.employee_count ?? exactEmployeeCount ?? undefined;

  const effectiveCompanyName =
    companyName ??
    unipileCompanyProfile?.name ??
    companyNameFromQuery ??
    undefined;
  const effectiveCompanyWebsite =
    website ?? unipileCompanyProfile?.website ?? websiteFromQuery ?? undefined;
  const effectiveCompanyDomain =
    companyDomain?.trim() || companyDomainFromQuery || undefined;

  const linkedinUrlToUse = linkedinUrl;

  const asOfMonth = searchParams.get('asOf')?.trim() || '';

  useEffect(() => {
    if (!baseUrl || !accessToken || !companyId) {
      setTimelineMetrics(null);
      return;
    }
    let cancelled = false;
    const fetchMetrics = async () => {
      try {
        const params = new URLSearchParams();
        if (effectiveCompanyName?.trim()) {
          params.set('companyName', effectiveCompanyName.trim());
        }
        if (asOfMonth) params.set('asOfMonth', asOfMonth);
        // Preserve sample-company toggles if present.
        const sampleSource = searchParams.get('sampleSource')?.trim();
        const sampleProfiles = searchParams.get('sampleProfiles')?.trim();
        const includeOrgIntelligence = searchParams
          .get('includeOrgIntelligence')
          ?.trim();
        if (sampleSource) params.set('sampleSource', sampleSource);
        if (sampleProfiles) params.set('sampleProfiles', sampleProfiles);
        if (includeOrgIntelligence) {
          params.set('includeOrgIntelligence', includeOrgIntelligence);
        }

        const url = `${baseUrl.replace(/\/$/, '')}/org-chart/${encodeURIComponent(
          companyId,
        )}/timeline?${params.toString()}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = (await res.json()) as { result?: Record<string, unknown> };
        if (cancelled) return;
        if (res.ok && json?.result) {
          setTimelineMetrics(json.result);
        } else {
          setTimelineMetrics(null);
        }
      } catch {
        if (!cancelled) setTimelineMetrics(null);
      }
    };
    void fetchMetrics();
    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    asOfMonth,
    baseUrl,
    companyId,
    effectiveCompanyName,
    searchParams,
  ]);

  const [pendingPreviewNodePeopleChoice, setPendingPreviewNodePeopleChoice] =
    useState<OrgChartNodeData | null>(null);

  const {
    company: fallbackCompanyInfo,
    isLoading: isCompanyInfoLookupLoading,
    lookupByName,
  } = useCompanyInfoLookup({ baseUrl, accessToken });

  const effectiveIndustry =
    industry ??
    fallbackCompanyInfo?.industry ??
    (Array.isArray(unipileCompanyProfile?.industry) &&
    typeof unipileCompanyProfile?.industry?.[0] === 'string'
      ? unipileCompanyProfile.industry[0]
      : undefined);

  const actions = useOrgChartActions({
    companyId,
    companyName: effectiveCompanyName,
    website: effectiveCompanyWebsite,
    employeeCount: effectiveEmployeeCount ?? undefined,
    industry: effectiveIndustry,
    asOfMonth: asOfMonth || undefined,
    linkedinCompanyUrl: linkedinUrlToUse?.trim(),
    includeOrgIntelligence:
      searchParams.get('includeOrgIntelligence') ?? undefined,
    linkedinUnipileAccountId:
      process.env.REACT_APP_ORGCHART_UNIPILE_ACCOUNT_ID?.trim(),
    businessDivisionRawQuery: businessDivisionQuery.trim() || undefined,
    onPreviewNodePeopleRequest: (node) =>
      setPendingPreviewNodePeopleChoice(node),
  });

  const { applyOrgChartOverride } = actions;

  const jobOrgChartHook = useJobOrgChartData(
    { jobId, jobName: companyName ?? effectiveCompanyName },
    { baseUrl, accessToken },
  );

  const classicOrgChartHook = useOrgChartData(
    {
      companyId,
      companyName: effectiveCompanyName ?? companyName,
      website: effectiveCompanyWebsite,
      companyDomain: effectiveCompanyDomain,
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      asOfMonth: asOfMonth || undefined,
      expectedEmployeeCount: effectiveEmployeeCount ?? profileCount,
    },
    { baseUrl, accessToken },
  );

  const isJobMode = !!jobId;

  const data = (
    isJobMode ? jobOrgChartHook.data : classicOrgChartHook.data
  ) as Record<string, unknown> | null;
  const isLoading = isJobMode
    ? jobOrgChartHook.isLoading
    : classicOrgChartHook.isLoading;
  const error = isJobMode ? jobOrgChartHook.error : classicOrgChartHook.error;
  const fetchOrgChart = isJobMode
    ? jobOrgChartHook.fetchOrgChart
    : classicOrgChartHook.fetchOrgChart;
  const orgChartEsTransportError = classicOrgChartHook.orgChartEsTransportError;
  const firstSourceRequested = classicOrgChartHook.firstSourceRequested;
  const firstSourceUsed = classicOrgChartHook.firstSourceUsed;
  const fallbackApplied = classicOrgChartHook.fallbackApplied;
  const fallbackReason = classicOrgChartHook.fallbackReason;
  const apolloTotalCount = classicOrgChartHook.apolloTotalCount;
  const apolloQueued = classicOrgChartHook.apolloQueued;
  const apolloQueueRequestId = classicOrgChartHook.apolloQueueRequestId;
  const apolloQueuePollingKey = `${companyId}:${apolloQueueRequestId ?? ''}`;

  useEffect(() => {
    if (isJobMode || !orgChartEsTransportError) return;
    enqueueSnackBar(t`Org chart search timed out — showing fallback data.`, {
      variant: SnackBarVariant.Warning,
      dedupeKey: `org-chart-es-transport-${companyId ?? ''}`,
      duration: 4000,
    });
  }, [companyId, enqueueSnackBar, isJobMode, orgChartEsTransportError, t]);

  useEffect(() => {
    if (isJobMode || !error) return;

    const normalizedError = error.trim();
    const isApolloRateLimitError =
      firstSourceRequested === 'apollo' ||
      firstSourceUsed === 'apollo' ||
      /apollo/i.test(normalizedError) ||
      /status\s*429/i.test(normalizedError) ||
      /maximum number of api calls/i.test(normalizedError);

    const message = isApolloRateLimitError
      ? `Apollo search failed: ${normalizedError}`
      : normalizedError;

    enqueueSnackBar(message, {
      variant: SnackBarVariant.Error,
      dedupeKey: `org-chart-fetch-error-${companyId ?? ''}-${message}`,
      duration: 8000,
    });
  }, [
    companyId,
    enqueueSnackBar,
    error,
    firstSourceRequested,
    firstSourceUsed,
    isJobMode,
  ]);

  useEffect(() => {
    if (
      isJobMode ||
      firstSourceUsed !== 'elasticsearch' ||
      fallbackApplied !== true ||
      fallbackReason !== 'apollo_result_count_exceeds_limit'
    ) {
      return;
    }
    const countText =
      typeof apolloTotalCount === 'number'
        ? apolloTotalCount.toLocaleString()
        : 'more than 2,000';
    enqueueSnackBar(
      `Loaded a sampled org chart because Apollo returned ${countText} employees. Refine country/function filters or use Leadership Org Chart.`,
      {
        variant: SnackBarVariant.Warning,
        dedupeKey: `org-chart-apollo-fallback-${companyId ?? ''}`,
        duration: 7000,
      },
    );
    setShowApolloFallbackModal(true);
  }, [
    apolloTotalCount,
    companyId,
    enqueueSnackBar,
    fallbackApplied,
    fallbackReason,
    firstSourceUsed,
    isJobMode,
  ]);

  useEffect(() => {
    if (!apolloQueued || isJobMode) {
      return;
    }
    enqueueSnackBar(
      'Apollo org chart is building in background. We will refresh automatically when ready.',
      {
        variant: SnackBarVariant.Info,
        dedupeKey: `org-chart-apollo-queued-${apolloQueueRequestId ?? companyId ?? ''}`,
        duration: 5000,
      },
    );
  }, [apolloQueueRequestId, apolloQueued, companyId, enqueueSnackBar, isJobMode]);

  const hasInitialCompanyInfo =
    companyName ||
    website ||
    locationName ||
    industry ||
    typeof profileCount === 'number' ||
    linkedinUrl;

  useEffect(() => {
    if (skipNextRefetchRef.current) {
      skipNextRefetchRef.current = false;
      return;
    }
    if (
      !isJobMode &&
      !hasInitialCompanyInfo &&
      isCompanyInfoLookupLoading === true
    ) {
      return;
    }
    fetchOrgChart();
  }, [
    fetchOrgChart,
    hasInitialCompanyInfo,
    isCompanyInfoLookupLoading,
    isJobMode,
  ]);

  useEffect(() => {
    if (isJobMode) return;
    actions.clearLatestOrgChart();
  }, [
    actions.clearLatestOrgChart,
    isJobMode,
    companyId,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  useEffect(() => {
    refetchJobs();
  }, [refetchJobs]);

  const orgSource = isJobMode
    ? ((actions.latestOrgChart ??
        (data?.orgChart as Record<string, unknown> | null) ??
        null) as Record<string, unknown> | null)
    : ((actions.latestOrgChart ?? data ?? null) as Record<
        string,
        unknown
      > | null);

  const orgData = useMemo(() => extractOrgData(orgSource), [orgSource]);

  useEffect(() => {
    const next = hydrateContactsByKeyFromOrgData({
      orgData: orgData as unknown as Record<string, unknown> | null,
      effectiveCompanyWebsite,
      website,
    });
    if (Object.keys(next).length === 0) return;
    setContactsByKey((prev) => ({ ...prev, ...next }));
  }, [orgData, effectiveCompanyWebsite, website, setContactsByKey]);

  const isBlankTemplate =
    typeof (orgSource as Record<string, unknown> | null)?.is_blank_template ===
      'boolean' &&
    (orgSource as Record<string, unknown>).is_blank_template === true;

  useEffect(() => {
    if (!apolloQueued || isJobMode) {
      setApolloQueuePollAttempts(0);
      setApolloQueuePollingTimedOut(false);
      return;
    }
    setApolloQueuePollAttempts(0);
    setApolloQueuePollingTimedOut(false);
  }, [apolloQueuePollingKey, apolloQueued, isJobMode]);

  useEffect(() => {
    if (
      !apolloQueued ||
      isJobMode ||
      apolloQueuePollingTimedOut ||
      firstSourceUsed === 'apollo'
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setApolloQueuePollAttempts((currentAttempts) => {
        const nextAttempts = currentAttempts + 1;

        if (nextAttempts >= APOLLO_QUEUE_MAX_ATTEMPTS) {
          setApolloQueuePollingTimedOut(true);
          return nextAttempts;
        }

        void fetchOrgChart();
        return nextAttempts;
      });
    }, APOLLO_QUEUE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    apolloQueued,
    apolloQueuePollingTimedOut,
    fetchOrgChart,
    firstSourceUsed,
    isJobMode,
  ]);

  const filterOptions = useOrgChartFilterOptions(orgData);

  useEffect(() => {
    if (hasInitialCompanyInfo) return;
    const lookupKey = companyName?.trim() || companyId;
    if (lookupKey) lookupByName(lookupKey);
  }, [companyId, companyName, hasInitialCompanyInfo, lookupByName]);

  useEffect(() => {
    if (!fallbackCompanyInfo) return;
    setSelectedCompanyInfo({
      companyId: fallbackCompanyInfo.companyId,
      companyName: fallbackCompanyInfo.companyName,
      website: fallbackCompanyInfo.website,
      locationName: fallbackCompanyInfo.locationName,
      industry: fallbackCompanyInfo.industry,
      profileCount: fallbackCompanyInfo.profileCount,
      linkedinUrl: fallbackCompanyInfo.linkedinUrl,
    });
  }, [fallbackCompanyInfo, setSelectedCompanyInfo]);

  useEffect(() => {
    if (
      !isLinkedinConnected ||
      !linkedinUrlToUse?.trim() ||
      !baseUrl ||
      !accessToken
    ) {
      if (!isLinkedinConnected) setUnipileCompanyProfile(null);
      return;
    }

    let cancelled = false;
    const fetchCompanyProfile = async () => {
      try {
        const params = new URLSearchParams();
        params.set('linkedinUrl', linkedinUrlToUse.trim());
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/org-chart/companies/company-profile?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (cancelled) return;
        const data = (await res.json()) as {
          linkedinConnected?: boolean;
          profile?: typeof unipileCompanyProfile;
        };
        if (res.ok && data.linkedinConnected && data.profile) {
          setUnipileCompanyProfile(data.profile);
        } else {
          setUnipileCompanyProfile(null);
        }
      } catch {
        if (!cancelled) setUnipileCompanyProfile(null);
      }
    };
    void fetchCompanyProfile();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, accessToken, isLinkedinConnected, linkedinUrlToUse]);

  useEffect(() => {
    const prev = prevCompanyIdForFiltersRef.current;
    const companyChanged = prev !== null && prev !== companyId;
    prevCompanyIdForFiltersRef.current = companyId;

    if (companyChanged) {
      skipNextRefetchRef.current = true;
      setSelectedCountry(DEFAULT_ORG_CHART_COUNTRY);
      setSelectedFunctionRoot(DEFAULT_ORG_CHART_FUNCTION_ROOT);
      return;
    }

    if (!orgData || !companyId) return;

    setSelectedCountry((current) => {
      if (current) return current;
      skipNextRefetchRef.current = true;
      const initialCountry =
        typeof (orgData as Record<string, unknown>).country === 'string'
          ? ((orgData as Record<string, unknown>).country as string)
          : undefined;
      return initialCountry;
    });

    setSelectedFunctionRoot((current) => {
      if (current) return current;
      skipNextRefetchRef.current = true;
      const initialFunctionRoot =
        typeof (orgData as Record<string, unknown>).type === 'string'
          ? ((orgData as Record<string, unknown>).type as string)
          : undefined;
      return initialFunctionRoot;
    });
  }, [orgData, companyId]);

  const nodeDataArray = useOrgChartNodeDataArray({
    orgData: orgData as unknown as Record<string, unknown> | null,
    enrichedNodes: actions.enrichedNodes as any,
    baseUrl,
  });

  const leadershipLayerPreviewBanner = useMemo(() => {
    const src = orgSource as Record<string, unknown> | null;
    if (!src || src.org_enriched !== true) {
      return null;
    }
    const leadershipN =
      typeof src.org_people_count === 'number'
        ? (src.org_people_count as number)
        : null;
    if (leadershipN === null) return null;
    const fullN =
      typeof effectiveEmployeeCount === 'number'
        ? effectiveEmployeeCount
        : null;
    return { leadershipN, fullN };
  }, [orgSource, effectiveEmployeeCount]);

  const {
    showPreviewPersistentBanner,
    m7kqPreviewOrgChartBanner,
    isM7kqOrgChartSource,
  } = useOrgChartBanners({
    nodeDataArray,
    isLoading,
    error,
    isBlankTemplate,
    orgSource,
    effectiveEmployeeCount,
    orgChartLinkedinCandidateSource,
    leadershipLayerPreviewBanner,
  });

  const handleM7kqLockedContactClick = useCallback(
    (
      _node: OrgChartNodeData,
      _personSlotIndex: number,
      _channel: 'email' | 'phone' | 'linkedin',
    ) => {
      enqueueSnackBar(
        t`Contact details and full profiles require a paid plan. Upgrade to unlock emails, phone numbers, and enriched LinkedIn data.`,
        { variant: SnackBarVariant.Info, duration: 6000 },
      );
    },
    [enqueueSnackBar, t],
  );

  const handleSearch = () => {
    const handle = diagramHandleRef.current;
    if (!handle) return;
    const count = handle.search(searchTerm);
    setSearchResultCount(count);
  };

  const handleClearSearch = () => {
    diagramHandleRef.current?.clearSearch();
    setSearchTerm('');
    setSearchResultCount(null);
  };

  const debouncedSetCountry = useDebouncedCallback(
    (country: string | undefined) => setSelectedCountry(country),
    150,
  );
  const debouncedSetFunctionRoot = useDebouncedCallback(
    (fn: string | undefined) => setSelectedFunctionRoot(fn),
    150,
  );

  const resolvedSearchMode =
    selectedFunctionRoot && selectedFunctionRoot !== 'fullcompany'
      ? 'function_grade'
      : 'entire_company';

  const [pendingSearchConfirm, setPendingSearchConfirm] = useState<{
    title: string;
    run: () => void;
    kind?: 'default' | 'multi_source';
  } | null>(null);

  const requestCandidateSearchConfirm = useCallback(
    (
      title: string,
      run: () => void,
      kind: 'default' | 'multi_source' = 'default',
    ) => {
      setPendingSearchConfirm({ title, run, kind });
    },
    [],
  );

  const handleViewAllCandidates = useCallback(async () => {
    await actions.executeOrgchartSearch({
      mode: resolvedSearchMode as any,
      origin: 'view_all_candidates',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
    });
  }, [
    actions.executeOrgchartSearch,
    resolvedSearchMode,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const handleGetAllOrgChartSearch = useCallback(async () => {
    await actions.executeOrgchartSearch({
      mode: resolvedSearchMode as any,
      origin: 'header',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
    });
  }, [
    actions.executeOrgchartSearch,
    resolvedSearchMode,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const handleGetAllOrgChartSearchMultiSource = useCallback(async () => {
    await actions.executeOrgchartSearch({
      mode: resolvedSearchMode as any,
      origin: 'header',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      multiSource: true,
      sources: multiSourceSelectedSlugs,
    } as any);
  }, [
    actions.executeOrgchartSearch,
    resolvedSearchMode,
    selectedCountry,
    selectedFunctionRoot,
    multiSourceSelectedSlugs,
  ]);

  const handleBuildOrgIntelligence = useCallback(async () => {
    setOrgChartLinkedinCandidateSource('apify');

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('includeOrgIntelligence', 'true');
    setSearchParams(nextParams, { replace: true });

    await actions.executeOrgchartSearch({
      mode: 'entire_company',
      origin: 'header',
      country: DEFAULT_ORG_CHART_COUNTRY,
      functionRoot: DEFAULT_ORG_CHART_FUNCTION_ROOT,
    });
  }, [
    actions.executeOrgchartSearch,
    searchParams,
    setOrgChartLinkedinCandidateSource,
    setSearchParams,
  ]);

  const handleMapBusinessDivision = useCallback(async () => {
    const trimmed = businessDivisionQuery.trim();
    if (!trimmed) return;
    await actions.executeOrgchartSearch({
      mode: 'business_division_map',
      origin: 'header',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      businessDivisionRawQuery: trimmed,
    });
  }, [
    actions.executeOrgchartSearch,
    businessDivisionQuery,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const fetchLinkedinDataSourcesStatus = useCallback(async (): Promise<{
    linkedinUnipileConnected: boolean;
    apifyActorConfigured: boolean;
    pythonOrgChartAgentAvailable: boolean;
  } | null> => {
    if (!baseUrl?.trim() || !accessToken) {
      return null;
    }
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/org-chart/linkedin-data-sources-status`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) {
        return null;
      }
      const json = (await res.json()) as {
        status?: string;
        linkedinUnipileConnected?: boolean;
        apifyActorConfigured?: boolean;
        pythonOrgChartAgentAvailable?: boolean;
      };
      if (json?.status !== 'ok') {
        return null;
      }
      return {
        linkedinUnipileConnected: !!json.linkedinUnipileConnected,
        apifyActorConfigured: !!json.apifyActorConfigured,
        pythonOrgChartAgentAvailable:
          typeof json.pythonOrgChartAgentAvailable === 'boolean'
            ? json.pythonOrgChartAgentAvailable
            : true,
      };
    } catch {
      return null;
    }
  }, [baseUrl, accessToken]);

  const fetchEnrichedLeadershipOrgChart = useCallback(async () => {
    if (!companyId?.trim() || !baseUrl?.trim()) {
      enqueueSnackBar('Missing company or server URL', {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    setIsEnrichedLeadershipLoading(true);
    try {
      const agentStatus = await fetchLinkedinDataSourcesStatus();
      if (agentStatus !== null && !agentStatus.pythonOrgChartAgentAvailable) {
        enqueueSnackBar(
          leadershipOrgChartPythonFailureMessage(
            ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR,
          ),
          { variant: SnackBarVariant.Error, duration: 12000 },
        );
        return;
      }
      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const canonicalCompanyId = normalizeCompanyIdForUrl(companyId);
      const params = new URLSearchParams();
      const nameToSend = effectiveCompanyName?.trim();
      if (nameToSend) {
        params.set('companyName', nameToSend);
      }
      if (selectedCountry?.trim()) {
        params.set('country', selectedCountry.trim());
      }
      if (selectedFunctionRoot?.trim()) {
        params.set('functionRoot', selectedFunctionRoot.trim());
      }
      const qs = params.toString();
      const url = `${normalizedBaseUrl}/org-chart/${encodeURIComponent(
        canonicalCompanyId,
      )}/enriched${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const json = (await res.json()) as {
        status?: string;
        result?: Record<string, unknown>;
        message?: string | string[];
      };
      if (!res.ok) {
        const rawMsg = json?.message;
        const msg =
          typeof rawMsg === 'string' && rawMsg
            ? rawMsg
            : Array.isArray(rawMsg)
              ? rawMsg.join(', ')
              : `Request failed (${res.status})`;
        throw new Error(leadershipOrgChartPythonFailureMessage(msg));
      }
      if (json?.status === 'ok' && json.result) {
        applyOrgChartOverride(json.result);
        enqueueSnackBar('Loaded Leadership Org Chart', {
          variant: SnackBarVariant.Success,
          duration: 4000,
        });
        window.setTimeout(() => {
          diagramHandleRef.current?.zoomToFit();
        }, 150);
      } else {
        throw new Error(
          leadershipOrgChartPythonFailureMessage(
            'Invalid response from leadership org chart endpoint',
          ),
        );
      }
    } catch (e) {
      enqueueSnackBar(
        e instanceof Error
          ? e.message
          : leadershipOrgChartPythonFailureMessage('Unknown error'),
        { variant: SnackBarVariant.Error, duration: 10000 },
      );
    } finally {
      setIsEnrichedLeadershipLoading(false);
    }
  }, [
    companyId,
    baseUrl,
    accessToken,
    effectiveCompanyName,
    selectedCountry,
    selectedFunctionRoot,
    applyOrgChartOverride,
    enqueueSnackBar,
    fetchLinkedinDataSourcesStatus,
  ]);

  const filtersProps = {
    availableCountries: filterOptions.availableCountries,
    countryPercentLabels: filterOptions.countryPercentLabels,
    selectedCountry,
    onCountryChange: debouncedSetCountry,
    availableFunctionRoots: filterOptions.availableFunctionRoots,
    functionRootPercentLabels: filterOptions.functionRootPercentLabels,
    selectedFunctionRoot,
    onFunctionRootChange: debouncedSetFunctionRoot,
    omitMarginLeft: true,
  };

  const searchControlsProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    searchResultCount,
    onSearch: handleSearch,
    onClearSearch: handleClearSearch,
    diagramHandleRef,
    onGetAll: () => {
      requestCandidateSearchConfirm(t`Confirm full org chart search`, () => {
        void handleGetAllOrgChartSearch();
      });
    },
    onGetAllMultiSource: () => {
      requestCandidateSearchConfirm(
        t`Confirm multi-source full org chart search`,
        () => {
          void handleGetAllOrgChartSearchMultiSource();
        },
        'multi_source',
      );
    },
    onBuildOrgIntelligence: () => {
      requestCandidateSearchConfirm(t`Confirm org intelligence build`, () => {
        void handleBuildOrgIntelligence();
      });
    },
    multiSourceSelectedSources: multiSourceSelectedSlugs,
    onToggleMultiSource: toggleMultiSource,
    onViewAllCandidates: () => {
      requestCandidateSearchConfirm(t`Confirm view all candidates`, () => {
        void handleViewAllCandidates();
      });
    },
    onGetLeaders: () => {
      requestCandidateSearchConfirm(t`Confirm leadership search`, () => {
        void actions.executeOrgchartSearch({
          mode: 'leadership',
          origin: 'header',
          country: selectedCountry,
          functionRoot: selectedFunctionRoot,
        });
      });
    },
  };

  const searchConfirmSummary = useMemo(() => {
    const bd = businessDivisionQuery.trim();
    const fn = selectedFunctionRoot;
    const country = selectedCountry;

    const functionLabel =
      !fn || fn === 'fullcompany'
        ? t`Full company`
        : filterOptions.functionRootPercentLabels[fn]
          ? `${toTitleCase(fn)} (${filterOptions.functionRootPercentLabels[fn]})`
          : toTitleCase(fn);

    const geographyLabel =
      !country || country === 'global'
        ? t`Global`
        : filterOptions.countryPercentLabels[country]
          ? `${toTitleCase(country)} (${filterOptions.countryPercentLabels[country]})`
          : toTitleCase(country);

    const linkedinSearchTypeLabel =
      orgChartLinkedInSearchType === 'sales_navigator'
        ? t`Sales Navigator`
        : orgChartLinkedInSearchType === 'recruiter'
          ? t`LinkedIn Recruiter`
          : t`LinkedIn Classic`;

    const dataSourceLabel =
      orgChartLinkedinCandidateSource === 'unipile'
        ? t`LinkedIn · ${linkedinSearchTypeLabel}`
        : orgChartLinkedinCandidateSource === 'apify'
          ? t`Apify`
          : orgChartLinkedinCandidateSource === 'linkedin_xray'
            ? t`LinkedIn X-Ray`
            : orgChartLinkedinCandidateSource ===
                ORG_CHART_CANDIDATE_SOURCE_M7KQ
              ? t`Directory`
              : t`Unknown data source`;

    return {
      functionLabel,
      levelsLabel: t`All levels`,
      geographyLabel,
      businessDivisionLabel: bd.length > 0 ? bd : t`Not specified`,
      dataSourceLabel,
    };
  }, [
    businessDivisionQuery,
    selectedCountry,
    selectedFunctionRoot,
    filterOptions.countryPercentLabels,
    filterOptions.functionRootPercentLabels,
    orgChartLinkedinCandidateSource,
    orgChartLinkedInSearchType,
    t,
  ]);

  const candidateSearchConfirmSubtitle = useMemo(
    () => (
      <StyledOrgChartConfirmSummary>
        <StyledOrgChartConfirmIntro>
          <Trans>
            The search will use the scope below. Confirm to continue, or cancel
            to adjust filters first.
          </Trans>
        </StyledOrgChartConfirmIntro>
        <StyledOrgChartConfirmRows>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Function</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.functionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Levels</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.levelsLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Geography</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.geographyLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Business division</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.businessDivisionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Data source</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.dataSourceLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          {pendingSearchConfirm?.kind === 'multi_source' ? (
            <StyledOrgChartConfirmRow>
              <StyledOrgChartConfirmDt>
                <Trans>Org chart sources</Trans>
              </StyledOrgChartConfirmDt>
              <StyledOrgChartConfirmDd>
                {multiSourceSelectedSlugs.length > 0
                  ? multiSourceSelectedSlugs
                      .map((source) => toTitleCase(source))
                      .join(', ')
                  : t`None selected`}
              </StyledOrgChartConfirmDd>
            </StyledOrgChartConfirmRow>
          ) : null}
        </StyledOrgChartConfirmRows>
      </StyledOrgChartConfirmSummary>
    ),
    [
      multiSourceSelectedSlugs,
      pendingSearchConfirm?.kind,
      searchConfirmSummary,
      t,
    ],
  );

  const previewNodeChoiceSubtitle = useMemo(
    () => (
      <StyledOrgChartConfirmSummary>
        <StyledOrgChartConfirmIntro>
          <Trans>
            Preview positions do not load people until you generate a real org
            chart. Choose an action using the scope below, or cancel to adjust
            filters first.
          </Trans>
        </StyledOrgChartConfirmIntro>
        <StyledOrgChartConfirmRows>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Function</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.functionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Levels</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.levelsLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Geography</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.geographyLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Business division</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.businessDivisionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Data source</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.dataSourceLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
        </StyledOrgChartConfirmRows>
      </StyledOrgChartConfirmSummary>
    ),
    [searchConfirmSummary],
  );

  const headerProps = {
    companyName: effectiveCompanyName ?? fallbackCompanyInfo?.companyName,
    website: effectiveCompanyWebsite ?? fallbackCompanyInfo?.website,
    locationName: locationName ?? fallbackCompanyInfo?.locationName,
    industry: industry ?? fallbackCompanyInfo?.industry,
    profileCount: profileCount ?? fallbackCompanyInfo?.profileCount,
    hideProfileCountWhenUnipile: !!unipileCompanyProfile,
    linkedinUrl: linkedinUrl ?? fallbackCompanyInfo?.linkedinUrl,
    employeeCount: effectiveEmployeeCount ?? fallbackCompanyInfo?.employeeCount,
    linkedinDisplayName: fallbackCompanyInfo?.linkedinDisplayName,
    description: unipileCompanyProfile?.description,
    tagline: unipileCompanyProfile?.tagline,
    logoUrl: undefined,
    asOfMonth: asOfMonth || undefined,
    timelineMetrics,
    timelineProfilesOptions: {
      baseUrl,
      accessToken,
      companyId,
      asOfMonth: asOfMonth || undefined,
      companyName: effectiveCompanyName,
      sampleSource: searchParams.get('sampleSource') ?? undefined,
      sampleProfiles: searchParams.get('sampleProfiles') ?? undefined,
      includeOrgIntelligence:
        searchParams.get('includeOrgIntelligence') ?? undefined,
    },
    onAsOfMonthChange: (next: string) => {
      const copy = new URLSearchParams(searchParams);
      const trimmed = next.trim();
      if (!trimmed) {
        copy.delete('asOf');
      } else {
        copy.set('asOf', trimmed);
      }
      setSearchParams(copy, { replace: true });
    },
    onBack,
    hasFilters: !!orgData,
    filtersProps,
    businessDivisionQueryProps: {
      value: businessDivisionQuery,
      onChange: setBusinessDivisionQuery,
      onSubmit: () => void handleMapBusinessDivision(),
      isSubmitting: actions.isContextLoading,
    },
    toolbarTrailing: null,
    onClearCompanyCache: () =>
      void actions.handleBackgroundContextAction('delete_company_cache'),
    onShare:
      accessToken && baseUrl ? () => setIsShareModalOpen(true) : undefined,
  };

  const showContextProgressBanner =
    actions.isContextLoading &&
    !actions.isContextModalOpen &&
    !!actions.contextProgressMessage;

  return (
    <>
      <ArxOrgChartView
        headerProps={headerProps as any}
        isLoading={isLoading}
        error={error ?? null}
        nodeDataArray={nodeDataArray}
        isBlankTemplate={isBlankTemplate}
        accessToken={accessToken}
        onNavigateToSignup={() => navigate(AppPath.SignInUp)}
        showPreviewPersistentBanner={showPreviewPersistentBanner}
        isEnrichedLeadershipLoading={isEnrichedLeadershipLoading}
        contextProgressMessage={actions.contextProgressMessage}
        contextLoadingStartedAt={actions.contextLoadingStartedAt}
        showContextProgressBanner={showContextProgressBanner}
        isContextLoading={actions.isContextLoading}
        diagramHandleRef={diagramHandleRef}
        diagramProps={{
          m7kqContactMode: isM7kqOrgChartSource,
          onLockedContactChannelClick: handleM7kqLockedContactClick,
          nodeCapabilitiesHoverCompanyName: effectiveCompanyName ?? undefined,
          iconUrls: {
            lock: '/img/lock.png',
            linkedin: '/img/linkedin-icon-png-circle-2.png',
            download: '/img/download-icon.png',
            similarItems: '/img/similar-items.png',
          },
          onNodeContextAction: actions.handleNodeContextAction,
          onBackgroundContextAction: actions.handleBackgroundContextAction,
          onNodeDoubleClick: actions.handleNodeDoubleClick,
          onDownloadNode: actions.handleDownloadNode,
          onSimilarPeople: actions.handleSimilarPeople,
        }}
        showNodeCapabilitiesHoverHint={showNodeCapabilitiesHoverHint}
        effectiveEmployeeCount={effectiveEmployeeCount ?? undefined}
        leadershipLayerPreviewBanner={leadershipLayerPreviewBanner}
        m7kqPreviewOrgChartBanner={m7kqPreviewOrgChartBanner}
        apolloFallbackNotice={
          !isJobMode &&
          firstSourceUsed === 'elasticsearch' &&
          fallbackApplied === true &&
          fallbackReason === 'apollo_result_count_exceeds_limit'
            ? {
                apolloTotalCount,
                isModalOpen: showApolloFallbackModal,
                onCloseModal: () => setShowApolloFallbackModal(false),
              }
            : null
        }
        apolloQueueNotice={
          !isJobMode && apolloQueued && firstSourceUsed !== 'apollo'
            ? {
                isTimedOut: apolloQueuePollingTimedOut,
                pollAttempts: apolloQueuePollAttempts,
                maxAttempts: APOLLO_QUEUE_MAX_ATTEMPTS,
                onRetry: () => {
                  setApolloQueuePollAttempts(0);
                  setApolloQueuePollingTimedOut(false);
                  void fetchOrgChart();
                },
              }
            : null
        }
        searchControlsProps={searchControlsProps}
        onTopRightLeadershipOrgChart={() => {
          requestCandidateSearchConfirm(t`Confirm Leadership Org Chart`, () => {
            void fetchEnrichedLeadershipOrgChart();
          });
        }}
        pendingSearchConfirm={pendingSearchConfirm}
        setPendingSearchConfirm={setPendingSearchConfirm}
        candidateSearchConfirmSubtitle={candidateSearchConfirmSubtitle}
        previewNodeChoiceSubtitle={previewNodeChoiceSubtitle}
        pendingPreviewNodePeopleChoice={pendingPreviewNodePeopleChoice}
        setPendingPreviewNodePeopleChoice={setPendingPreviewNodePeopleChoice}
        onConfirmPreviewNodeFullOrgChart={() => {
          setPendingPreviewNodePeopleChoice(null);
          void handleGetAllOrgChartSearch();
        }}
        onConfirmPreviewNodeViewAllCandidates={() => {
          setPendingPreviewNodePeopleChoice(null);
          void handleViewAllCandidates();
        }}
        onConfirmPreviewNodeLeadership={() => {
          setPendingPreviewNodePeopleChoice(null);
          void fetchEnrichedLeadershipOrgChart();
        }}
        contextModalProps={
          actions.isContextModalOpen
            ? {
                isOpen: true,
                title: actions.contextModalTitle,
                isLoading: actions.isContextLoading,
                loadingStartedAt: actions.contextLoadingStartedAt,
                loadingProgressMessage: actions.contextProgressMessage,
                loadingPage: actions.contextProgressPage,
                loadingTotalPages: actions.contextProgressTotalPages,
                loadingTotalCandidates: actions.contextProgressTotalCandidates,
                error: actions.contextError,
                results: actions.contextResults,
                booleanKeywordsString: actions.booleanKeywordsString,
                companyWebsite: headerProps.website,
                companyId: companyId,
                onClose: actions.closeContextModal,
                onDownloadCsv:
                  actions.contextResults.length > 0
                    ? actions.downloadContextResultsAsCsv
                    : undefined,
                addToJobInlineContext: {
                  companyName: effectiveCompanyName ?? undefined,
                  contextModalMode: actions.contextModalMode ?? undefined,
                  selectedNodeFunction: actions.selectedNodeFunction,
                  selectedNodeGrade: actions.selectedNodeGrade,
                },
                onStop: actions.cancelOrgchartSearch,
              }
            : null
        }
        nodeDetailModalProps={
          actions.selectedNodeForDetails
            ? {
                isOpen: true,
                title: actions.selectedNodeForDetails.headline,
                isLoading: actions.isNodeDetailLoading,
                error: actions.nodeDetailError,
                results: actions.nodeDetailResults,
                emptyMessage: 'No people are attached to this node yet.',
                companyWebsite: headerProps.website,
                companyId: companyId,
                onClose: actions.closeNodeDetailModal,
                onDownloadCsv: actions.downloadNodeDetailsAsCsv,
                addToJobInlineContext: {
                  companyName: effectiveCompanyName ?? undefined,
                  contextModalMode: 'current_node' as const,
                  selectedNodeFunction: actions.selectedNodeFunction,
                  selectedNodeGrade: actions.selectedNodeGrade,
                },
                onGetSimilarPeople: () =>
                  actions.executeOrgchartSearch({
                    mode: 'function_grade',
                    origin: 'doubleClick',
                    node: actions.selectedNodeForDetails!,
                  }),
              }
            : null
        }
        addToJobModalProps={{
          isOpen: actions.isAddToJobModalOpen,
          onClose: actions.closeAddToJobModal,
          node: actions.addToJobNode,
          companyName: effectiveCompanyName ?? undefined,
          queueStartChatAfter: actions.addToJobQueueStartChat,
          onSuccess: actions.closeAddToJobModal,
        }}
        outreachModalProps={{
          isOpen: actions.isOutreachModalOpen,
          onClose: actions.closeOutreachModal,
          channel: actions.outreachChannel,
          contextItem: actions.outreachContextItem,
          node: actions.outreachNode,
          companyName: effectiveCompanyName ?? undefined,
        }}
      />
      {accessToken && baseUrl ? (
        <OrgChartShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          companyId={companyId}
          companyName={effectiveCompanyName ?? fallbackCompanyInfo?.companyName}
          accessToken={accessToken}
          serverBaseUrl={baseUrl}
          arxenaSiteBaseUrl={process.env.REACT_APP_ARXENA_SITE_BASE_URL}
        />
      ) : null}
    </>
  );
};

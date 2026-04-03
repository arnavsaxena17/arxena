import { useCallback, useEffect, useRef, useState } from 'react';

import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';
import { Mixpanel } from '~/mixpanel';

import {
  normalizeCompanyIdForUrl,
  type OrgChartContextAction,
} from 'twenty-orgchart';
import type { NodeState, OrgChartNodeData } from 'twenty-shared';
import type { ContextResultItem } from '../types';
import {
  buildBooleanKeywordsForNode,
  exportContextResultsToCsv,
  normalizeCandidateItem,
} from '../utils/orgChartUtils';

/** Subset of {@link OrgChartContextAction} used for org-chart search API `mode`. */
type OrgchartSearchMode = Extract<
  OrgChartContextAction,
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'all_people'
  | 'function_grade'
  | 'business_division_map'
  | 'selected_nodes'
>;

export type UseOrgChartActionsParams = {
  companyId: string;
  companyName?: string;
  website?: string;
  employeeCount?: number | null;
  /** Canonical LinkedIn company URL for org-chart search + Python pipeline (e.g. https://www.linkedin.com/company/briskpe/) */
  linkedinCompanyUrl?: string;
  /**
   * Unipile LinkedIn account id for this search (sent as `?account_id=` like linkedin-search).
   * Prefer workspace-linked account; use for local/testing via env if needed.
   */
  linkedinUnipileAccountId?: string;
};

type OrgChartSearchProgressEvent = {
  event?: 'status' | 'paginationInfo' | 'pageResults' | 'complete' | 'error';
  requestId?: string;
  mode?: string;
  data?: {
    message?: string;
    page?: number;
    totalPages?: number;
    totalCandidates?: number;
    totalCount?: number;
    candidatesReceived?: number;
    candidatesCollectedSoFar?: number;
    remainingToFetch?: number;
  };
};

const createOrgChartRequestId = () =>
  `orgchart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const LINKEDIN_UNIPILE_SOURCE_UNAVAILABLE_SNACKBAR =
  'LinkedIn (Unipile) is not connected. Connect LinkedIn in settings or choose Apify as the org chart data source in the jobs menu.';

const APIFY_SOURCE_UNAVAILABLE_SNACKBAR =
  'Apify is not configured for org chart. Set APIFY_API_TOKEN on the server or choose LinkedIn (Unipile) in the jobs menu.';

const APIFY_MODE_UNSUPPORTED_SNACKBAR =
  'Apify org chart data source is only available for full company (or all people) searches. Switch to LinkedIn (Unipile) for business division mapping, function filters, or other advanced modes.';

const ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR =
  'Contact Support. Org chart agent service is not available. Ensure the Python service is running and reachable.';

const clearCompanyOrgChartCacheRequest = async (input: {
  baseUrl: string;
  accessToken: string;
  companyId: string;
  companyName?: string;
}): Promise<void> => {
  const normalizedBaseUrl = input.baseUrl.replace(/\/$/, '');
  const res = await fetch(
    `${normalizedBaseUrl}/org-chart/company-cache/clear`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        companyId: input.companyId,
        companyName: input.companyName,
      }),
    },
  );
  let json: { message?: string; status?: string } = {};
  try {
    json = (await res.json()) as { message?: string; status?: string };
  } catch {
    // non-JSON error body
  }
  if (!res.ok) {
    const msg =
      typeof json?.message === 'string' && json.message.trim()
        ? json.message
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
};

export const useOrgChartActions = ({
  companyId,
  companyName,
  website,
  employeeCount,
  linkedinCompanyUrl,
  linkedinUnipileAccountId,
}: UseOrgChartActionsParams) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;
  const orgChartLinkedinCandidateSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const { enqueueSnackBar, updateSnackBarByDedupeKey, closeSnackBarByDedupeKey } =
    useSnackBar();
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [contextModalTitle, setContextModalTitle] = useState('');
  const [contextModalMode, setContextModalMode] =
    useState<OrgChartContextAction | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [contextLoadingStartedAt, setContextLoadingStartedAt] = useState<
    number | null
  >(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextResults, setContextResults] = useState<ContextResultItem[]>([]);
  const [activeOrgChartRequestId, setActiveOrgChartRequestId] = useState<
    string | null
  >(null);
  const orgchartAbortControllerRef = useRef<AbortController | null>(null);
  const [contextProgressMessage, setContextProgressMessage] = useState<
    string | null
  >(null);
  const [contextProgressPage, setContextProgressPage] = useState<number | null>(
    null,
  );
  const [contextProgressTotalPages, setContextProgressTotalPages] = useState<
    number | null
  >(null);
  const [contextProgressTotalCandidates, setContextProgressTotalCandidates] =
    useState<number | null>(null);
  const [booleanKeywordsString, setBooleanKeywordsString] = useState<
    string | null
  >(null);

  const [selectedNodeForDetails, setSelectedNodeForDetails] =
    useState<OrgChartNodeData | null>(null);
  const [isNodeDetailLoading, setIsNodeDetailLoading] = useState(false);
  const [nodeDetailError, setNodeDetailError] = useState<string | null>(null);
  const [nodeDetailResults, setNodeDetailResults] = useState<
    ContextResultItem[]
  >([]);

  const [enrichedNodes, setEnrichedNodes] = useState<
    Record<number, { people: ContextResultItem[]; nodeState: NodeState }>
  >({});

  const [latestOrgChart, setLatestOrgChart] = useState<
    Record<string, unknown> | null
  >(null);

  const [selectedNodeFunction, setSelectedNodeFunction] = useState<
    string | undefined
  >(undefined);
  const [selectedNodeGrade, setSelectedNodeGrade] = useState<
    string | undefined
  >(undefined);

  const [isAddToJobModalOpen, setIsAddToJobModalOpen] = useState(false);
  const [addToJobNode, setAddToJobNode] = useState<OrgChartNodeData | null>(
    null,
  );
  const [addToJobQueueStartChat, setAddToJobQueueStartChat] = useState(true);

  const [isAddResultsToJobModalOpen, setIsAddResultsToJobModalOpen] =
    useState(false);
  const [addResultsToJobResults, setAddResultsToJobResults] = useState<
    ContextResultItem[]
  >([]);
  const [addResultsToJobContext, setAddResultsToJobContext] = useState<{
    companyName?: string;
    contextModalMode?: string | null;
    selectedNodeFunction?: string;
    selectedNodeGrade?: string;
  }>({});

  const closeAddToJobModal = useCallback(() => {
    setIsAddToJobModalOpen(false);
    setAddToJobNode(null);
  }, []);

  const openAddResultsToJobModal = useCallback(
    (
      results: ContextResultItem[],
      context: {
        companyName?: string;
        contextModalMode?: string | null;
        selectedNodeFunction?: string;
        selectedNodeGrade?: string;
      },
    ) => {
      setAddResultsToJobResults(results);
      setAddResultsToJobContext({
        ...context,
        selectedNodeFunction:
          context.selectedNodeFunction ?? selectedNodeFunction,
        selectedNodeGrade: context.selectedNodeGrade ?? selectedNodeGrade,
      });
      setIsAddResultsToJobModalOpen(true);
    },
    [selectedNodeFunction, selectedNodeGrade],
  );

  const closeAddResultsToJobModal = useCallback(() => {
    setIsAddResultsToJobModalOpen(false);
    setAddResultsToJobResults([]);
    setAddResultsToJobContext({});
  }, []);

  useWebSocketEvent<OrgChartSearchProgressEvent>(
    'orgchart-search-progress',
    (payload) => {
      if (!payload?.requestId || payload.requestId !== activeOrgChartRequestId) {
        return;
      }

      const eventData = payload.data ?? {};

      const updateSnackBarIfEntireCompany = (message: string) => {
        if (payload.mode === 'entire_company' && companyId) {
          updateSnackBarByDedupeKey(
            `orgchart-entire-company-${companyId}`,
            { message },
          );
        }
      };

      if (payload.event === 'error') {
        const msg =
          typeof eventData.message === 'string' && eventData.message.length > 0
            ? eventData.message
            : 'Organization chart request failed.';
        if (payload.mode === 'entire_company' && companyId) {
          closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        }
        enqueueSnackBar(msg, {
          variant: SnackBarVariant.Error,
          dedupeKey: payload.requestId
            ? `orgchart-request-error-${payload.requestId}`
            : 'orgchart-request-error',
          duration: 8000,
        });
        setContextError(msg);
        setContextProgressMessage(null);
        setContextProgressPage(null);
        setContextProgressTotalPages(null);
        setContextProgressTotalCandidates(null);
        setIsContextLoading(false);
        return;
      }

      if (payload.event === 'status') {
        if (eventData.message) {
          setContextProgressMessage(eventData.message);
          updateSnackBarIfEntireCompany(eventData.message);
        }
        return;
      }

      if (payload.event === 'paginationInfo') {
        const totalPages =
          typeof eventData.totalPages === 'number' ? eventData.totalPages : null;
        const totalCount =
          typeof eventData.totalCount === 'number' ? eventData.totalCount : null;

        setContextProgressTotalPages(totalPages);
        setContextProgressTotalCandidates(totalCount);

        const paginationMsg =
          totalPages && totalCount
            ? `Found ${totalCount} results across about ${totalPages} page(s).`
            : 'Pagination info received. Fetching additional pages...';
        setContextProgressMessage(paginationMsg);
        updateSnackBarIfEntireCompany(paginationMsg);
        return;
      }

      if (payload.event === 'pageResults') {
        const page = typeof eventData.page === 'number' ? eventData.page : null;
        const totalPages =
          typeof eventData.totalPages === 'number' ? eventData.totalPages : null;
        const totalCandidates =
          typeof eventData.totalCandidates === 'number'
            ? eventData.totalCandidates
            : null;
        const remaining =
          typeof eventData.remainingToFetch === 'number'
            ? eventData.remainingToFetch
            : null;

        setContextProgressPage(page);
        setContextProgressTotalPages(totalPages);
        setContextProgressTotalCandidates(totalCandidates);

        const pageMsg =
          page != null
            ? remaining != null && remaining >= 0
              ? `Fetched page ${page}${totalPages ? `/${totalPages}` : ''} - ${totalCandidates ?? 0} collected, ${remaining} remaining.`
              : `Fetched page ${page}${totalPages ? `/${totalPages}` : ''} - ${totalCandidates ?? 0} people collected so far.`
            : 'Received page update...';
        setContextProgressMessage(pageMsg);
        updateSnackBarIfEntireCompany(pageMsg);
        return;
      }

      if (payload.event === 'complete') {
        if (eventData.message) {
          setContextProgressMessage(eventData.message);
        }
      }
    },
    [
      activeOrgChartRequestId,
      companyId,
      updateSnackBarByDedupeKey,
      closeSnackBarByDedupeKey,
      enqueueSnackBar,
    ],
  );

  useEffect(() => {
    if (!isContextLoading && activeOrgChartRequestId) {
      setActiveOrgChartRequestId(null);
    }
  }, [activeOrgChartRequestId, isContextLoading]);

  const fetchLinkedinDataSourcesStatus = useCallback(async (): Promise<{
    linkedinUnipileConnected: boolean;
    apifyActorConfigured: boolean;
    pythonOrgChartAgentAvailable: boolean;
  } | null> => {
    const serverBaseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!serverBaseUrl.trim() || !accessToken) {
      return null;
    }
    try {
      const res = await fetch(
        `${serverBaseUrl.replace(/\/$/, '')}/org-chart/linkedin-data-sources-status`,
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
  }, [accessToken]);

  const executeOrgchartSearch = async (params: {
    mode: OrgchartSearchMode;
    origin:
      | 'node'
      | 'background'
      | 'header'
      | 'doubleClick'
      | 'view_all_candidates';
    node?: OrgChartNodeData;
    country?: string;
    functionRoot?: string;
    /** Required when mode is business_division_map */
    businessDivisionRawQuery?: string;
  }) => {
    if (!companyId) return;

    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!baseUrl) return;

    if (!accessToken) {
      enqueueSnackBar('Sign in to run org chart search.', {
        variant: SnackBarVariant.Error,
        duration: 6000,
      });
      return;
    }

    const prereqStatus = await fetchLinkedinDataSourcesStatus();
    if (prereqStatus !== null) {
      if (orgChartLinkedinCandidateSource === 'apify') {
        if (prereqStatus.apifyActorConfigured !== true) {
          enqueueSnackBar(APIFY_SOURCE_UNAVAILABLE_SNACKBAR, {
            variant: SnackBarVariant.Error,
            duration: 8000,
          });
          return;
        }
      } else if (prereqStatus.linkedinUnipileConnected !== true) {
        enqueueSnackBar(LINKEDIN_UNIPILE_SOURCE_UNAVAILABLE_SNACKBAR, {
          variant: SnackBarVariant.Error,
          duration: 8000,
        });
        return;
      }
      if (!prereqStatus.pythonOrgChartAgentAvailable) {
        enqueueSnackBar(ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR, {
          variant: SnackBarVariant.Error,
          duration: 10000,
        });
        return;
      }
    }

    const mode = params.mode;
    const node = params.node;

    if (mode === 'business_division_map') {
      const raw = params.businessDivisionRawQuery?.trim() ?? '';
      if (!raw) {
        enqueueSnackBar(
          'Describe the business division you want to map (e.g. textile machinery team).',
          { variant: SnackBarVariant.Warning, duration: 6000 },
        );
        return;
      }
    }

    if (
      orgChartLinkedinCandidateSource === 'apify' &&
      mode !== 'entire_company' &&
      mode !== 'all_people'
    ) {
      enqueueSnackBar(APIFY_MODE_UNSUPPORTED_SNACKBAR, {
        variant: SnackBarVariant.Error,
        duration: 10000,
      });
      return;
    }
    const isHeaderOrgChartRequest =
      params.origin === 'header' &&
      (mode === 'entire_company' ||
        mode === 'function_grade' ||
        mode === 'business_division_map');

    let title: string;
    switch (mode) {
      case 'current_node':
        title = 'Get people in this position';
        break;
      case 'selected_nodes':
        title = 'Get all selected positions';
        break;
      case 'leadership':
        title = 'Get all leadership in this company';
        break;
      case 'entire_company':
      case 'all_people':
        title = 'Get all names in this company';
        break;
      case 'function_grade':
        title = 'Get all names in this function';
        break;
      case 'business_division_map':
        title = 'Map business division';
        break;
      default:
        title = 'Get all names in this function';
        break;
    }

    if (mode === 'function_grade' && node) {
      setSelectedNodeFunction(
        (node as Record<string, unknown>).std_function as string | undefined,
      );
      setSelectedNodeGrade(
        (node as Record<string, unknown>).std_grade as string | undefined,
      );
    }

    if (!isHeaderOrgChartRequest) {
      setIsContextModalOpen(true);
      setContextModalTitle(title);
      setContextModalMode(mode);
      setBooleanKeywordsString(null);
      setContextResults([]);
      setContextProgressMessage('Starting search...');
      setContextProgressPage(null);
      setContextProgressTotalPages(null);
      setContextProgressTotalCandidates(null);
    }

    setIsContextLoading(true);
    setContextLoadingStartedAt(Date.now());
    setContextError(null);

    const requestId = createOrgChartRequestId();
    setActiveOrgChartRequestId(requestId);
    orgchartAbortControllerRef.current = new AbortController();

    const jobTitles: string[] = [];
    if (node) {
      for (let i = 0; i < 8; i += 1) {
        const key = `title_${i}` as keyof OrgChartNodeData;
        const value = node[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          jobTitles.push(value.trim());
        }
      }
    }

    const resolvedCompanyName = companyName ?? companyId;
    const divisionRaw = params.businessDivisionRawQuery?.trim() ?? '';
    const baseRequirement =
      mode === 'business_division_map'
        ? `Map business division at ${resolvedCompanyName}. User request: ${divisionRaw}`
        : mode === 'leadership'
          ? `Find leadership roles at ${resolvedCompanyName}.`
          : mode === 'entire_company' || mode === 'all_people'
            ? `Find all people currently working at ${resolvedCompanyName}.`
            : mode === 'function_grade'
              ? `Find people at ${resolvedCompanyName} in similar functions and seniority.`
              : `Find people in the same position at ${resolvedCompanyName}.`;

    const titlesRequirement =
      jobTitles.length > 0 ? ` Key titles: ${jobTitles.join(', ')}.` : '';

    const filterParts: string[] = [];
    if (params.country) {
      filterParts.push(`located in ${params.country}`);
    }
    if (params.functionRoot) {
      filterParts.push(`working in the ${params.functionRoot} function`);
    }
    const filtersRequirement =
      params.origin === 'view_all_candidates' && filterParts.length > 0
        ? ` Focus on people ${filterParts.join(' and ')}.`
        : '';

    const requirement = `${baseRequirement}${titlesRequirement}${filtersRequirement}`;

    const trimmedLinkedinCompanyUrl = linkedinCompanyUrl?.trim();
    const useUnipileSource = orgChartLinkedinCandidateSource === 'unipile';
    const body = {
      rawQuery: requirement,
      cleanedQuery: requirement,
      companyName: companyName ?? undefined,
      companyId,
      jobTitles,
      mode,
      searchType: 'classic' as const,
      requestId,
      country: params.country,
      functionRoot: params.functionRoot,
      candidateSource: orgChartLinkedinCandidateSource,
      ...(trimmedLinkedinCompanyUrl
        ? { linkedinCompanyUrl: trimmedLinkedinCompanyUrl }
        : {}),
      ...(useUnipileSource && linkedinUnipileAccountId?.trim()
        ? { linkedinUnipileAccountId: linkedinUnipileAccountId.trim() }
        : {}),
      ...(divisionRaw ? { businessDivisionRawQuery: divisionRaw } : {}),
    };

    try {
      if (useUnipileSource) {
        const currentUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}${window.location.search}`;
        const ensureRes = await fetch(
          `${baseUrl}/linkedin-unipile/org-chart/ensure-account`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              success_redirect_url: currentUrl,
              failure_redirect_url: currentUrl,
            }),
          },
        );
        if (!ensureRes.ok) {
          throw new Error(`Ensure account failed with status ${ensureRes.status}`);
        }
        const ensureJson = (await ensureRes.json()) as
          | { accountId?: string }
          | { redirectUrl?: string }
          | { status: 'pool_full'; slotsUsed: number; maxSlots: number };
        if ('redirectUrl' in ensureJson && ensureJson.redirectUrl) {
          window.location.href = ensureJson.redirectUrl;
          return;
        }
        if ('status' in ensureJson && ensureJson.status === 'pool_full') {
          enqueueSnackBar(
            "Please try again in 5 mins. We're at capacity and should free up shortly.",
            { variant: SnackBarVariant.Warning },
          );
          setIsContextLoading(false);
          return;
        }
      }

      if (mode === 'entire_company') {
        const employeeSuffix =
          typeof employeeCount === 'number'
            ? ` (${employeeCount.toLocaleString()} employees)`
            : '';
        enqueueSnackBar(
          `Generating full org chart for ${resolvedCompanyName}${employeeSuffix}...`,
          {
            variant: SnackBarVariant.Info,
            showProgressBar: true,
            dedupeKey: `orgchart-entire-company-${companyId}`,
          },
        );
      }

      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const searchUrl = new URL(`${normalizedBaseUrl}/org-chart/search`);
      if (useUnipileSource && linkedinUnipileAccountId?.trim()) {
        searchUrl.searchParams.set(
          'account_id',
          linkedinUnipileAccountId.trim(),
        );
      }
      const response = await fetch(searchUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: orgchartAbortControllerRef.current?.signal,
      });

      const json = await response.json();

      if (!response.ok) {
        // If there is a string message for an error, prefer it; otherwise try serializing the json
        let serverMessage: string;
        if (json && typeof json === "object" && typeof json.message === "string") {
          serverMessage = json.message;
        } else if (typeof json === 'string') {
          serverMessage = json;
        } else {
          serverMessage = `Request failed with status ${response.status}`;
        }
        // eslint-disable-next-line no-console
        console.log("json::", json);
        throw new Error(serverMessage);
      }

      const rawItems = Array.isArray(json.items) ? json.items : [];
      const normalized = rawItems.map((item: Record<string, unknown>, index: number) =>
        normalizeCandidateItem(item, index),
      );

      const orgChartErrorFromResponse =
        json &&
        typeof json === 'object' &&
        typeof (json as { orgChartError?: unknown }).orgChartError === 'string'
          ? (json as { orgChartError: string }).orgChartError.trim()
          : '';

      if (orgChartErrorFromResponse.length > 0) {
        setContextError(orgChartErrorFromResponse);
        setContextProgressMessage(null);
        setContextProgressPage(null);
        setContextProgressTotalPages(null);
        setContextProgressTotalCandidates(null);
        enqueueSnackBar(orgChartErrorFromResponse, {
          variant: SnackBarVariant.Error,
          dedupeKey: requestId
            ? `orgchart-request-error-${requestId}`
            : undefined,
          duration: 8000,
        });
        if (mode === 'entire_company' && companyId) {
          closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        }
      }

      if (!isHeaderOrgChartRequest) {
        setContextResults(normalized);
      }

      if (
        (mode === 'entire_company' ||
          mode === 'function_grade' ||
          mode === 'business_division_map') &&
        json.orgChart
      ) {
        setLatestOrgChart(json.orgChart);
        if (isHeaderOrgChartRequest) {
          setIsContextModalOpen(false);
        }
        Mixpanel.track('org_chart_create', { companyId });
        closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        const cacheText = json.isCached
          ? 'served from cache'
          : 'generated and cached';

        enqueueSnackBar(
          mode === 'business_division_map'
            ? `Business division org chart ready for ${resolvedCompanyName} (${rawItems.length} people).`
            : `Org chart ${cacheText} for ${resolvedCompanyName} (${rawItems.length} people)`,
          {
            variant: SnackBarVariant.Success,
            dedupeKey: `orgchart-entire-company-${companyId}-done`,
            duration: 4000,
          },
        );
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        // eslint-disable-next-line no-console
        console.error(err);
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch candidates';
        setContextError(errorMessage);
        setContextProgressMessage(null);
        setContextProgressPage(null);
        setContextProgressTotalPages(null);
        setContextProgressTotalCandidates(null);
        if (
          mode === 'entire_company' ||
          mode === 'function_grade' ||
          mode === 'business_division_map'
        ) {
          closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        }
        enqueueSnackBar(errorMessage, {
          variant: SnackBarVariant.Error,
          dedupeKey:
            companyId &&
            (mode === 'entire_company' ||
              mode === 'function_grade' ||
              mode === 'business_division_map')
              ? `orgchart-entire-company-${companyId}-error`
              : undefined,
          duration: 6000,
        });
      } else {
        setContextError('Search stopped.');
        setContextProgressMessage(null);
      }
    } finally {
      orgchartAbortControllerRef.current = null;
      if (
        mode === 'entire_company' ||
        mode === 'function_grade' ||
        mode === 'business_division_map'
      ) {
        closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
      }
      setIsContextLoading(false);
    }
  };

  const cancelOrgchartSearch = useCallback(() => {
    const requestId = activeOrgChartRequestId;
    if (requestId) {
      const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
      if (baseUrl && accessToken) {
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        fetch(`${normalizedBaseUrl}/org-chart/search/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ requestId }),
        }).catch(() => {});
      }
      orgchartAbortControllerRef.current?.abort();
    }
    setContextProgressMessage('Stopping search...');
  }, [activeOrgChartRequestId, accessToken]);

  const handleNodeContextAction = async (
    action: OrgChartContextAction,
    node: OrgChartNodeData,
  ) => {
    if (action === 'delete_company_cache') {
      return;
    }

    if (
      action === 'add_to_job_and_send_invite' ||
      action === 'add_to_job_and_invite_to_job'
    ) {
      setAddToJobNode(node);
      setSelectedNodeFunction(
        (node as Record<string, unknown>).std_function as string | undefined,
      );
      setSelectedNodeGrade(
        (node as Record<string, unknown>).std_grade as string | undefined,
      );
      setAddToJobQueueStartChat(true);
      setIsAddToJobModalOpen(true);
      return;
    }

    if (action === 'boolean_keywords') {
      const booleanStr = buildBooleanKeywordsForNode(node, companyName);
      setBooleanKeywordsString(booleanStr);
      setContextModalTitle('Boolean keywords string');
      setContextModalMode(action);
      setContextResults([]);
      setContextError(null);
      setIsContextLoading(false);
      setIsContextModalOpen(true);
      return;
    }

    if (action === 'similar_companies') {
      await executeOrgchartSearch({
        mode: 'function_grade',
        origin: 'node',
        node,
      });
      setContextModalTitle('Get similar names in similar companies');
      return;
    }

    const modeMap: Record<OrgChartContextAction, OrgchartSearchMode> = {
      current_node: 'current_node',
      leadership: 'leadership',
      entire_company: 'entire_company',
      delete_company_cache: 'entire_company',
      all_people: 'all_people',
      function_grade: 'function_grade',
      business_division_map: 'business_division_map',
      selected_nodes: 'selected_nodes',
      boolean_keywords: 'current_node',
      similar_companies: 'function_grade',
      add_to_job_and_send_invite: 'current_node',
      add_to_job_and_invite_to_job: 'current_node',
    };

    const mappedMode = modeMap[action];
    await executeOrgchartSearch({
      mode: mappedMode,
      origin: 'node',
      node,
    });
  };

  const handleBackgroundContextAction = async (
    action: OrgChartContextAction,
  ) => {
    if (action === 'delete_company_cache') {
      if (!companyId) {
        enqueueSnackBar('No company selected.', {
          variant: SnackBarVariant.Warning,
          duration: 5000,
        });
        return;
      }
      const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
      if (!baseUrl.trim()) {
        enqueueSnackBar('Server URL is not configured.', {
          variant: SnackBarVariant.Error,
          duration: 6000,
        });
        return;
      }
      if (!accessToken) {
        enqueueSnackBar('Sign in to clear org chart cache.', {
          variant: SnackBarVariant.Error,
          duration: 6000,
        });
        return;
      }
      const label = companyName?.trim() || companyId;
      try {
        await clearCompanyOrgChartCacheRequest({
          baseUrl,
          accessToken,
          companyId,
          companyName: companyName ?? undefined,
        });
        enqueueSnackBar(`Cleared org chart cache for ${label}`, {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        setLatestOrgChart(null);
      } catch (error) {
        enqueueSnackBar(
          error instanceof Error ? error.message : 'Failed to clear cache',
          { variant: SnackBarVariant.Error, duration: 8000 },
        );
      }
      return;
    }

    if (action === 'leadership') {
      await executeOrgchartSearch({
        mode: 'leadership',
        origin: 'background',
      });
      return;
    }

    await executeOrgchartSearch({
      mode: 'entire_company',
      origin: 'background',
    });
  };

  const buildCandidatesFromNode = (n: OrgChartNodeData): ContextResultItem[] => {
    const rows: ContextResultItem[] = [];
    for (let i = 0; i < 16; i += 1) {
      const nameKey = `name_${i}` as keyof OrgChartNodeData;
      const titleKey = `title_${i}` as keyof OrgChartNodeData;
      const linkedinKey = `linkedin_url_${i}` as keyof OrgChartNodeData;
      const imageKey = `image_${i}` as keyof OrgChartNodeData;
      const name = n[nameKey];
      if (typeof name === 'string' && name.trim().length > 0) {
        const image = n[imageKey];
        rows.push({
          id: `${i}`,
          fullName: name.trim(),
          headline: (typeof n[titleKey] === 'string' ? n[titleKey] : '') as string,
          company: companyName ?? '',
          linkedinUrl:
            typeof n[linkedinKey] === 'string'
              ? (n[linkedinKey] as string)
              : undefined,
          raw:
            typeof image === 'string'
              ? { image, profile_picture_url: image }
              : {},
        });
      }
    }
    return rows;
  };

  const handleNodeDoubleClick = async (node: OrgChartNodeData) => {
    setSelectedNodeForDetails(node);
    setSelectedNodeFunction(
      (node as Record<string, unknown>).std_function as string | undefined,
    );
    setSelectedNodeGrade(
      (node as Record<string, unknown>).std_grade as string | undefined,
    );
    setNodeDetailError(null);

    const nodeKey = typeof node.key === 'number' ? node.key : undefined;
    const nodeRecord = node as Record<string, unknown>;
    const allCandidates = nodeRecord.allCandidates;
    const totalPeople =
      typeof node.total_people === 'number'
        ? node.total_people
        : typeof node.total_people === 'string'
          ? parseInt(String(node.total_people), 10)
          : 0;
    const hasPartialList =
      Array.isArray(allCandidates) &&
      allCandidates.length > 0 &&
      totalPeople > allCandidates.length;
    const isActive = node.nodeState === 'active';

    // eslint-disable-next-line no-console
    console.log('[orgchart/handleNodeDoubleClick]', {
      headline: node.headline,
      key: node.key,
      nodeState: node.nodeState,
      totalPeople,
      allCandidatesLength: Array.isArray(allCandidates)
        ? allCandidates.length
        : null,
      hasPartialList,
    });

    if (
      Array.isArray(allCandidates) &&
      allCandidates.length > 0 &&
      !hasPartialList
    ) {
      const results = allCandidates.map((candidate, index) =>
        normalizeCandidateItem(
          {
            ...(candidate as Record<string, unknown>),
            company:
              ((candidate as Record<string, unknown>).job_company_name as
                | string
                | undefined) ??
              companyName ??
              '',
            linkedin_url:
              ((candidate as Record<string, unknown>).std_linkedin_url as
                | string
                | undefined) ??
              ((candidate as Record<string, unknown>).linkedin_url as
                | string
                | undefined),
          },
          index,
        ),
      );
      setNodeDetailResults(results);
      if (nodeKey !== undefined) {
        setEnrichedNodes((prev) => ({
          ...prev,
          [nodeKey]: { people: results, nodeState: 'active' },
        }));
      }
      setIsNodeDetailLoading(false);
      return;
    }

    if (isActive && !hasPartialList) {
      const cached =
        nodeKey !== undefined ? enrichedNodes[nodeKey]?.people : undefined;
      const results =
        cached && cached.length > 0
          ? cached
          : buildCandidatesFromNode(node);
      setNodeDetailResults(results);
      setIsNodeDetailLoading(false);
      return;
    }

    setIsNodeDetailLoading(true);
    setNodeDetailResults([]);

    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!baseUrl || !companyId) {
      setIsNodeDetailLoading(false);
      return;
    }

    try {
      const body = {
        companyName: companyName ?? undefined,
        website: website ?? undefined,
        stdFunction:
          (node as Record<string, unknown>).std_function as string | undefined,
        stdGrade:
          (node as Record<string, unknown>).std_grade as string | undefined,
        country: node.country ?? undefined,
        limit: hasPartialList
          ? Math.min(Math.max(totalPeople, 50), 500)
          : 50,
      };

      const canonicalCompanyId = normalizeCompanyIdForUrl(companyId);
      const response = await fetch(
        `${baseUrl}/org-chart/${encodeURIComponent(canonicalCompanyId)}/node-people`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const json = (await response.json()) as {
        status?: string;
        items?: Array<Record<string, unknown>>;
        itemCount?: number;
      };

      const rawItems = Array.isArray(json.items) ? json.items : [];
      const normalized = rawItems.map((item, index) =>
        normalizeCandidateItem(item, index),
      );
      setNodeDetailResults(normalized);

      if (nodeKey !== undefined) {
        setEnrichedNodes((prev) => ({
          ...prev,
          [nodeKey]: {
            people: normalized,
            nodeState: 'active',
          },
        }));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setNodeDetailError(
        err instanceof Error ? err.message : 'Failed to fetch people for node',
      );
    } finally {
      setIsNodeDetailLoading(false);
    }
  };

  const closeContextModal = () => {
    setIsContextModalOpen(false);
    setContextResults([]);
    setContextError(null);
    setBooleanKeywordsString(null);
    setContextModalMode(null);
    setContextLoadingStartedAt(null);
    setActiveOrgChartRequestId(null);
    setContextProgressMessage(null);
    setContextProgressPage(null);
    setContextProgressTotalPages(null);
    setContextProgressTotalCandidates(null);
  };

  const clearLatestOrgChart = useCallback(() => {
    setLatestOrgChart(null);
  }, []);

  const applyOrgChartOverride = useCallback(
    (chart: Record<string, unknown> | null) => {
      setLatestOrgChart(chart);
    },
    [],
  );

  const downloadContextResultsAsCsv = () => {
    if (!contextResults.length) return;
    exportContextResultsToCsv(contextResults, 'orgchart-candidates.csv');
  };

  const handleDownloadNode = (node: OrgChartNodeData) => {
    const nodeKey = typeof node.key === 'number' ? node.key : undefined;
    const enriched = nodeKey !== undefined ? enrichedNodes[nodeKey] : undefined;

    const rows: ContextResultItem[] = [];
    if (enriched?.people?.length) {
      enriched.people.forEach((p) => {
        rows.push({
          ...p,
          company: (p.company || companyName) ?? '',
        });
      });
    } else {
      for (let i = 0; i < 4; i += 1) {
        const nameKey = `name_${i}` as keyof OrgChartNodeData;
        const titleKey = `title_${i}` as keyof OrgChartNodeData;
        const linkedinKey = `linkedin_url_${i}` as keyof OrgChartNodeData;
        const name = node[nameKey];
        if (typeof name === 'string' && name.trim().length > 0) {
          rows.push({
            id: `${i}`,
            fullName: name.trim(),
            headline: (typeof node[titleKey] === 'string'
              ? node[titleKey]
              : '') as string,
            company: companyName ?? '',
            linkedinUrl:
              typeof node[linkedinKey] === 'string'
                ? (node[linkedinKey] as string)
                : undefined,
            raw: {},
          });
        }
      }
    }

    if (!rows.length) return;
    exportContextResultsToCsv(rows, 'orgchart-node-details.csv');
  };

  const handleSimilarPeople = (node: OrgChartNodeData) => {
    executeOrgchartSearch({
      mode: 'function_grade',
      origin: 'node',
      node,
    });
  };

  const downloadNodeDetailsAsCsv = () => {
    const sourceResults =
      nodeDetailResults.length > 0 && !nodeDetailError
        ? nodeDetailResults
        : null;

    const rows: ContextResultItem[] = [];
    if (sourceResults) {
      sourceResults.forEach((item) => {
        rows.push({
          ...item,
          company: (item.company || companyName) ?? '',
        });
      });
    } else {
      const node = selectedNodeForDetails;
      if (!node) return;

      for (let i = 0; i < 16; i += 1) {
        const nameKey = `name_${i}` as keyof OrgChartNodeData;
        const titleKey = `title_${i}` as keyof OrgChartNodeData;
        const name = node[nameKey];
        const title = node[titleKey];
        if (typeof name === 'string' && name.trim().length > 0) {
          rows.push({
            id: `${i}`,
            fullName: name.trim(),
            headline: typeof title === 'string' ? title.trim() : '',
            company: companyName ?? '',
            raw: {},
          });
        }
      }
    }

    if (!rows.length) return;
    exportContextResultsToCsv(rows, 'orgchart-node-details.csv');
  };

  const closeNodeDetailModal = () => setSelectedNodeForDetails(null);

  return {
    enrichedNodes,
    setEnrichedNodes,

    isContextModalOpen,
    contextModalTitle,
    contextModalMode,
    isContextLoading,
    contextLoadingStartedAt,
    contextError,
    contextResults,
    contextProgressMessage,
    contextProgressPage,
    contextProgressTotalPages,
    contextProgressTotalCandidates,
    booleanKeywordsString,
    closeContextModal,
    clearLatestOrgChart,
    applyOrgChartOverride,
    downloadContextResultsAsCsv,
    executeOrgchartSearch,
    cancelOrgchartSearch,

    selectedNodeForDetails,
    isNodeDetailLoading,
    nodeDetailError,
    nodeDetailResults,
    closeNodeDetailModal,
    downloadNodeDetailsAsCsv,

    handleNodeContextAction,
    handleBackgroundContextAction,
    handleNodeDoubleClick,
    handleDownloadNode,
    handleSimilarPeople,

    latestOrgChart,

    isAddToJobModalOpen,
    addToJobNode,
    addToJobQueueStartChat,
    closeAddToJobModal,

    isAddResultsToJobModalOpen,
    addResultsToJobResults,
    addResultsToJobContext,
    openAddResultsToJobModal,
    closeAddResultsToJobModal,

    selectedNodeFunction,
    selectedNodeGrade,
  };
};

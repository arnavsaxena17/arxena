import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { useRecoilValue, useSetRecoilState } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';
import { OutreachChannelKey } from '@/orgchart/constants/outreachTemplates';
import { useOrgChartsRefetch } from '@/orgchart/hooks/useOrgChartsRefetch';
import { orgChartContactsByKeyState } from '@/orgchart/states/orgChartContactsByKeyState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { orgChartQueryGeneratorPreferenceState } from '@/orgchart/states/orgChartQueryGeneratorPreferenceState';
import { isOrgChartM7kqCandidateSource } from '@/orgchart/utils/isOrgChartM7kqCandidateSource';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { tryExtensionLinkedinUnipileRecovery } from '@/unipile/utils/linkedinUnipileExtensionBridge';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';
import { Mixpanel } from '~/mixpanel';

import {
    normalizeCompanyIdForUrl,
    OrgChartContextAction,
    OrgChartNodeContextPayload,
} from 'twenty-orgchart';
import {
    isValidLinkedInProfileUrl,
    NodeState,
    OrgChartNodeData,
    OrgchartSearchMode as OrgchartSearchModeValue,
} from 'twenty-shared';
import { ContextResultItem } from '../types';
import {
    buildBooleanKeywordsForNode,
    contextResultItemFromNodePersonSlot,
    exportContextResultsToCsv,
    extractCompanyDomainFromWebsite,
    normalizeCandidateItem,
} from '../utils/orgChartUtils';

const OUTREACH_ACTION_TO_CHANNEL: Partial<
  Record<OrgChartContextAction, OutreachChannelKey>
> = {
  outreach_linkedin_invite: 'linkedin_invite',
  outreach_whatsapp: 'whatsapp',
  outreach_google_contact: 'google_contact',
  outreach_email: 'email',
};

/** Subset of {@link OrgChartContextAction} used for org-chart search API `mode`. */
type OrgchartSearchMode = Extract<
  OrgChartContextAction,
  OrgchartSearchModeValue
>;

export type UseOrgChartActionsParams = {
  companyId: string;
  companyName?: string;
  website?: string;
  employeeCount?: number | null;
  /** Raw industry label (e.g. "Computer Software") to help Python remap functions. */
  industry?: string;
  /** Optional macro industry category override for Python (e.g. "computer software"). */
  industryCategory?: string;
  /** Optional MonthYear snapshot filter (YYYY-MM). Threaded to org-chart build/search endpoints. */
  asOfMonth?: string;
  /**
   * Preview template nodes cannot load per-position people until a full chart exists.
   * When set, double-click / “Get people in this position” on a preview node invokes this instead of fetching.
   */
  onPreviewNodePeopleRequest?: (node: OrgChartNodeData) => void;
  /** Canonical LinkedIn company URL for org-chart search + Python pipeline (e.g. https://www.linkedin.com/company/briskpe/) */
  linkedinCompanyUrl?: string;
  /** When true, Apify org chart builds should fetch both current and past employees. */
  includeOrgIntelligence?: string;
  /**
   * Unipile LinkedIn account id for this search (sent as `?account_id=` like linkedin-search).
   * Prefer workspace-linked account; use for local/testing via env if needed.
   */
  linkedinUnipileAccountId?: string;
  /**
   * Current business-division text from the org chart toolbar. Merged into every
   * `executeOrgchartSearch` call unless the call passes `businessDivisionRawQuery` explicitly
   * (per-call wins). Enables context-menu and background actions to use the same intent as header.
   */
  businessDivisionRawQuery?: string;
};

type OrgChartSearchProgressEvent = {
  event?: 'status' | 'paginationInfo' | 'pageResults' | 'complete' | 'error';
  requestId?: string;
  mode?: string;
  companyName?: string;
  data?: {
    message?: string;
    creditsNeeded?: number;
    creditsAvailable?: number;
    page?: number;
    engine?: string;
    candidateSource?: string;
    itemCount?: number;
    items?: Record<string, unknown>[];
    orgChart?: Record<string, unknown>;
    totalPages?: number;
    totalCandidates?: number;
    totalCount?: number;
    candidatesReceived?: number;
    candidatesCollectedSoFar?: number;
    remainingToFetch?: number;
  };
};

const formatInsufficientOrgChartCreditsMessage = (input: {
  message?: string;
  creditsNeeded?: number;
  creditsAvailable?: number;
}): string => {
  const hasNeeded = typeof input.creditsNeeded === 'number';
  const hasAvailable = typeof input.creditsAvailable === 'number';

  if (hasNeeded && hasAvailable) {
    return `Insufficient org chart credits. Available ${input.creditsAvailable}, needed ${input.creditsNeeded}.`;
  }

  if (typeof input.message === 'string' && input.message.trim().length > 0) {
    return input.message;
  }

  return 'Organization chart request failed.';
};

const formatOrgChartTransportErrorMessage = (message: string): string => {
  const normalized = message.trim();
  const isRateLimited =
    /status\s*code\s*429/i.test(normalized) ||
    /status\s*429/i.test(normalized) ||
    /too many requests/i.test(normalized) ||
    /maximum number of api calls/i.test(normalized);

  if (isRateLimited) {
    return 'Rate limited by Apollo. Please retry later or upgrade your Apollo plan.';
  }

  return normalized;
};

const createOrgChartRequestId = () =>
  `orgchart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const collectJobTitlesFromOrgChartNode = (n: OrgChartNodeData): string[] => {
  const titles: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const key = `title_${i}` as keyof OrgChartNodeData;
    const value = n[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      titles.push(value.trim());
    }
  }
  return titles;
};

const uniqueConcatJobTitleListsPreservingOrder = (
  lists: string[][],
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const t of list) {
      const k = t.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(t);
      }
    }
  }
  return out;
};

const LINKEDIN_UNIPILE_SOURCE_UNAVAILABLE_SNACKBAR =
  'LinkedIn (Unipile) is not connected. Open linkedin.com in this browser so the Arx extension can sync your session, then try again. You can also switch the org chart data source to Apify or LinkedIn x-ray in the jobs menu.';

const APIFY_SOURCE_UNAVAILABLE_SNACKBAR =
  'Apify is not configured for org chart. Set APIFY_API_TOKEN on the server or choose LinkedIn (Unipile) in the jobs menu.';

const LINKEDIN_XRAY_SOURCE_UNAVAILABLE_SNACKBAR =
  'LinkedIn x-ray is not configured for org chart. Set BRIGHT_DATA_API_KEY on the server or choose LinkedIn (Unipile) in the jobs menu.';

const APIFY_MODE_UNSUPPORTED_SNACKBAR =
  'Apify org chart data source is only available for full company searches. Switch to LinkedIn (Unipile) for business division mapping, function filters, or other advanced modes.';

const ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR =
  'Contact Support. Org chart agent service is not available. Ensure the Python service is running and reachable.';

const ORG_CHART_PROGRESS_UPDATES_TIMEOUT_MS = 240_000;

const ORG_CHART_PROGRESS_UPDATES_TIMEOUT_SNACKBAR =
  'Backend progress updates were not received. Please retry. If this keeps happening, check that the org chart worker, Python service, and progress stream are running.';

type ContactEnrichmentFetchPayload = {
  emails?: string[];
  phones?: string[];
  source?: string;
  linkedinUrl?: string;
  fullName?: string;
  jobId?: string;
};

const mergeM7kqEnrichmentIntoPeople = (
  people: ContextResultItem[],
  personId: string,
  payload: ContactEnrichmentFetchPayload,
  wantEmail: boolean,
  wantPhone: boolean,
): ContextResultItem[] => {
  const nextEmail =
    wantEmail && Array.isArray(payload.emails) && payload.emails.length > 0
      ? payload.emails[0]
      : undefined;
  const nextPhone =
    wantPhone && Array.isArray(payload.phones) && payload.phones.length > 0
      ? payload.phones[0]
      : undefined;

  return people.map((p) => {
    if (p.id !== personId) {
      return p;
    }
    const payloadLinkedinUrl =
      typeof payload.linkedinUrl === 'string' && payload.linkedinUrl.trim()
        ? payload.linkedinUrl.trim()
        : undefined;
    const payloadFullName =
      typeof payload.fullName === 'string' && payload.fullName.trim()
        ? payload.fullName.trim()
        : undefined;
    return {
      ...p,
      fullName:
        payloadFullName &&
        (p.fullName.trim().length === 0 ||
          /^(x+|xy+|unknownlinkedinmember)$/iu.test(
            p.fullName.replace(/\s+/g, ''),
          ))
          ? payloadFullName
          : p.fullName,
      linkedinUrl: payloadLinkedinUrl ?? p.linkedinUrl,
      email: nextEmail ?? p.email,
      phone: nextPhone ?? p.phone,
      raw: {
        ...p.raw,
        ...(Array.isArray(payload.emails)
          ? { m7kq_enrichment_emails: payload.emails }
          : {}),
        ...(Array.isArray(payload.phones)
          ? { m7kq_enrichment_phones: payload.phones }
          : {}),
      },
    };
  });
};

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
  industry,
  industryCategory,
  asOfMonth,
  includeOrgIntelligence,
  onPreviewNodePeopleRequest,
  linkedinCompanyUrl,
  linkedinUnipileAccountId,
  businessDivisionRawQuery: businessDivisionRawQueryFromToolbar,
}: UseOrgChartActionsParams) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;
  const setContactsByKey = useSetRecoilState(orgChartContactsByKeyState);
  const orgChartLinkedinCandidateSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const orgChartQueryGeneratorPreference = useRecoilValue(
    orgChartQueryGeneratorPreferenceState,
  );
  const orgChartLinkedInSearchType = useRecoilValue(
    orgChartLinkedInSearchTypeState,
  );
  const {
    enqueueSnackBar,
    updateSnackBarByDedupeKey,
    closeSnackBarByDedupeKey,
  } = useSnackBar();
  const INSUFFICIENT_CONTACT_CREDITS_SNACKBAR =
    'You’re out of contact credits. Add credits to continue.';
  const { triggerOrgChartsRefetch } = useOrgChartsRefetch();
  const triggerOrgChartsRefetchRef = useRef(triggerOrgChartsRefetch);
  triggerOrgChartsRefetchRef.current = triggerOrgChartsRefetch;
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
  const progressUpdateTimeoutRef = useRef<number | null>(null);
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

  const [latestOrgChart, setLatestOrgChart] = useState<Record<
    string,
    unknown
  > | null>(null);
  const debouncedSetLatestOrgChart = useDebouncedCallback(
    (next: Record<string, unknown>) => {
      setLatestOrgChart(next);
    },
    800,
  );

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

  const closeAddToJobModal = useCallback(() => {
    setIsAddToJobModalOpen(false);
    setAddToJobNode(null);
  }, []);

  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
  const [outreachChannel, setOutreachChannel] =
    useState<OutreachChannelKey | null>(null);
  const [outreachContextItem, setOutreachContextItem] =
    useState<ContextResultItem | null>(null);
  const [outreachNode, setOutreachNode] = useState<OrgChartNodeData | null>(
    null,
  );

  const closeOutreachModal = useCallback(() => {
    setIsOutreachModalOpen(false);
    setOutreachChannel(null);
    setOutreachContextItem(null);
    setOutreachNode(null);
  }, []);

  const clearProgressUpdateTimeout = useCallback(() => {
    if (progressUpdateTimeoutRef.current !== null) {
      window.clearTimeout(progressUpdateTimeoutRef.current);
      progressUpdateTimeoutRef.current = null;
    }
  }, []);

  const armProgressUpdateTimeout = useCallback(
    (requestId: string) => {
      clearProgressUpdateTimeout();

      progressUpdateTimeoutRef.current = window.setTimeout(() => {
        setContextError(ORG_CHART_PROGRESS_UPDATES_TIMEOUT_SNACKBAR);
        setContextProgressMessage(null);
        setContextProgressPage(null);
        setContextProgressTotalPages(null);
        setContextProgressTotalCandidates(null);
        setIsContextLoading(false);

        if (companyId) {
          closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        }

        enqueueSnackBar(ORG_CHART_PROGRESS_UPDATES_TIMEOUT_SNACKBAR, {
          variant: SnackBarVariant.Error,
          dedupeKey: `orgchart-progress-timeout-${requestId}`,
          duration: 10000,
        });
      }, ORG_CHART_PROGRESS_UPDATES_TIMEOUT_MS);
    },
    [
      clearProgressUpdateTimeout,
      closeSnackBarByDedupeKey,
      companyId,
      enqueueSnackBar,
    ],
  );

  useEffect(() => {
    return () => {
      clearProgressUpdateTimeout();
    };
  }, [clearProgressUpdateTimeout]);

  useWebSocketEvent<OrgChartSearchProgressEvent>(
    'orgchart-search-progress',
    (payload) => {
      if (
        !payload?.requestId ||
        payload.requestId !== activeOrgChartRequestId
      ) {
        return;
      }

      armProgressUpdateTimeout(payload.requestId);

      const eventData = payload.data ?? {};

      const updateSnackBarIfEntireCompany = (message: string) => {
        if (payload.mode === 'entire_company' && companyId) {
          updateSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`, {
            message,
          });
        }
      };

      if (payload.event === 'error') {
        const msg = formatInsufficientOrgChartCreditsMessage({
          message: eventData.message,
          creditsNeeded:
            typeof eventData.creditsNeeded === 'number'
              ? eventData.creditsNeeded
              : undefined,
          creditsAvailable:
            typeof eventData.creditsAvailable === 'number'
              ? eventData.creditsAvailable
              : undefined,
        });
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
        clearProgressUpdateTimeout();
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
          typeof eventData.totalPages === 'number'
            ? eventData.totalPages
            : null;
        const totalCount =
          typeof eventData.totalCount === 'number'
            ? eventData.totalCount
            : null;

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
          typeof eventData.totalPages === 'number'
            ? eventData.totalPages
            : null;
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

      if (payload.event === ('partialOrgChart' as any)) {
        if (eventData.message) {
          setContextProgressMessage(eventData.message);
          updateSnackBarIfEntireCompany(eventData.message);
        }
        const partial = eventData as unknown as {
          message?: string;
          orgChart?: Record<string, unknown>;
          candidateSource?: string;
          dedupedCountSoFar?: number;
          itemCountSoFar?: number;
        };
        if (partial.orgChart && typeof partial.orgChart === 'object') {
          const nextOrgChart: Record<string, unknown> = {
            ...(partial.orgChart as Record<string, unknown>),
          };
          const candidateSourceFromEvent =
            typeof partial.candidateSource === 'string'
              ? partial.candidateSource
              : undefined;
          const itemCountFromEvent =
            typeof partial.dedupedCountSoFar === 'number'
              ? partial.dedupedCountSoFar
              : typeof partial.itemCountSoFar === 'number'
                ? partial.itemCountSoFar
                : undefined;
          if (candidateSourceFromEvent !== undefined) {
            nextOrgChart.candidateSource = candidateSourceFromEvent;
          }
          if (itemCountFromEvent !== undefined) {
            nextOrgChart.itemCount = itemCountFromEvent;
          }
          debouncedSetLatestOrgChart(nextOrgChart);
        }
        return;
      }

      if (payload.event === 'complete') {
        if (eventData.message) {
          setContextProgressMessage(eventData.message);
        }

        const completeItems = Array.isArray(eventData.items)
          ? eventData.items
          : [];

        if (completeItems.length > 0) {
          setContextResults(
            completeItems.map((item: Record<string, unknown>, index: number) =>
              normalizeCandidateItem(item, index),
            ),
          );
        }

        if (eventData.orgChart && typeof eventData.orgChart === 'object') {
          // Merge the top-level response hints (candidateSource, itemCount)
          // into the orgChart object so consumers that read only latestOrgChart
          // (e.g. the m7kq/directory preview banner in ArxOrgChart) can reliably tell
          // which data source produced the chart and how many people were
          // actually fetched — regardless of how the Python build distributes
          // them across nodes.
          const candidateSourceFromEvent =
            typeof eventData.candidateSource === 'string'
              ? eventData.candidateSource
              : undefined;
          const itemCountFromEvent =
            typeof eventData.itemCount === 'number'
              ? eventData.itemCount
              : completeItems.length > 0
                ? completeItems.length
                : undefined;
          const nextOrgChart: Record<string, unknown> = {
            ...(eventData.orgChart as Record<string, unknown>),
          };
          if (candidateSourceFromEvent !== undefined) {
            nextOrgChart.candidateSource = candidateSourceFromEvent;
          }
          if (itemCountFromEvent !== undefined) {
            nextOrgChart.itemCount = itemCountFromEvent;
          }
          setLatestOrgChart(nextOrgChart);
        }

        // Refresh the left nav "Org Charts" section so any newly-persisted
        // orgChart CRM row appears immediately (mirrors the jobs refetch
        // pattern in JobsNavigationDrawerItems).
        triggerOrgChartsRefetchRef.current();

        if (payload.mode === 'entire_company' && companyId) {
          closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
          const displayCompanyName =
            payload.companyName ?? companyName ?? companyId;
          enqueueSnackBar(
            `Org chart ready for ${displayCompanyName} (${typeof eventData.itemCount === 'number' ? eventData.itemCount : completeItems.length} people)`,
            {
              variant: SnackBarVariant.Success,
              dedupeKey: `orgchart-entire-company-${companyId}-done`,
              duration: 4000,
            },
          );
        }

        setContextError(null);
        setIsContextLoading(false);
        clearProgressUpdateTimeout();
      }
    },
    [
      activeOrgChartRequestId,
      armProgressUpdateTimeout,
      clearProgressUpdateTimeout,
      companyId,
      companyName,
      updateSnackBarByDedupeKey,
      closeSnackBarByDedupeKey,
      enqueueSnackBar,
    ],
  );

  useEffect(() => {
    if (!isContextLoading && activeOrgChartRequestId) {
      clearProgressUpdateTimeout();
      setActiveOrgChartRequestId(null);
    }
  }, [activeOrgChartRequestId, clearProgressUpdateTimeout, isContextLoading]);

  const fetchLinkedinDataSourcesStatus = useCallback(async (): Promise<{
    linkedinUnipileConnected: boolean;
    apifyActorConfigured: boolean;
    linkedinXrayConfigured: boolean;
    m7kqDirectoryApiReady: boolean;
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
        linkedinXrayConfigured?: boolean;
        m7kqDirectoryApiReady?: boolean;
        pythonOrgChartAgentAvailable?: boolean;
      };
      if (json?.status !== 'ok') {
        return null;
      }
      return {
        linkedinUnipileConnected: !!json.linkedinUnipileConnected,
        apifyActorConfigured: !!json.apifyActorConfigured,
        linkedinXrayConfigured: !!json.linkedinXrayConfigured,
        m7kqDirectoryApiReady: !!json.m7kqDirectoryApiReady,
        pythonOrgChartAgentAvailable:
          typeof json.pythonOrgChartAgentAvailable === 'boolean'
            ? json.pythonOrgChartAgentAvailable
            : true,
      };
    } catch {
      return null;
    }
  }, [accessToken]);

  const runM7kqNodeProfileFetchFromContext = useCallback(
    async (
      node: OrgChartNodeData,
      action: 'm7kq_fetch_complete' | 'm7kq_fetch_phone' | 'm7kq_fetch_email',
    ) => {
      const baseUrl = process.env.REACT_APP_SERVER_BASE_URL?.replace(/\/$/, '');
      if (!baseUrl || !accessToken) {
        enqueueSnackBar('Sign in to enrich contact details.', {
          variant: SnackBarVariant.Error,
          duration: 6000,
        });
        return;
      }
      const nodeRecord = node as Record<string, unknown>;
      const nodeWebsite =
        (nodeRecord.companyWebsite as string | undefined) ??
        (nodeRecord.job_company_website as string | undefined) ??
        (nodeRecord.company_website as string | undefined) ??
        (nodeRecord.website as string | undefined);
      const effectiveWebsite = nodeWebsite ?? website;
      const domain = extractCompanyDomainFromWebsite(effectiveWebsite);
      const nodeKey = typeof node.key === 'number' ? node.key : undefined;
      if (nodeKey === undefined) {
        return;
      }
      const list = nodeRecord.allCandidates ?? nodeRecord.candidates;
      if (!Array.isArray(list) || list.length === 0) {
        enqueueSnackBar('No person ids on this node for contact match.', {
          variant: SnackBarVariant.Warning,
          duration: 5000,
        });
        return;
      }
      let wantEmail = true;
      let wantPhone = true;
      if (action === 'm7kq_fetch_phone') {
        wantEmail = false;
        wantPhone = true;
      } else if (action === 'm7kq_fetch_email') {
        wantEmail = true;
        wantPhone = false;
      }
      const coName = companyName ?? '';
      const initialPeople: ContextResultItem[] = list.map((c, index) => {
        if (!c || typeof c !== 'object') {
          return normalizeCandidateItem({}, index);
        }
        const row = c as Record<string, unknown>;
        return normalizeCandidateItem(
          {
            ...row,
            company:
              (row.company as string | undefined) ??
              (row.currentCompany as string | undefined) ??
              coName,
          },
          index,
        );
      });
      const missingLinkedinUrls: string[] = [];
      const missingDomainApolloIds: string[] = [];
      let updatedCount = 0;
      for (const c of list) {
        if (!c || typeof c !== 'object') continue;
        const row = c as Record<string, unknown>;
        const id = row.id;
        if (typeof id !== 'string' || !id.trim()) continue;
        const personId = id.trim();
        const linkedinUrl =
          typeof row.std_linkedin_url === 'string'
            ? row.std_linkedin_url.trim()
            : typeof row.linkedin_url === 'string'
              ? row.linkedin_url.trim()
              : '';
        const canUseLinkedinUrl =
          linkedinUrl.length > 0 && isValidLinkedInProfileUrl(linkedinUrl);
        const canUseApolloIdAndDomain =
          typeof domain === 'string' && domain.trim().length > 0;

        if (!canUseApolloIdAndDomain && !canUseLinkedinUrl) {
          missingLinkedinUrls.push(personId);
          missingDomainApolloIds.push(personId);
          continue;
        }
        const res = await fetch(`${baseUrl}/contact-enrichment/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ...(canUseApolloIdAndDomain
              ? { m7kqPersonId: personId, companyDomain: domain }
              : { linkedinUrl }),
            wantEmail,
            wantPhone,
          }),
        });
        if (!res.ok) {
          let msg = 'Contact match request failed.';
          try {
            const j = (await res.json()) as { message?: string };
            if (typeof j.message === 'string' && j.message.trim()) {
              msg = j.message.trim();
            }
          } catch {
            // ignore non-JSON error body
          }
          if (res.status === 403 || /insufficient contact credits/i.test(msg)) {
            msg = INSUFFICIENT_CONTACT_CREDITS_SNACKBAR;
          }
          enqueueSnackBar(msg, {
            variant: SnackBarVariant.Error,
            duration: 8000,
          });
          return;
        }
        const payload = (await res.json()) as ContactEnrichmentFetchPayload;
        if (typeof payload.jobId === 'string' && payload.jobId.trim() !== '') {
          enqueueSnackBar(
            'Contact match was queued; refresh people on this position after the job completes.',
            { variant: SnackBarVariant.Info, duration: 8000 },
          );
          return;
        }
        // Persist to session cache (Recoil) for modals/UX
        setContactsByKey((prev) => {
          const key =
            typeof domain === 'string' && domain.trim().length > 0
              ? `m7kq:${domain.trim().toLowerCase()}:${personId}`
              : canUseLinkedinUrl
                ? `li:${linkedinUrl}`
                : `id:${personId}`;
          const existing = prev[key] ?? {};
          const email =
            wantEmail && Array.isArray(payload.emails) && payload.emails[0]
              ? payload.emails[0]
              : existing.email;
          const phone =
            wantPhone && Array.isArray(payload.phones) && payload.phones[0]
              ? payload.phones[0]
              : existing.phone;
          const liFromPayload =
            typeof payload.linkedinUrl === 'string' && payload.linkedinUrl.trim()
              ? payload.linkedinUrl.trim()
              : existing.linkedinUrl;
          const fullNameFromPayload =
            typeof payload.fullName === 'string' && payload.fullName.trim()
              ? payload.fullName.trim()
              : existing.fullName;
          return {
            ...prev,
            [key]: {
              ...existing,
              fetched: true,
              ...(email ? { email } : {}),
              ...(phone ? { phone } : {}),
              ...(liFromPayload ? { linkedinUrl: liFromPayload } : {}),
              ...(fullNameFromPayload ? { fullName: fullNameFromPayload } : {}),
            },
          };
        });

        // Persist into stored org chart (Redis/S3) so reloads keep enrichment.
        try {
          const canonicalCompanyId = normalizeCompanyIdForUrl(companyId);
          await fetch(
            `${baseUrl}/org-chart/${encodeURIComponent(
              canonicalCompanyId,
            )}/enrichment/apply`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                companyName,
                ...(typeof domain === 'string' && domain.trim().length > 0
                  ? { m7kqPersonId: personId, companyDomain: domain }
                  : { linkedinUrl }),
                emails: payload.emails,
                phones: payload.phones,
                linkedinUrl: payload.linkedinUrl,
                fullName: payload.fullName,
                source: payload.source,
              }),
            },
          );
        } catch {
          // best-effort; UI should still update
        }

        setEnrichedNodes((prev) => {
          const start =
            prev[nodeKey]?.people?.length && prev[nodeKey]!.people.length > 0
              ? prev[nodeKey]!.people
              : initialPeople;
          const merged = mergeM7kqEnrichmentIntoPeople(
            start,
            personId,
            payload,
            wantEmail,
            wantPhone,
          );
          return {
            ...prev,
            [nodeKey]: { people: merged, nodeState: 'active' },
          };
        });
        const detailForSameNode =
          selectedNodeForDetails !== null &&
          typeof selectedNodeForDetails.key === 'number' &&
          selectedNodeForDetails.key === nodeKey;
        if (detailForSameNode) {
          setNodeDetailResults((rows) =>
            mergeM7kqEnrichmentIntoPeople(
              rows.length > 0 ? rows : initialPeople,
              personId,
              payload,
              wantEmail,
              wantPhone,
            ),
          );
        }
        updatedCount += 1;
      }
      if (updatedCount === 0 && missingLinkedinUrls.length > 0) {
        enqueueSnackBar(
          domain
            ? 'Could not enrich contacts: missing LinkedIn URLs on this node.'
            : 'Could not enrich contacts: missing LinkedIn URLs, and no company website/domain to match by id.',
          { variant: SnackBarVariant.Warning, duration: 7000 },
        );
        return;
      }
      if (updatedCount > 0) {
        enqueueSnackBar('Contact match updated for this org chart position.', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
      } else {
        enqueueSnackBar('No contact rows were updated.', {
          variant: SnackBarVariant.Warning,
          duration: 5000,
        });
      }
    },
    [
      accessToken,
      companyName,
      enqueueSnackBar,
      website,
      selectedNodeForDetails,
      setContactsByKey,
    ],
  );

  const executeOrgchartSearch = async (params: {
    mode: OrgchartSearchMode;
    origin:
      | 'node'
      | 'background'
      | 'header'
      | 'doubleClick'
      | 'view_all_candidates';
    node?: OrgChartNodeData;
    /** For `selected_nodes`: each node’s std labels + titles feed the search body. */
    selectedNodes?: OrgChartNodeData[];
    country?: string;
    functionRoot?: string;
    businessDivisionRawQuery?: string;
    multiSource?: boolean;
    sources?: string[];
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

    let prereqStatus = await fetchLinkedinDataSourcesStatus();
    if (
      prereqStatus !== null &&
      orgChartLinkedinCandidateSource === 'unipile' &&
      prereqStatus.linkedinUnipileConnected !== true
    ) {
      await tryExtensionLinkedinUnipileRecovery({
        accessToken,
        serverBaseUrl: baseUrl,
      });
      prereqStatus = await fetchLinkedinDataSourcesStatus();
    }
    if (prereqStatus !== null) {
      if (orgChartLinkedinCandidateSource === 'apify') {
        if (prereqStatus.apifyActorConfigured !== true) {
          enqueueSnackBar(APIFY_SOURCE_UNAVAILABLE_SNACKBAR, {
            variant: SnackBarVariant.Error,
            duration: 8000,
          });
          return;
        }
      } else if (orgChartLinkedinCandidateSource === 'linkedin_xray') {
        if (prereqStatus.linkedinXrayConfigured !== true) {
          enqueueSnackBar(LINKEDIN_XRAY_SOURCE_UNAVAILABLE_SNACKBAR, {
            variant: SnackBarVariant.Error,
            duration: 8000,
          });
          return;
        }
      } else if (
        orgChartLinkedinCandidateSource === ORG_CHART_CANDIDATE_SOURCE_M7KQ
      ) {
        if (prereqStatus.m7kqDirectoryApiReady !== true) {
          enqueueSnackBar(
            'This org chart source requires the data service to be configured on the server.',
            {
              variant: SnackBarVariant.Error,
              duration: 8000,
            },
          );
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

    const divisionRaw =
      params.businessDivisionRawQuery?.trim() ||
      businessDivisionRawQueryFromToolbar?.trim() ||
      '';

    if (mode === 'business_division_map' && !divisionRaw) {
      enqueueSnackBar(
        'Describe the business division you want to map (e.g. textile machinery team).',
        { variant: SnackBarVariant.Warning, duration: 6000 },
      );
      return;
    }

    if (
      orgChartLinkedinCandidateSource === 'apify' &&
      mode !== 'entire_company'
    ) {
      enqueueSnackBar(APIFY_MODE_UNSUPPORTED_SNACKBAR, {
        variant: SnackBarVariant.Error,
        duration: 10000,
      });
      return;
    }

    if (
      orgChartLinkedinCandidateSource === ORG_CHART_CANDIDATE_SOURCE_M7KQ &&
      mode === 'business_division_map'
    ) {
      enqueueSnackBar(
        'This org chart data source does not support business division mapping.',
        {
          variant: SnackBarVariant.Error,
          duration: 10000,
        },
      );
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

    let jobTitles: string[] = [];
    if (
      mode === 'selected_nodes' &&
      params.selectedNodes &&
      params.selectedNodes.length > 0
    ) {
      jobTitles = uniqueConcatJobTitleListsPreservingOrder(
        params.selectedNodes.map(collectJobTitlesFromOrgChartNode),
      );
    } else if (node) {
      jobTitles = collectJobTitlesFromOrgChartNode(node);
    }

    const selectedNodeStdScopes =
      mode === 'selected_nodes' &&
      params.selectedNodes &&
      params.selectedNodes.length > 0
        ? params.selectedNodes.map((n) => {
            const r = n as Record<string, unknown>;
            return {
              stdFunction:
                typeof r.std_function === 'string' && r.std_function.trim()
                  ? r.std_function.trim()
                  : undefined,
              stdGrade:
                typeof r.std_grade === 'string' && r.std_grade.trim()
                  ? r.std_grade.trim()
                  : undefined,
            };
          })
        : undefined;

    const nodeRecord = node as Record<string, unknown> | undefined;
    const stdFunctionForCurrentNode =
      mode === 'current_node' &&
      nodeRecord &&
      typeof nodeRecord.std_function === 'string' &&
      nodeRecord.std_function.trim()
        ? nodeRecord.std_function.trim()
        : undefined;
    const stdGradeForCurrentNode =
      mode === 'current_node' &&
      nodeRecord &&
      typeof nodeRecord.std_grade === 'string' &&
      nodeRecord.std_grade.trim()
        ? nodeRecord.std_grade.trim()
        : undefined;

    const resolvedCompanyName = companyName ?? companyId;
    const baseRequirement =
      mode === 'business_division_map'
        ? `Map business division at ${resolvedCompanyName}. User request: ${divisionRaw}`
        : mode === 'leadership'
          ? `Find leadership roles at ${resolvedCompanyName}.`
          : mode === 'entire_company'
            ? `Find all people currently working at ${resolvedCompanyName}.`
            : mode === 'function_grade'
              ? `Find people at ${resolvedCompanyName} in similar functions and seniority.`
              : mode === 'selected_nodes'
                ? `Find people for the selected positions at ${resolvedCompanyName}.`
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

    const businessDivisionRequirementSuffix =
      divisionRaw && mode !== 'business_division_map'
        ? ` User business division focus: ${divisionRaw}.`
        : '';

    const requirement = `${baseRequirement}${titlesRequirement}${filtersRequirement}${businessDivisionRequirementSuffix}`;

    const trimmedLinkedinCompanyUrl = linkedinCompanyUrl?.trim();
    const useUnipileSource = orgChartLinkedinCandidateSource === 'unipile';
    const companyDomain = extractCompanyDomainFromWebsite(website);
    const trimmedIndustry =
      typeof industry === 'string' && industry.trim().length > 0
        ? industry.trim()
        : undefined;
    const trimmedIndustryCategory =
      typeof industryCategory === 'string' && industryCategory.trim().length > 0
        ? industryCategory.trim()
        : undefined;
    const trimmedAsOfMonth =
      typeof asOfMonth === 'string' && asOfMonth.trim().length > 0
        ? asOfMonth.trim()
        : undefined;
    const shouldIncludeOrgIntelligence =
      typeof includeOrgIntelligence === 'string' &&
      includeOrgIntelligence.trim().toLowerCase() === 'true';
    const body = {
      rawQuery: requirement,
      cleanedQuery: requirement,
      companyName: companyName ?? undefined,
      companyId,
      jobTitles,
      mode,
      searchType: orgChartLinkedInSearchType,
      requestId,
      country: params.country,
      ...(mode !== 'current_node' && mode !== 'selected_nodes'
        ? { functionRoot: params.functionRoot }
        : {}),
      candidateSource: orgChartLinkedinCandidateSource,
      ...(trimmedIndustry ? { industry: trimmedIndustry } : {}),
      ...(trimmedIndustryCategory
        ? { industryCategory: trimmedIndustryCategory }
        : {}),
      ...(trimmedAsOfMonth ? { asOfMonth: trimmedAsOfMonth } : {}),
      ...(shouldIncludeOrgIntelligence ? { includeOrgIntelligence: true } : {}),
      ...(params.multiSource
        ? {
            multiSource: true,
            sources: Array.isArray(params.sources) ? params.sources : [],
          }
        : {}),
      ...(trimmedLinkedinCompanyUrl
        ? { linkedinCompanyUrl: trimmedLinkedinCompanyUrl }
        : {}),
      ...(companyDomain ? { companyDomain } : {}),
      ...(useUnipileSource && linkedinUnipileAccountId?.trim()
        ? { linkedinUnipileAccountId: linkedinUnipileAccountId.trim() }
        : {}),
      ...(divisionRaw ? { businessDivisionRawQuery: divisionRaw } : {}),
      queryGenerator: orgChartQueryGeneratorPreference,
      ...(stdFunctionForCurrentNode
        ? { stdFunction: stdFunctionForCurrentNode }
        : {}),
      ...(stdGradeForCurrentNode ? { stdGrade: stdGradeForCurrentNode } : {}),
      ...(mode === 'selected_nodes' && selectedNodeStdScopes
        ? { selectedNodeStdScopes }
        : {}),
    };

    let isQueuedAsyncSearch = false;

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
          throw new Error(
            `Ensure account failed with status ${ensureRes.status}`,
          );
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
        if (json && typeof json === 'object') {
          const jsonObj = json as {
            message?: string;
            creditsNeeded?: number;
            creditsAvailable?: number;
          };
          serverMessage = formatInsufficientOrgChartCreditsMessage({
            message: jsonObj.message,
            creditsNeeded: jsonObj.creditsNeeded,
            creditsAvailable: jsonObj.creditsAvailable,
          });
        } else if (typeof json === 'string') {
          serverMessage = json;
        } else {
          serverMessage = `Request failed with status ${response.status}`;
        }
        // eslint-disable-next-line no-console
        console.log('json::', json);
        throw new Error(serverMessage);
      }

      if (json?.queued === true) {
        isQueuedAsyncSearch = true;
        setContextProgressMessage(
          typeof json.candidateSource === 'string' &&
            json.candidateSource === 'linkedin_xray'
            ? 'LinkedIn x-ray search queued. Waiting for results...'
            : typeof json.candidateSource === 'string' &&
                json.candidateSource === 'multi'
              ? 'Multi-source org chart queued. Waiting for results...'
            : typeof json.candidateSource === 'string' &&
                json.candidateSource === 'unipile'
              ? 'LinkedIn search queued. Waiting for results...'
              : typeof json.candidateSource === 'string' &&
                  isOrgChartM7kqCandidateSource(json.candidateSource)
                ? 'Directory org chart search queued. Waiting for results...'
                : 'Org chart search queued. Waiting for results...',
        );
        armProgressUpdateTimeout(requestId);
        return;
      }

      const rawItems = Array.isArray(json.items) ? json.items : [];
      const normalized = rawItems.map(
        (item: Record<string, unknown>, index: number) =>
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
        // Merge response-level metadata (candidateSource, itemCount) into
        // the stored orgChart object — see companion comment in the
        // 'complete' event handler above.
        const candidateSourceFromResponse =
          typeof json.candidateSource === 'string'
            ? json.candidateSource
            : undefined;
        const itemCountFromResponse =
          typeof json.itemCount === 'number'
            ? json.itemCount
            : rawItems.length > 0
              ? rawItems.length
              : undefined;
        const nextOrgChart: Record<string, unknown> = {
          ...(json.orgChart as Record<string, unknown>),
        };
        if (candidateSourceFromResponse !== undefined) {
          nextOrgChart.candidateSource = candidateSourceFromResponse;
        }
        if (itemCountFromResponse !== undefined) {
          nextOrgChart.itemCount = itemCountFromResponse;
        }
        setLatestOrgChart(nextOrgChart);
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
        const rawErrorMessage =
          err instanceof Error ? err.message : 'Failed to fetch candidates';
        const errorMessage =
          formatOrgChartTransportErrorMessage(rawErrorMessage);
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
        clearProgressUpdateTimeout();
      } else {
        setContextError('Search stopped.');
        setContextProgressMessage(null);
        clearProgressUpdateTimeout();
      }
    } finally {
      if (isQueuedAsyncSearch) {
        orgchartAbortControllerRef.current = null;
        return;
      }
      orgchartAbortControllerRef.current = null;
      clearProgressUpdateTimeout();
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

  const buildCandidatesFromNode = useCallback(
    (n: OrgChartNodeData): ContextResultItem[] => {
      const rows: ContextResultItem[] = [];
      for (let i = 0; i < 16; i += 1) {
        const nameKey = `name_${i}` as keyof OrgChartNodeData;
        const titleKey = `title_${i}` as keyof OrgChartNodeData;
        const linkedinKey = `linkedin_url_${i}` as keyof OrgChartNodeData;
        const imageKey = `image_${i}` as keyof OrgChartNodeData;
        const name = n[nameKey];
        if (typeof name === 'string' && name.trim().length > 0) {
          const image = n[imageKey];
          const rawLinkedinVal = n[linkedinKey];
          const rawLi =
            typeof rawLinkedinVal === 'string' ? rawLinkedinVal : '';
          rows.push({
            id: `${i}`,
            fullName: name.trim(),
            headline: (typeof n[titleKey] === 'string'
              ? n[titleKey]
              : '') as string,
            company: companyName ?? '',
            linkedinUrl: isValidLinkedInProfileUrl(rawLi)
              ? rawLi.trim()
              : undefined,
            raw:
              typeof image === 'string'
                ? { image, profile_picture_url: image }
                : {},
          });
        }
      }
      return rows;
    },
    [companyName],
  );

  const loadNodePeopleDetails = useCallback(
    async (node: OrgChartNodeData) => {
      if (node.nodeState === 'preview') {
        if (typeof onPreviewNodePeopleRequest === 'function') {
          onPreviewNodePeopleRequest(node);
        } else {
          enqueueSnackBar(
            'This position is part of a preview org chart. Generate the full org chart to load people here.',
            { variant: SnackBarVariant.Warning, duration: 6000 },
          );
        }
        return;
      }

      if (node.nodeState === 'lock') {
        enqueueSnackBar(
          'Upgrade to a paid Arxena plan to view linkedin profiles, verified emails, and phone numbers.',
          { variant: SnackBarVariant.Info, duration: 6000 },
        );
        return;
      }

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
      console.log('[orgchart/loadNodePeopleDetails]', {
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
          cached && cached.length > 0 ? cached : buildCandidatesFromNode(node);
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
          stdFunction: (node as Record<string, unknown>).std_function as
            | string
            | undefined,
          stdGrade: (node as Record<string, unknown>).std_grade as
            | string
            | undefined,
          country: node.country ?? undefined,
          limit: hasPartialList ? Math.min(Math.max(totalPeople, 50), 500) : 50,
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
          err instanceof Error
            ? err.message
            : 'Failed to fetch people for node',
        );
      } finally {
        setIsNodeDetailLoading(false);
      }
    },
    [
      buildCandidatesFromNode,
      companyId,
      companyName,
      enrichedNodes,
      onPreviewNodePeopleRequest,
      enqueueSnackBar,
      website,
    ],
  );

  const handleNodeDoubleClick = (node: OrgChartNodeData) => {
    void loadNodePeopleDetails(node);
  };

  const handleNodeContextAction = async (
    action: OrgChartContextAction,
    node: OrgChartNodeData,
    payload?: OrgChartNodeContextPayload,
  ) => {
    const multiSelectedNodes =
      Array.isArray(payload?.selectedNodes) && payload.selectedNodes.length > 1
        ? payload.selectedNodes
        : null;

    if (action === 'delete_company_cache') {
      return;
    }

    if (action === 'current_node') {
      // When multiple nodes are selected and the user clicks on any node’s context
      // menu, apply "current node" actions to the entire selection.
      // For "Get people in this position", the closest multi-node equivalent UX is
      // a combined "selected_nodes" search (single modal, aggregated results).
      if (multiSelectedNodes) {
        await executeOrgchartSearch({
          mode: 'selected_nodes',
          origin: 'node',
          node,
          selectedNodes: multiSelectedNodes,
        });
        return;
      }

      await loadNodePeopleDetails(node);
      return;
    }

    if (
      action === 'm7kq_fetch_complete' ||
      action === 'm7kq_fetch_phone' ||
      action === 'm7kq_fetch_email'
    ) {
      if (multiSelectedNodes) {
        // Run sequentially to keep UI/snackbars deterministic and avoid spiking
        // contact enrichment usage.
        for (const n of multiSelectedNodes) {
          // eslint-disable-next-line no-await-in-loop
          await runM7kqNodeProfileFetchFromContext(n, action);
        }
        return;
      }

      await runM7kqNodeProfileFetchFromContext(node, action);
      return;
    }

    if (
      action === 'outreach_linkedin_invite' ||
      action === 'outreach_whatsapp' ||
      action === 'outreach_google_contact' ||
      action === 'outreach_email'
    ) {
      const slot = payload?.personSlot ?? 0;
      const item = contextResultItemFromNodePersonSlot(node, slot, companyName);
      if (!item) {
        enqueueSnackBar('Could not read this person from the node.', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        return;
      }
      const ch = OUTREACH_ACTION_TO_CHANNEL[action];
      if (!ch) {
        return;
      }
      setOutreachChannel(ch);
      setOutreachContextItem({
        ...item,
        company: (item.company || companyName) ?? '',
      });
      setOutreachNode(node);
      setIsOutreachModalOpen(true);
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
      function_grade: 'function_grade',
      business_division_map: 'business_division_map',
      selected_nodes: 'selected_nodes',
      boolean_keywords: 'current_node',
      similar_companies: 'function_grade',
      add_to_job_and_send_invite: 'current_node',
      add_to_job_and_invite_to_job: 'current_node',
      m7kq_fetch_complete: 'current_node',
      m7kq_fetch_phone: 'current_node',
      m7kq_fetch_email: 'current_node',
      outreach_linkedin_invite: 'current_node',
      outreach_whatsapp: 'current_node',
      outreach_google_contact: 'current_node',
      outreach_email: 'current_node',
    };

    const mappedMode = modeMap[action];
    await executeOrgchartSearch({
      mode: mappedMode,
      origin: 'node',
      node,
      selectedNodes:
        mappedMode === 'selected_nodes' ? payload?.selectedNodes : undefined,
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
    setEnrichedNodes({});
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
          const rawLinkedinVal = node[linkedinKey];
          const rawLi =
            typeof rawLinkedinVal === 'string' ? rawLinkedinVal : '';
          rows.push({
            id: `${i}`,
            fullName: name.trim(),
            headline: (typeof node[titleKey] === 'string'
              ? node[titleKey]
              : '') as string,
            company: companyName ?? '',
            linkedinUrl: isValidLinkedInProfileUrl(rawLi)
              ? rawLi.trim()
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
    loadNodePeopleDetails,
    handleDownloadNode,
    handleSimilarPeople,

    latestOrgChart,

    isAddToJobModalOpen,
    addToJobNode,
    addToJobQueueStartChat,
    closeAddToJobModal,

    selectedNodeFunction,
    selectedNodeGrade,

    isOutreachModalOpen,
    outreachChannel,
    outreachContextItem,
    outreachNode,
    closeOutreachModal,
  };
};

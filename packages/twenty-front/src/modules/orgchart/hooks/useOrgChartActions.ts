import { useCallback, useEffect, useState } from 'react';

import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
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

type OrgchartSearchMode =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'all_people'
  | 'function_grade'
  | 'selected_nodes';

export type UseOrgChartActionsParams = {
  companyId: string;
  companyName?: string;
  website?: string;
  employeeCount?: number | null;
};

type OrgChartSearchProgressEvent = {
  event?: 'status' | 'paginationInfo' | 'pageResults' | 'complete';
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

export const useOrgChartActions = ({
  companyId,
  companyName,
  website,
  employeeCount,
}: UseOrgChartActionsParams) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;
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
    [activeOrgChartRequestId, companyId, updateSnackBarByDedupeKey],
  );

  useEffect(() => {
    if (!isContextLoading && activeOrgChartRequestId) {
      setActiveOrgChartRequestId(null);
    }
  }, [activeOrgChartRequestId, isContextLoading]);

  const executeOrgchartSearch = async (params: {
    mode: OrgchartSearchMode;
    origin:
      | 'node'
      | 'background'
      | 'header'
      | 'doubleClick'
      | 'view_all_candidates';
    node?: OrgChartNodeData;
  }) => {
    if (!companyId) return;

    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!baseUrl) return;

    const mode = params.mode;
    const node = params.node;

    const isHeaderEntireCompany =
      mode === 'entire_company' && params.origin === 'header';

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

    if (!isHeaderEntireCompany) {
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
    const baseRequirement =
      mode === 'leadership'
        ? `Find leadership roles at ${resolvedCompanyName}.`
        : mode === 'entire_company' || mode === 'all_people'
          ? `Find all people currently working at ${resolvedCompanyName}.`
          : mode === 'function_grade'
            ? `Find people at ${resolvedCompanyName} in similar functions and seniority.`
            : `Find people in the same position at ${resolvedCompanyName}.`;

    const titlesRequirement =
      jobTitles.length > 0 ? ` Key titles: ${jobTitles.join(', ')}.` : '';
    const requirement = `${baseRequirement}${titlesRequirement}`;

    const body = {
      rawQuery: requirement,
      cleanedQuery: requirement,
      companyName: companyName ?? undefined,
      companyId,
      jobTitles,
      mode,
      searchType: 'classic' as const,
      requestId,
    };

    try {
      // Ensure LinkedIn account is connected before org chart (LRU pool)
      const currentUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}${window.location.search}`;
      const ensureRes = await fetch(`${baseUrl}/linkedin-unipile/org-chart/ensure-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          success_redirect_url: currentUrl,
          failure_redirect_url: currentUrl,
        }),
      });
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

      const response = await fetch(`${baseUrl}/candidate-search/orgchart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
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

      if (!isHeaderEntireCompany) {
        setContextResults(normalized);
      }

      if (mode === 'entire_company' && json.orgChart) {
        setLatestOrgChart(json.orgChart);
        Mixpanel.track('org_chart_create', { companyId });
        closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        const cacheText = json.isCached
          ? 'served from cache'
          : 'generated and cached';

        enqueueSnackBar(
          `Org chart ${cacheText} for ${resolvedCompanyName} (${rawItems.length} people)`,
          {
            variant: SnackBarVariant.Success,
            dedupeKey: `orgchart-entire-company-${companyId}-done`,
            duration: 4000,
          },
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch candidates';
      setContextError(errorMessage);
      setContextProgressMessage(null);
      if (mode === 'entire_company') {
        closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
        enqueueSnackBar(errorMessage, {
          variant: SnackBarVariant.Error,
          dedupeKey: `orgchart-entire-company-${companyId}-error`,
          duration: 5000,
        });
      }
    } finally {
      if (mode === 'entire_company') {
        closeSnackBarByDedupeKey(`orgchart-entire-company-${companyId}`);
      }
      setIsContextLoading(false);
    }
  };

  const handleNodeContextAction = async (
    action: OrgChartContextAction,
    node: OrgChartNodeData,
  ) => {
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
      all_people: 'all_people',
      function_grade: 'function_grade',
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
    if (action === 'leadership') {
      await executeOrgchartSearch({
        mode: 'leadership',
        origin: 'background',
      });
    } else {
      await executeOrgchartSearch({
        mode: 'entire_company',
        origin: 'background',
      });
    }
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
    const isActive = node.nodeState === 'active';

    if (isActive) {
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
        limit: 50,
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
    downloadContextResultsAsCsv,
    executeOrgchartSearch,

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

import { useState } from 'react';

import type { OrgChartContextAction } from '../components/OrgChartDiagram';
import type { ContextResultItem } from '../types';
import type { NodeState, OrgChartNodeData } from '../utils/orgChartDataUtils';
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
};

export const useOrgChartActions = ({
  companyId,
  companyName,
  website,
}: UseOrgChartActionsParams) => {
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [contextModalTitle, setContextModalTitle] = useState('');
  const [contextModalMode, setContextModalMode] =
    useState<OrgChartContextAction | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextResults, setContextResults] = useState<ContextResultItem[]>([]);
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

  const executeOrgchartSearch = async (params: {
    mode: OrgchartSearchMode;
    origin: 'node' | 'background' | 'header' | 'doubleClick';
    node?: OrgChartNodeData;
  }) => {
    if (!companyId) return;

    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!baseUrl) return;

    const mode = params.mode;
    const node = params.node;

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

    setIsContextModalOpen(true);
    setIsContextLoading(true);
    setContextError(null);
    setContextModalTitle(title);
    setContextModalMode(mode);
    setBooleanKeywordsString(null);
    setContextResults([]);

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
    };

    try {
      const response = await fetch(`${baseUrl}/candidate-search/orgchart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const json = (await response.json()) as {
        success?: boolean;
        items?: Array<Record<string, unknown>>;
        itemCount?: number;
      };

      const rawItems = Array.isArray(json.items) ? json.items : [];
      const normalized = rawItems.map((item, index) =>
        normalizeCandidateItem(item, index),
      );
      setContextResults(normalized);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setContextError(
        err instanceof Error ? err.message : 'Failed to fetch candidates',
      );
    } finally {
      setIsContextLoading(false);
    }
  };

  const handleNodeContextAction = async (
    action: OrgChartContextAction,
    node: OrgChartNodeData,
  ) => {
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

  const handleNodeDoubleClick = async (node: OrgChartNodeData) => {
    setSelectedNodeForDetails(node);
    setIsNodeDetailLoading(true);
    setNodeDetailError(null);
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

      const response = await fetch(
        `${baseUrl}/org-chart/${encodeURIComponent(companyId)}/node-people`,
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

      const nodeKey = typeof node.key === 'number' ? node.key : undefined;
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
    contextError,
    contextResults,
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
  };
};

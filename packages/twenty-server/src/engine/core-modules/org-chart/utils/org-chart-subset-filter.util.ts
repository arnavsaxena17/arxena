import {
    filterOrgChartNodeDataArray,
    hasMeaningfulOrgChartCountryFilter,
    hasMeaningfulOrgChartFunctionRootFilter,
    processOrgChartToNodeData,
    type OrgChartData,
    type OrgChartNodeData,
} from 'twenty-shared';

export type OrgChartPayloadSubsetOptions = {
  country?: string;
  functionRoot?: string;
};

export const isOrgChartPayloadSubsetRequest = (
  options: OrgChartPayloadSubsetOptions,
): boolean =>
  hasMeaningfulOrgChartCountryFilter(options.country) ||
  hasMeaningfulOrgChartFunctionRootFilter(options.functionRoot);

type RawOrgChartNode = Record<string, unknown> & {
  key: number;
  parent?: number | string;
};

const parseOrgChartArray = (raw: unknown): RawOrgChartNode[] | null => {
  if (Array.isArray(raw)) {
    return raw.filter(
      (node): node is RawOrgChartNode =>
        !!node &&
        typeof node === 'object' &&
        typeof (node as { key?: unknown }).key === 'number',
    );
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter(
      (node): node is RawOrgChartNode =>
        !!node &&
        typeof node === 'object' &&
        typeof (node as { key?: unknown }).key === 'number',
    );
  } catch {
    return null;
  }
};

const serializeOrgChartArray = (nodes: RawOrgChartNode[]): string =>
  JSON.stringify(nodes);

const toRawParent = (parent: OrgChartNodeData['parent']): number | string => {
  if (parent === undefined || parent === null) {
    return '';
  }
  return parent;
};

const buildFilteredRawNodes = (
  rawNodes: RawOrgChartNode[],
  filteredNodes: OrgChartNodeData[],
): RawOrgChartNode[] => {
  const rawByKey = new Map(rawNodes.map((node) => [node.key, node]));
  const filteredRaw: RawOrgChartNode[] = [];

  for (const filteredNode of filteredNodes) {
    if (typeof filteredNode.key !== 'number') {
      continue;
    }
    const rawNode = rawByKey.get(filteredNode.key);
    if (!rawNode) {
      continue;
    }
    filteredRaw.push({
      ...rawNode,
      parent: toRawParent(filteredNode.parent),
    });
  }

  return filteredRaw;
};

const patchListOrgChartsEntry = (
  payload: Record<string, unknown>,
  orgchartValue: string,
  options: OrgChartPayloadSubsetOptions,
): void => {
  const list = payload.list_orgcharts;
  if (!Array.isArray(list) || list.length === 0 || typeof list[0] !== 'string') {
    return;
  }

  try {
    const inner = JSON.parse(list[0]) as Record<string, unknown>;
    inner.orgchart = orgchartValue;
    if (hasMeaningfulOrgChartCountryFilter(options.country)) {
      inner.country = options.country!.trim();
    }
    if (hasMeaningfulOrgChartFunctionRootFilter(options.functionRoot)) {
      inner.type = options.functionRoot!.trim();
    }
    payload.list_orgcharts = [JSON.stringify(inner)];
  } catch {
    // keep list_orgcharts unchanged
  }
};

/**
 * Filters a full-company org chart payload by country and/or function root using
 * the shared node-tree filter (ancestors + descendants preserved).
 */
export const applyOrgChartPayloadSubsetFilter = (
  payload: Record<string, unknown>,
  options: OrgChartPayloadSubsetOptions,
): Record<string, unknown> => {
  if (!isOrgChartPayloadSubsetRequest(options)) {
    return payload;
  }

  const rawNodes = parseOrgChartArray(payload.orgchart);
  if (!rawNodes || rawNodes.length === 0) {
    return payload;
  }

  const nodeDataArray = processOrgChartToNodeData(payload as OrgChartData);
  if (nodeDataArray.length === 0) {
    return payload;
  }

  const filteredNodes = filterOrgChartNodeDataArray(nodeDataArray, options);
  const filteredRawNodes = buildFilteredRawNodes(rawNodes, filteredNodes);
  const orgchartValue = serializeOrgChartArray(filteredRawNodes);

  const out: Record<string, unknown> = {
    ...payload,
    orgchart: orgchartValue,
  };

  if (hasMeaningfulOrgChartCountryFilter(options.country)) {
    out.country = options.country!.trim();
  }
  if (hasMeaningfulOrgChartFunctionRootFilter(options.functionRoot)) {
    out.type = options.functionRoot!.trim();
  }

  patchListOrgChartsEntry(out, orgchartValue, options);

  return out;
};

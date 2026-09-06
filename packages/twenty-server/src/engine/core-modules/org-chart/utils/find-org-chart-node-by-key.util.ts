export type OrgChartPositionLike = {
  key?: number | string;
  parent?: number | string;
  headline?: string;
  country?: string;
  std_function?: string;
  std_function_root?: string;
  std_grade?: string;
  len_candidates?: number | string;
  [key: string]: unknown;
};

export type ResolvedOrgChartNode = {
  key: number;
  parent: number | '';
  headline: string;
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  country?: string;
  peopleCount?: number;
};

export const parseOrgchartNodes = (
  orgchart: unknown,
): OrgChartPositionLike[] => {
  if (Array.isArray(orgchart)) {
    return orgchart as OrgChartPositionLike[];
  }

  if (typeof orgchart !== 'string' || orgchart.trim().length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(orgchart);

    return Array.isArray(parsed) ? (parsed as OrgChartPositionLike[]) : [];
  } catch {
    return [];
  }
};

export const toOrgChartNodeKey = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const toParent = (value: unknown): number | '' => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  return toOrgChartNodeKey(value) ?? '';
};

const toPeopleCount = (node: OrgChartPositionLike): number | undefined => {
  if (
    typeof node.len_candidates === 'number' &&
    Number.isFinite(node.len_candidates)
  ) {
    return Math.max(0, Math.floor(node.len_candidates));
  }

  if (typeof node.len_candidates === 'string') {
    const parsed = Number(node.len_candidates);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }

  return undefined;
};

export const resolveOrgChartNodeFromRaw = (
  node: OrgChartPositionLike,
): ResolvedOrgChartNode | null => {
  const key = toOrgChartNodeKey(node.key);

  if (key === undefined) {
    return null;
  }

  const headline =
    typeof node.headline === 'string' && node.headline.trim().length > 0
      ? node.headline
      : 'Unknown';
  const resolved: ResolvedOrgChartNode = {
    key,
    parent: toParent(node.parent),
    headline,
  };

  if (typeof node.std_function === 'string' && node.std_function.trim()) {
    resolved.stdFunction = node.std_function;
  }

  if (
    typeof node.std_function_root === 'string' &&
    node.std_function_root.trim()
  ) {
    resolved.stdFunctionRoot = node.std_function_root;
  }

  if (typeof node.std_grade === 'string' && node.std_grade.trim()) {
    resolved.stdGrade = node.std_grade;
  }

  if (typeof node.country === 'string' && node.country.trim()) {
    resolved.country = node.country;
  }

  const peopleCount = toPeopleCount(node);

  if (peopleCount !== undefined) {
    resolved.peopleCount = peopleCount;
  }

  return resolved;
};

export const findOrgChartRawNodeByKey = (
  orgChartData: Record<string, unknown> | null | undefined,
  nodeKey: number,
): OrgChartPositionLike | null => {
  const nodes = parseOrgchartNodes(orgChartData?.orgchart);

  for (const node of nodes) {
    const key = toOrgChartNodeKey(node.key);

    if (key === nodeKey) {
      return node;
    }
  }

  return null;
};

export const findOrgChartNodeByKey = (
  orgChartData: Record<string, unknown> | null | undefined,
  nodeKey: number,
): ResolvedOrgChartNode | null => {
  const rawNode = findOrgChartRawNodeByKey(orgChartData, nodeKey);

  if (!rawNode) {
    return null;
  }

  return resolveOrgChartNodeFromRaw(rawNode);
};

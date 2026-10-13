export type OrgChartPositionRow = {
  key: number;
  parent: number | '';
  headline: string;
  std_function_root?: string;
  std_function?: string;
  std_grade?: string;
  country?: string;
  peopleCount: number;
};

export type ProjectOrgChartPositionsFilters = {
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  headlineContains?: string;
  limit?: number;
};

type RawPositionNode = {
  key?: number | string;
  parent?: number | string;
  headline?: string;
  country?: string;
  std_function?: string;
  std_function_root?: string;
  std_grade?: string;
  len_candidates?: number | string;
  candidates?: unknown;
  [key: string]: unknown;
};

const parseOrgchartNodes = (orgchart: unknown): RawPositionNode[] => {
  if (Array.isArray(orgchart)) {
    return orgchart as RawPositionNode[];
  }

  if (typeof orgchart !== 'string' || orgchart.trim().length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(orgchart);

    return Array.isArray(parsed) ? (parsed as RawPositionNode[]) : [];
  } catch {
    return [];
  }
};

const resolvePeopleCount = (node: RawPositionNode): number => {
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

  if (Array.isArray(node.candidates)) {
    return node.candidates.length;
  }

  if (node.candidates && typeof node.candidates === 'object') {
    return 1;
  }

  return 0;
};

const normalizeKey = (value: unknown): number | undefined => {
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

const normalizeParent = (value: unknown): number | '' => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const asNumber = normalizeKey(value);

  return asNumber === undefined ? '' : asNumber;
};

const matchesFilter = (
  value: string | undefined,
  filter: string | undefined,
): boolean => {
  if (!filter) {
    return true;
  }

  if (!value) {
    return false;
  }

  return value.toLowerCase() === filter.toLowerCase();
};

const matchesHeadlineContains = (
  headline: string,
  headlineContains: string | undefined,
): boolean => {
  if (!headlineContains) {
    return true;
  }

  return headline.toLowerCase().includes(headlineContains.toLowerCase());
};

export const projectOrgChartPositions = (
  orgChartData: Record<string, unknown> | null | undefined,
  filters: ProjectOrgChartPositionsFilters = {},
): OrgChartPositionRow[] => {
  const nodes = parseOrgchartNodes(orgChartData?.orgchart);
  const positions: OrgChartPositionRow[] = [];

  for (const node of nodes) {
    const key = normalizeKey(node.key);

    if (key === undefined) {
      continue;
    }

    const headline =
      typeof node.headline === 'string' && node.headline.trim().length > 0
        ? node.headline
        : 'Unknown';
    const stdFunction =
      typeof node.std_function === 'string' ? node.std_function : undefined;
    const stdFunctionRoot =
      typeof node.std_function_root === 'string'
        ? node.std_function_root
        : undefined;
    const stdGrade =
      typeof node.std_grade === 'string' ? node.std_grade : undefined;

    if (!matchesFilter(stdFunction, filters.stdFunction)) {
      continue;
    }

    if (!matchesFilter(stdFunctionRoot, filters.stdFunctionRoot)) {
      continue;
    }

    if (!matchesFilter(stdGrade, filters.stdGrade)) {
      continue;
    }

    if (!matchesHeadlineContains(headline, filters.headlineContains)) {
      continue;
    }

    const row: OrgChartPositionRow = {
      key,
      parent: normalizeParent(node.parent),
      headline,
      peopleCount: resolvePeopleCount(node),
    };

    if (stdFunctionRoot) {
      row.std_function_root = stdFunctionRoot;
    }

    if (stdFunction) {
      row.std_function = stdFunction;
    }

    if (stdGrade) {
      row.std_grade = stdGrade;
    }

    if (typeof node.country === 'string' && node.country.trim().length > 0) {
      row.country = node.country;
    }

    positions.push(row);
  }

  if (typeof filters.limit === 'number' && filters.limit >= 0) {
    return positions.slice(0, Math.floor(filters.limit));
  }

  return positions;
};

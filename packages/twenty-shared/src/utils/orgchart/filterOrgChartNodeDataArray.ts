import type { JsonValue, OrgChartNodeData } from './orgChartDataUtils';

export type OrgChartGradeTier = 'leadership' | 'managers' | 'executives';

export type OrgChartGradeVisibility = Record<OrgChartGradeTier, boolean>;

export const DEFAULT_ORG_CHART_GRADE_VISIBILITY: OrgChartGradeVisibility = {
  leadership: true,
  managers: true,
  executives: true,
};

export type OrgChartNodeDataFilterOptions = {
  country?: string;
  functionRoot?: string;
  gradeVisibility?: OrgChartGradeVisibility;
};

type FilterableOrgChartNode = OrgChartNodeData & {
  std_function_root?: string;
  std_function?: string;
  std_grade?: string;
  std_grade_category?: string;
  allCandidates?: JsonValue[];
};

export const hasActiveOrgChartGradeFilter = (
  gradeVisibility?: OrgChartGradeVisibility,
): boolean => {
  if (!gradeVisibility) {
    return false;
  }
  return (
    !gradeVisibility.leadership ||
    !gradeVisibility.managers ||
    !gradeVisibility.executives
  );
};

const resolveNodeGradeTier = (
  node: FilterableOrgChartNode,
): OrgChartGradeTier | null => {
  const category =
    typeof node.std_grade_category === 'string'
      ? node.std_grade_category.trim().toLowerCase()
      : '';
  const grade =
    typeof node.std_grade === 'string'
      ? node.std_grade.trim().toLowerCase()
      : '';

  if (
    category === 'senior' ||
    category === 'ceo' ||
    grade === 'leadership' ||
    grade === 'ceo'
  ) {
    return 'leadership';
  }
  if (category === 'mid' || grade === 'mid') {
    return 'managers';
  }
  if (category === 'entry' || grade === 'entry') {
    return 'executives';
  }
  return null;
};

const nodeMatchesGradeVisibility = (
  node: FilterableOrgChartNode,
  gradeVisibility: OrgChartGradeVisibility,
): boolean => {
  const tier = resolveNodeGradeTier(node);
  if (!tier) {
    return (
      gradeVisibility.leadership &&
      gradeVisibility.managers &&
      gradeVisibility.executives
    );
  }
  return gradeVisibility[tier];
};

export const hasMeaningfulOrgChartCountryFilter = (
  country?: string,
): boolean => {
  const normalized = (country ?? '').trim().toLowerCase();
  return normalized.length > 0 && normalized !== 'global';
};

export const hasMeaningfulOrgChartFunctionRootFilter = (
  functionRoot?: string,
): boolean => {
  const normalized = (functionRoot ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return normalized.length > 0 && normalized !== 'fullcompany';
};

const normalizeFunctionToken = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/assist$/u, '');

const normalizeParentKey = (parent: unknown): number | '' => {
  if (parent === '' || parent === null || parent === undefined) {
    return '';
  }
  return typeof parent === 'number' ? parent : Number(parent);
};

const buildChildrenMap = (
  nodes: FilterableOrgChartNode[],
): Map<number | '', number[]> => {
  const children = new Map<number | '', number[]>();

  for (const node of nodes) {
    const parentKey = normalizeParentKey(node.parent);
    if (!children.has(parentKey)) {
      children.set(parentKey, []);
    }
    children.get(parentKey)!.push(node.key);
  }

  return children;
};

const collectDescendants = (
  rootKeys: number[],
  children: Map<number | '', number[]>,
): Set<number> => {
  const out = new Set<number>();
  const stack = [...rootKeys];

  while (stack.length > 0) {
    const key = stack.pop();
    if (key === undefined || out.has(key)) {
      continue;
    }
    out.add(key);
    for (const childKey of children.get(key) ?? []) {
      stack.push(childKey);
    }
  }

  return out;
};

const collectAncestors = (
  seedKeys: number[],
  byKey: Map<number, FilterableOrgChartNode>,
): Set<number> => {
  const out = new Set<number>();

  for (const seed of seedKeys) {
    let key: number | undefined = seed;

    while (key !== undefined) {
      out.add(key);
      const node = byKey.get(key);
      if (!node) {
        break;
      }
      const parentKey = normalizeParentKey(node.parent);
      if (parentKey === '') {
        break;
      }
      key = parentKey;
    }
  }

  return out;
};

const rewireParentsForKeptNodes = (
  nodes: FilterableOrgChartNode[],
  keepSet: Set<number>,
): OrgChartNodeData[] => {
  const byKey = new Map(nodes.map((node) => [node.key, node]));

  return nodes
    .filter((node) => keepSet.has(node.key))
    .map((node) => {
      let parent: number | undefined = node.parent;

      while (true) {
        const parentKey = normalizeParentKey(parent);
        if (parentKey === '') {
          return { ...node, parent: undefined };
        }
        if (keepSet.has(parentKey)) {
          return { ...node, parent: parentKey };
        }
        const parentNode = byKey.get(parentKey);
        if (!parentNode) {
          return { ...node, parent: undefined };
        }
        parent = parentNode.parent;
      }
    });
};

const readNodeFunctionRoot = (node: FilterableOrgChartNode): string => {
  const root =
    typeof node.std_function_root === 'string' ? node.std_function_root : '';
  const fn = typeof node.std_function === 'string' ? node.std_function : '';
  return root || fn;
};

const nodeMatchesFunctionRoot = (
  node: FilterableOrgChartNode,
  requested: string,
): boolean => {
  const req = normalizeFunctionToken(requested);
  const root = normalizeFunctionToken(readNodeFunctionRoot(node));
  if (!root || !req) {
    return false;
  }
  return root === req || root.includes(req);
};

const readCandidateCountryValue = (
  candidate: { [key: string]: JsonValue | undefined },
): string => {
  const values = [
    candidate.location_country,
    candidate.locationCountry,
    candidate.location_name,
    candidate.locationName,
    candidate.country,
  ];
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toLowerCase();
    }
  }
  return '';
};

const nodeMatchesCountry = (
  node: FilterableOrgChartNode,
  requestedCountry: string,
): boolean => {
  const filterCountry = requestedCountry.trim().toLowerCase();
  if (!filterCountry) {
    return true;
  }

  const nodeCountry =
    typeof node.country === 'string' ? node.country.trim().toLowerCase() : '';
  if (nodeCountry.includes(filterCountry)) {
    return true;
  }

  const candidates = node.allCandidates;
  if (!Array.isArray(candidates)) {
    return false;
  }

  return candidates.some((candidate) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return false;
    }
    const countryValue = readCandidateCountryValue(candidate);
    return countryValue.includes(filterCountry);
  });
};

const isOrgChartTreeRoot = (node: FilterableOrgChartNode): boolean =>
  normalizeParentKey(node.parent) === '';

const pickFunctionSeedNodes = (
  matches: FilterableOrgChartNode[],
): FilterableOrgChartNode[] => {
  const nonRootMatches = matches.filter((node) => !isOrgChartTreeRoot(node));
  return nonRootMatches.length > 0 ? nonRootMatches : matches;
};

const findFunctionSeedKeys = (
  nodes: FilterableOrgChartNode[],
  requested: string,
): number[] => {
  const direct = pickFunctionSeedNodes(
    nodes.filter((node) => nodeMatchesFunctionRoot(node, requested)),
  );

  if (direct.length > 0) {
    return direct.map((node) => node.key);
  }

  const req = normalizeFunctionToken(requested);
  return pickFunctionSeedNodes(
    nodes.filter((node) => {
      const root = normalizeFunctionToken(readNodeFunctionRoot(node));
      return root.length > 0 && root.includes(req);
    }),
  ).map((node) => node.key);
};

const findCountrySeedKeys = (
  nodes: FilterableOrgChartNode[],
  requestedCountry: string,
): number[] =>
  nodes
    .filter((node) => nodeMatchesCountry(node, requestedCountry))
    .map((node) => node.key);

const buildKeepSetForGradeFilterSeeds = (
  nodes: FilterableOrgChartNode[],
  seeds: number[],
): Set<number> => {
  if (seeds.length === 0) {
    return new Set();
  }

  const byKey = new Map(nodes.map((node) => [node.key, node]));
  return collectAncestors(seeds, byKey);
};

const buildKeepSetForSeeds = (
  nodes: FilterableOrgChartNode[],
  seeds: number[],
): Set<number> => {
  if (seeds.length === 0) {
    return new Set();
  }

  const children = buildChildrenMap(nodes);
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const descendants = collectDescendants(seeds, children);
  const ancestors = collectAncestors(seeds, byKey);

  return new Set([...descendants, ...ancestors]);
};

/**
 * Filters a full-company org chart tree by country and/or function root while
 * preserving hierarchy (ancestors + descendants of matching nodes).
 */
export const filterOrgChartNodeDataArray = (
  nodes: OrgChartNodeData[],
  options: OrgChartNodeDataFilterOptions,
): OrgChartNodeData[] => {
  const typedNodes = nodes as FilterableOrgChartNode[];
  const hasCountry = hasMeaningfulOrgChartCountryFilter(options.country);
  const hasFunction = hasMeaningfulOrgChartFunctionRootFilter(
    options.functionRoot,
  );
  const hasGrade = hasActiveOrgChartGradeFilter(options.gradeVisibility);

  if (!hasCountry && !hasFunction && !hasGrade) {
    return nodes;
  }

  if (typedNodes.length === 0) {
    return nodes;
  }

  const nodeMatchesActiveFilters = (node: FilterableOrgChartNode): boolean => {
    if (hasCountry && !nodeMatchesCountry(node, options.country!.trim())) {
      return false;
    }
    if (
      hasFunction &&
      !nodeMatchesFunctionRoot(node, options.functionRoot!.trim())
    ) {
      return false;
    }
    if (
      hasGrade &&
      !nodeMatchesGradeVisibility(node, options.gradeVisibility!)
    ) {
      return false;
    }
    return true;
  };

  let keepSet: Set<number>;

  if (hasGrade) {
    const seeds = typedNodes
      .filter(nodeMatchesActiveFilters)
      .map((node) => node.key);
    keepSet = buildKeepSetForGradeFilterSeeds(typedNodes, seeds);
  } else if (hasCountry && hasFunction) {
    const country = options.country!.trim();
    const functionRoot = options.functionRoot!.trim();
    const seeds = typedNodes
      .filter(
        (node) =>
          nodeMatchesCountry(node, country) &&
          nodeMatchesFunctionRoot(node, functionRoot),
      )
      .map((node) => node.key);
    keepSet = buildKeepSetForSeeds(typedNodes, seeds);
  } else if (hasFunction) {
    const seeds = findFunctionSeedKeys(typedNodes, options.functionRoot!.trim());
    keepSet = buildKeepSetForSeeds(typedNodes, seeds);
  } else {
    const seeds = findCountrySeedKeys(typedNodes, options.country!.trim());
    keepSet = buildKeepSetForSeeds(typedNodes, seeds);
  }

  if (!keepSet || keepSet.size === 0) {
    return [];
  }

  return rewireParentsForKeptNodes(typedNodes, keepSet);
};

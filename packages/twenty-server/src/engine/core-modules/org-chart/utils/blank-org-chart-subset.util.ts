/**
 * When ES/S3 have no org chart for a subset (country / function), we still serve
 * the static blank template. For subset requests, the full blank tree is misleading;
 * this module trims the template to a matching function subtree or a slimmer
 * country-only sample.
 */

type OrgChartNode = {
  key: number;
  parent: number | string;
  std_function_root?: string;
  std_function?: string;
  candidates?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type BlankOrgChartSubsetOptions = {
  country?: string;
  functionRoot?: string;
};

export function isBlankSubsetRequest(
  options: BlankOrgChartSubsetOptions,
): boolean {
  const country = options.country?.trim().toLowerCase();
  const hasCountrySubset = Boolean(country && country !== 'global');
  const fr = options.functionRoot?.trim().toLowerCase() ?? '';
  const hasFunctionSubset = fr.length > 0 && fr !== 'fullcompany';
  return hasCountrySubset || hasFunctionSubset;
}

function normalizeFunctionToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/assist$/u, '');
}

function normalizeParentKey(p: unknown): number | string {
  if (p === '' || p === null || p === undefined) {
    return '';
  }
  return typeof p === 'number' ? p : Number(p);
}

function buildChildrenMap(nodes: OrgChartNode[]): Map<number | string, number[]> {
  const children = new Map<number | string, number[]>();

  for (const n of nodes) {
    const pk = normalizeParentKey(n.parent);
    if (!children.has(pk)) {
      children.set(pk, []);
    }
    children.get(pk)!.push(n.key);
  }

  return children;
}

function collectDescendants(
  rootKeys: number[],
  children: Map<number | string, number[]>,
): Set<number> {
  const out = new Set<number>();
  const stack = [...rootKeys];

  while (stack.length > 0) {
    const k = stack.pop();

    if (k === undefined) {
      continue;
    }
    if (out.has(k)) {
      continue;
    }
    out.add(k);
    for (const c of children.get(k) ?? []) {
      stack.push(c);
    }
  }

  return out;
}

function collectAncestors(
  seedKeys: number[],
  byKey: Map<number, OrgChartNode>,
): Set<number> {
  const out = new Set<number>();

  for (const seed of seedKeys) {
    let k: number | undefined = seed;

    while (k !== undefined) {
      out.add(k);
      const n = byKey.get(k);
      if (!n) {
        break;
      }
      const p = n.parent;
      if (p === '' || p === null || p === undefined) {
        break;
      }
      k = typeof p === 'number' ? p : Number(p);
    }
  }

  return out;
}

function findFunctionSeedKeys(
  nodes: OrgChartNode[],
  requested: string,
): number[] {
  const req = normalizeFunctionToken(requested);
  const direct = nodes
    .filter((n) => {
      const root = normalizeFunctionToken(String(n.std_function_root ?? ''));
      const fn = normalizeFunctionToken(String(n.std_function ?? ''));
      return root === req || fn === req;
    })
    .map((n) => n.key);

  if (direct.length > 0) {
    return direct;
  }

  return nodes
    .filter((n) => {
      const root = normalizeFunctionToken(String(n.std_function_root ?? ''));
      return root.includes(req) || req.includes(root);
    })
    .map((n) => n.key);
}

function rewireParentsForKeptNodes(
  fullNodes: OrgChartNode[],
  keepSet: Set<number>,
): OrgChartNode[] {
  const byKey = new Map(fullNodes.map((n) => [n.key, n]));

  return fullNodes
    .filter((n) => keepSet.has(n.key))
    .map((n) => {
      let p: number | string | undefined = n.parent;

      while (true) {
        if (p === '' || p === null || p === undefined) {
          return { ...n, parent: '' };
        }
        const pk = typeof p === 'number' ? p : Number(p);
        if (keepSet.has(pk)) {
          return { ...n, parent: pk };
        }
        const parentNode = byKey.get(pk);
        if (!parentNode) {
          return { ...n, parent: '' };
        }
        p = parentNode.parent;
      }
    });
}

function applyCountryToCandidates(
  nodes: OrgChartNode[],
  country: string,
): OrgChartNode[] {
  const c = country.trim();
  return nodes.map((node) => {
    const cand = node.candidates;
    if (!Array.isArray(cand)) {
      return node;
    }
    return {
      ...node,
      candidates: cand.map((row) => ({
        ...row,
        location_country: c,
        location_name: c,
      })),
    };
  });
}

const COUNTRY_SUBSET_MAX_NODES = 72;

const FUNCTION_MISS_MAX_NODES = 80;

/** Max direct reports of the org root (CEO). */
const MAX_DIRECT_CHILDREN_OF_ROOT = 6;

/** Among direct children of root, at most this many may be leaves (no subordinates). */
const MAX_LEAF_DIRECT_CHILDREN_OF_ROOT = 2;

/** Max children for each direct report of the root (depth-1 parent). */
const MAX_CHILDREN_PER_DEPTH1_PARENT = 6;

/** CEO direct reports to omit from the default blank-template sample. */
const EXCLUDED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS = new Set(['education']);

/** CEO direct reports to prioritize in the default blank-template sample. */
const PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS = [
  'human resources',
  'technology',
  'finance',
  'sales',
] as const;

/** Functions that receive extra manager nodes in the blank-template sample. */
const BLANK_TEMPLATE_MANAGER_FUNCTION_ROOTS = [
  'human resources',
  'finance',
  'sales',
  'manufacturing',
  'technology',
] as const;

function getNodeFunctionRootToken(node: OrgChartNode): string {
  return normalizeFunctionToken(String(node.std_function_root ?? ''));
}

function getNodeFunctionToken(node: OrgChartNode): string {
  return normalizeFunctionToken(String(node.std_function ?? ''));
}

function isBlankTemplateManagerNode(node: OrgChartNode): boolean {
  const grade = normalizeFunctionToken(String(node.std_grade ?? ''));
  const headline = String(node.headline ?? '').toUpperCase();

  return grade === 'mid' || headline.includes('MANAGERS');
}

function isBlankTemplateLeadershipNode(node: OrgChartNode): boolean {
  const grade = normalizeFunctionToken(String(node.std_grade ?? ''));
  const headline = String(node.headline ?? '').toUpperCase();

  return grade === 'leadership' || headline.includes('LEADERSHIP');
}

function matchesBlankTemplateManagerFunctionRoot(
  node: OrgChartNode,
  functionRoot: string,
): boolean {
  const target = normalizeFunctionToken(functionRoot);

  if (target === 'manufacturing') {
    return getNodeFunctionToken(node).includes('manufacturing');
  }

  const root = getNodeFunctionRootToken(node);
  const fn = getNodeFunctionToken(node);

  return root === target || fn === target;
}

function hashBlankTemplateSeed(...parts: Array<string | number>): number {
  let hash = 2166136261;

  for (const part of parts) {
    const value = String(part);
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }

  return hash >>> 0;
}

function pickDeterministicSubset<T>(
  items: T[],
  count: number,
  seed: number,
): T[] {
  if (count <= 0 || items.length === 0) {
    return [];
  }

  const pool = items.slice();
  const picked: T[] = [];
  let state = seed;

  while (picked.length < count && pool.length > 0) {
    state = Math.imul(state, 1664525) + 1013904223;
    const index = (state >>> 0) % pool.length;
    picked.push(pool[index]!);
    pool.splice(index, 1);
  }

  return picked;
}

function pickDepth2ChildrenForBlankTemplate(
  parentKey: number,
  childKeys: number[],
  byKey: Map<number, OrgChartNode>,
  maxCount: number,
): number[] {
  const parentNode = byKey.get(parentKey);
  if (!parentNode) {
    return childKeys.slice().sort((a, b) => a - b).slice(0, maxCount);
  }

  const parentFunctionRoot = getNodeFunctionRootToken(parentNode);
  const shouldPreferManagers =
    BLANK_TEMPLATE_MANAGER_FUNCTION_ROOTS.includes(
      parentFunctionRoot as (typeof BLANK_TEMPLATE_MANAGER_FUNCTION_ROOTS)[number],
    ) || parentFunctionRoot === 'engineering';

  if (!shouldPreferManagers) {
    return childKeys.slice().sort((a, b) => a - b).slice(0, maxCount);
  }

  const managers = childKeys.filter((key) => {
    const node = byKey.get(key);
    return node ? isBlankTemplateManagerNode(node) : false;
  });
  const nonManagers = childKeys.filter((key) => {
    const node = byKey.get(key);
    return node ? !isBlankTemplateManagerNode(node) : false;
  });
  const seed = hashBlankTemplateSeed(parentFunctionRoot, parentKey);
  const managerPickCount = Math.min(
    managers.length,
    1 + (seed % 2),
  );
  const pickedManagers = pickDeterministicSubset(
    managers,
    managerPickCount,
    seed,
  );
  const manufacturingLeadership =
    parentFunctionRoot === 'engineering'
      ? nonManagers.filter((key) => {
          const node = byKey.get(key);
          return (
            node &&
            matchesBlankTemplateManagerFunctionRoot(node, 'manufacturing') &&
            isBlankTemplateLeadershipNode(node)
          );
        })
      : [];
  const remainingNonManagers = nonManagers.filter(
    (key) => !manufacturingLeadership.includes(key),
  );
  const remainingSlots = Math.max(
    0,
    maxCount - pickedManagers.length - manufacturingLeadership.length,
  );
  const pickedOthers = pickDeterministicSubset(
    remainingNonManagers.slice().sort((a, b) => a - b),
    remainingSlots,
    seed + 17,
  );

  return [...pickedManagers, ...manufacturingLeadership, ...pickedOthers].slice(
    0,
    maxCount,
  );
}

type BlankOrgChartRootShapeOptions = {
  enrichManagers?: boolean;
  maxManagersPerFunctionRoot?: number;
  maxTotalNodes?: number;
};

function addManufacturingManagerChains(
  keep: Set<number>,
  children: Map<number | string, number[]>,
  byKey: Map<number, OrgChartNode>,
  options: BlankOrgChartRootShapeOptions = {},
): void {
  const maxTotalNodes = options.maxTotalNodes;
  const engineeringKeys = [...keep].filter((key) => {
    const node = byKey.get(key);
    return (
      node &&
      getNodeFunctionRootToken(node) === 'engineering' &&
      isBlankTemplateLeadershipNode(node)
    );
  });

  for (const engineeringKey of engineeringKeys) {
    const manufacturingLeadership = (children.get(engineeringKey) ?? []).filter(
      (key) => {
        const node = byKey.get(key);
        return (
          node &&
          matchesBlankTemplateManagerFunctionRoot(node, 'manufacturing') &&
          isBlankTemplateLeadershipNode(node)
        );
      },
    );

    for (const leadershipKey of manufacturingLeadership) {
      keep.add(leadershipKey);
      const managerCandidates = (children.get(leadershipKey) ?? []).filter(
        (key) => {
          const node = byKey.get(key);
          return (
            node &&
            isBlankTemplateManagerNode(node) &&
            matchesBlankTemplateManagerFunctionRoot(node, 'manufacturing')
          );
        },
      );
      const seed = hashBlankTemplateSeed('manufacturing', leadershipKey);
      const pickedManagers = pickDeterministicSubset(
        managerCandidates,
        Math.min(managerCandidates.length, 1),
        seed,
      );

      for (const managerKey of pickedManagers) {
        if (
          maxTotalNodes !== undefined &&
          keep.size + 1 > maxTotalNodes
        ) {
          return;
        }

        keep.add(managerKey);
        for (const teamKey of children.get(managerKey) ?? []) {
          if (
            maxTotalNodes !== undefined &&
            keep.size + 1 > maxTotalNodes
          ) {
            return;
          }
          keep.add(teamKey);
        }
      }
    }
  }
}

function extendKeepSetWithRandomManagerChains(
  keep: Set<number>,
  sourceNodes: OrgChartNode[],
  children: Map<number | string, number[]>,
  byKey: Map<number, OrgChartNode>,
  options: BlankOrgChartRootShapeOptions = {},
): void {
  const maxManagersPerFunctionRoot = options.maxManagersPerFunctionRoot ?? 2;
  const maxTotalNodes = options.maxTotalNodes;
  const root = sourceNodes.find(
    (node) => node.parent === '' || node.parent === null || node.parent === undefined,
  );
  const rootKey = root?.key;

  for (const functionRoot of BLANK_TEMPLATE_MANAGER_FUNCTION_ROOTS) {
    let addedForFunction = 0;
    const leadershipKeys = [...keep].filter((key) => {
      const node = byKey.get(key);
      if (!node || !isBlankTemplateLeadershipNode(node)) {
        return false;
      }

      if (!matchesBlankTemplateManagerFunctionRoot(node, functionRoot)) {
        return false;
      }

      if (rootKey === undefined) {
        return true;
      }

      const parentKey = normalizeParentKey(node.parent);
      const isCeoDirectReport = parentKey === rootKey;
      const parentNode =
        typeof parentKey === 'number' ? byKey.get(parentKey) : undefined;
      const isDepth2UnderTargetFunction =
        parentNode !== undefined &&
        normalizeParentKey(parentNode.parent) === rootKey &&
        matchesBlankTemplateManagerFunctionRoot(parentNode, functionRoot);

      return isCeoDirectReport || isDepth2UnderTargetFunction;
    });

    for (const leadershipKey of leadershipKeys) {
      if (addedForFunction >= maxManagersPerFunctionRoot) {
        break;
      }

      const managerCandidates = (children.get(leadershipKey) ?? []).filter(
        (key) => {
          const node = byKey.get(key);
          return (
            node &&
            isBlankTemplateManagerNode(node) &&
            matchesBlankTemplateManagerFunctionRoot(node, functionRoot)
          );
        },
      );
      const seed = hashBlankTemplateSeed(functionRoot, leadershipKey);
      const managerPickCount = Math.min(
        managerCandidates.length,
        1,
        maxManagersPerFunctionRoot - addedForFunction,
      );
      const pickedManagers = pickDeterministicSubset(
        managerCandidates,
        managerPickCount,
        seed,
      );

      for (const managerKey of pickedManagers) {
        if (
          maxTotalNodes !== undefined &&
          keep.size + 1 > maxTotalNodes
        ) {
          return;
        }

        keep.add(managerKey);
        addedForFunction += 1;

        for (const teamKey of children.get(managerKey) ?? []) {
          if (
            maxTotalNodes !== undefined &&
            keep.size + 1 > maxTotalNodes
          ) {
            return;
          }
          keep.add(teamKey);
        }
      }
    }
  }

  addManufacturingManagerChains(keep, children, byKey, options);
}

function isExcludedBlankTemplateRootBranch(node: OrgChartNode): boolean {
  const functionRoot = getNodeFunctionRootToken(node);
  const stdFunction = normalizeFunctionToken(String(node.std_function ?? ''));

  return (
    EXCLUDED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS.has(functionRoot) &&
    stdFunction.includes('teacher')
  );
}

function comparePreferredBlankTemplateRootBranches(
  aKey: number,
  bKey: number,
  byKey: Map<number, OrgChartNode>,
): number {
  const aRoot = getNodeFunctionRootToken(byKey.get(aKey)!);
  const bRoot = getNodeFunctionRootToken(byKey.get(bKey)!);
  const aIndex = PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS.indexOf(
    aRoot as (typeof PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS)[number],
  );
  const bIndex = PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS.indexOf(
    bRoot as (typeof PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS)[number],
  );

  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }

  return aKey - bKey;
}

/**
 * Enforces a shallow, readable blank-template shape: at most 6 direct reports of
 * the root, at most 2 of those may be leaves, and each non-leaf direct report
 * keeps at most 6 children (grandchildren of root). Deeper nodes are dropped.
 */
function applyBlankOrgChartRootShapeConstraints(
  nodes: OrgChartNode[],
  sourceNodes: OrgChartNode[] = nodes,
  options: BlankOrgChartRootShapeOptions = {},
): OrgChartNode[] {
  const children = buildChildrenMap(sourceNodes);
  const byKey = new Map(sourceNodes.map((n) => [n.key, n]));
  const root = nodes.find(
    (n) => n.parent === '' || n.parent === null || n.parent === undefined,
  );

  if (!root) {
    return nodes;
  }

  const rootKey = root.key;
  const direct = (children.get(rootKey) ?? [])
    .slice()
    .sort((a, b) => a - b)
    .filter((k) => {
      const node = byKey.get(k);
      return node ? !isExcludedBlankTemplateRootBranch(node) : false;
    });

  const preferredBranches: number[] = [];
  const otherBranches: number[] = [];
  const leaves: number[] = [];

  for (const k of direct) {
    const node = byKey.get(k);
    if (!node) {
      continue;
    }

    if ((children.get(k)?.length ?? 0) > 0) {
      const functionRoot = getNodeFunctionRootToken(node);
      if (
        PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS.includes(
          functionRoot as (typeof PREFERRED_BLANK_TEMPLATE_ROOT_FUNCTION_ROOTS)[number],
        )
      ) {
        preferredBranches.push(k);
      } else {
        otherBranches.push(k);
      }
      continue;
    }

    leaves.push(k);
  }

  preferredBranches.sort((a, b) =>
    comparePreferredBlankTemplateRootBranches(a, b, byKey),
  );

  const maxDirectChildren =
    options.maxTotalNodes !== undefined && options.maxTotalNodes <= 32
      ? Math.min(4, MAX_DIRECT_CHILDREN_OF_ROOT)
      : MAX_DIRECT_CHILDREN_OF_ROOT;
  const maxChildrenPerDepth1Parent =
    options.maxTotalNodes !== undefined && options.maxTotalNodes <= 32
      ? Math.min(3, MAX_CHILDREN_PER_DEPTH1_PARENT)
      : MAX_CHILDREN_PER_DEPTH1_PARENT;
  const canAddToKeep = (key: number): boolean => {
    if (options.maxTotalNodes === undefined) {
      return true;
    }

    return keep.size + 1 <= options.maxTotalNodes || keep.has(key);
  };

  const pickedRoot: number[] = [];

  for (const k of preferredBranches) {
    if (pickedRoot.length >= maxDirectChildren) {
      break;
    }
    pickedRoot.push(k);
  }

  for (const k of otherBranches) {
    if (pickedRoot.length >= maxDirectChildren) {
      break;
    }
    pickedRoot.push(k);
  }

  for (const k of leaves) {
    if (pickedRoot.length >= maxDirectChildren) {
      break;
    }
    const leafDirectCount = pickedRoot.filter(
      (pk) => (children.get(pk)?.length ?? 0) === 0,
    ).length;

    if (leafDirectCount >= MAX_LEAF_DIRECT_CHILDREN_OF_ROOT) {
      break;
    }
    pickedRoot.push(k);
  }

  const keep = new Set<number>([rootKey]);

  for (const pk of pickedRoot) {
    if (!canAddToKeep(pk)) {
      continue;
    }
    keep.add(pk);
    const subs = children.get(pk);

    if (!subs || subs.length === 0) {
      continue;
    }

    const pickedSubs = pickDepth2ChildrenForBlankTemplate(
      pk,
      subs,
      byKey,
      maxChildrenPerDepth1Parent,
    );

    for (const g of pickedSubs) {
      if (!canAddToKeep(g)) {
        continue;
      }
      keep.add(g);
    }
  }

  if (options.enrichManagers === true) {
    extendKeepSetWithRandomManagerChains(
      keep,
      sourceNodes,
      children,
      byKey,
      options,
    );
  }

  const combinedByKey = new Map(sourceNodes.map((node) => [node.key, node]));
  for (const node of nodes) {
    combinedByKey.set(node.key, node);
  }

  return rewireParentsForKeptNodes([...combinedByKey.values()], keep);
}

function breadthFirstLimit(
  nodes: OrgChartNode[],
  maxNodes: number,
): OrgChartNode[] {
  const children = buildChildrenMap(nodes);
  const root = nodes.find(
    (n) => n.parent === '' || n.parent === null || n.parent === undefined,
  );
  const rootKey = root?.key;
  if (rootKey === undefined) {
    return nodes.slice(0, Math.min(maxNodes, nodes.length));
  }

  const ordered: number[] = [];
  const queue: number[] = [rootKey];
  const seen = new Set<number>();

  while (queue.length > 0 && ordered.length < maxNodes) {
    const k = queue.shift();
    if (k === undefined || seen.has(k)) {
      continue;
    }
    seen.add(k);
    ordered.push(k);
    for (const c of children.get(k) ?? []) {
      queue.push(c);
    }
  }

  const keepSet = new Set(ordered);
  return rewireParentsForKeptNodes(nodes, keepSet);
}

function filterCountryOnlySubset(
  nodes: OrgChartNode[],
  country: string,
): OrgChartNode[] {
  const trimmed = breadthFirstLimit(nodes, COUNTRY_SUBSET_MAX_NODES);
  return applyCountryToCandidates(trimmed, country);
}

function filterFunctionSubset(
  nodes: OrgChartNode[],
  functionRoot: string,
): OrgChartNode[] {
  const children = buildChildrenMap(nodes);
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const seeds = findFunctionSeedKeys(nodes, functionRoot);

  if (seeds.length === 0) {
    return breadthFirstLimit(nodes, FUNCTION_MISS_MAX_NODES);
  }

  const desc = collectDescendants(seeds, children);
  const anc = collectAncestors(seeds, byKey);
  const keepSet = new Set([...desc, ...anc]);

  return rewireParentsForKeptNodes(nodes, keepSet);
}

function parseOrgChartArray(raw: unknown): OrgChartNode[] | null {
  if (Array.isArray(raw)) {
    return raw as OrgChartNode[];
  }
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OrgChartNode[]) : null;
  } catch {
    return null;
  }
}

/**
 * Returns a copy of `parsed` blank payload with `orgchart` (and nested
 * `list_orgcharts[0]`) trimmed for subset views.
 */
export function applyBlankOrgChartSubsetFilter(
  parsed: Record<string, unknown>,
  options: BlankOrgChartSubsetOptions,
): Record<string, unknown> {
  if (!isBlankSubsetRequest(options)) {
    return parsed;
  }

  const countryRaw = options.country?.trim() ?? '';
  const countryLower = countryRaw.toLowerCase();
  const hasCountrySubset = countryLower.length > 0 && countryLower !== 'global';
  const frRaw = options.functionRoot?.trim() ?? '';
  const frLower = frRaw.toLowerCase();
  const hasFunctionSubset =
    frLower.length > 0 && frLower !== 'fullcompany';

  const orgchartRaw = parsed.orgchart;
  const nodes = parseOrgChartArray(orgchartRaw);

  if (!nodes || nodes.length === 0) {
    return parsed;
  }

  let nextNodes: OrgChartNode[];

  if (hasFunctionSubset) {
    nextNodes = filterFunctionSubset(nodes, frRaw);
    if (hasCountrySubset) {
      nextNodes = applyCountryToCandidates(nextNodes, countryRaw);
    }
  } else if (hasCountrySubset) {
    nextNodes = filterCountryOnlySubset(nodes, countryRaw);
  } else {
    nextNodes = nodes;
  }

  const shapedNodes = applyBlankOrgChartRootShapeConstraints(nextNodes, nodes, {
    enrichManagers: false,
  });
  const orgchartStr = JSON.stringify(shapedNodes);
  const out: Record<string, unknown> = {
    ...parsed,
    orgchart: orgchartStr,
  };

  const list = out.list_orgcharts;
  if (Array.isArray(list) && list.length > 0 && typeof list[0] === 'string') {
    try {
      const inner = JSON.parse(list[0]) as Record<string, unknown>;
      inner.orgchart = orgchartStr;
      if (hasCountrySubset) {
        inner.country = countryRaw;
      }
      if (hasFunctionSubset) {
        inner.type = frRaw;
      }
      out.list_orgcharts = [JSON.stringify(inner)];
    } catch {
      // keep list_orgcharts unchanged
    }
  }

  return out;
}

/**
 * Maps an expected employee / headcount hint (from autocomplete, PDL profile
 * count, or LinkedIn) to a max node count for the static blank org chart
 * template. The template JSON is large (~340 nodes); small companies get a
 * much smaller BFS slice so the placeholder matches perceived scale.
 */
export function expectedEmployeeCountToMaxBlankNodes(
  expectedEmployeeCount: number | undefined,
): number {
  if (
    expectedEmployeeCount === undefined ||
    !Number.isFinite(expectedEmployeeCount) ||
    expectedEmployeeCount <= 0
  ) {
    return 120;
  }
  const n = Math.floor(expectedEmployeeCount);
  if (n <= 50) {
    return 18;
  }
  if (n <= 200) {
    return 32;
  }
  if (n <= 1000) {
    return 56;
  }
  if (n <= 5000) {
    return 88;
  }
  if (n <= 50000) {
    return 140;
  }
  return 220;
}

/**
 * Trims the blank org chart tree to a breadth-first cap derived from expected
 * headcount, then applies root fan-out / leaf constraints. Runs after subset
 * (country/function) filtering when both apply.
 */
export function applyBlankOrgChartSizeForExpectedHeadcount(
  parsed: Record<string, unknown>,
  expectedEmployeeCount: number | undefined,
): Record<string, unknown> {
  const maxNodes = expectedEmployeeCountToMaxBlankNodes(expectedEmployeeCount);
  const orgchartRaw = parsed.orgchart;
  const nodes = parseOrgChartArray(orgchartRaw);

  if (!nodes || nodes.length === 0) {
    return parsed;
  }

  let nextNodes = applyBlankOrgChartRootShapeConstraints(nodes, nodes, {
    enrichManagers: true,
    maxManagersPerFunctionRoot: 2,
    maxTotalNodes: maxNodes,
  });

  if (nextNodes.length > maxNodes) {
    nextNodes = breadthFirstLimit(nextNodes, maxNodes);
  }
  const orgchartStr = JSON.stringify(nextNodes);
  const out: Record<string, unknown> = {
    ...parsed,
    orgchart: orgchartStr,
  };

  const list = out.list_orgcharts;
  if (Array.isArray(list) && list.length > 0 && typeof list[0] === 'string') {
    try {
      const inner = JSON.parse(list[0]) as Record<string, unknown>;
      inner.orgchart = orgchartStr;
      out.list_orgcharts = [JSON.stringify(inner)];
    } catch {
      // keep list_orgcharts unchanged
    }
  }

  return out;
}

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

/**
 * Enforces a shallow, readable blank-template shape: at most 6 direct reports of
 * the root, at most 2 of those may be leaves, and each non-leaf direct report
 * keeps at most 6 children (grandchildren of root). Deeper nodes are dropped.
 */
function applyBlankOrgChartRootShapeConstraints(
  nodes: OrgChartNode[],
): OrgChartNode[] {
  const children = buildChildrenMap(nodes);
  const root = nodes.find(
    (n) => n.parent === '' || n.parent === null || n.parent === undefined,
  );

  if (!root) {
    return nodes;
  }

  const rootKey = root.key;
  const direct = (children.get(rootKey) ?? []).slice().sort((a, b) => a - b);

  const branches: number[] = [];
  const leaves: number[] = [];

  for (const k of direct) {
    if ((children.get(k)?.length ?? 0) > 0) {
      branches.push(k);
    } else {
      leaves.push(k);
    }
  }

  const pickedRoot: number[] = [];

  for (const k of branches) {
    if (pickedRoot.length >= MAX_DIRECT_CHILDREN_OF_ROOT) {
      break;
    }
    pickedRoot.push(k);
  }

  for (const k of leaves) {
    if (pickedRoot.length >= MAX_DIRECT_CHILDREN_OF_ROOT) {
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
    keep.add(pk);
    const subs = children.get(pk);

    if (!subs || subs.length === 0) {
      continue;
    }

    const sortedSubs = subs.slice().sort((a, b) => a - b);

    for (const g of sortedSubs.slice(0, MAX_CHILDREN_PER_DEPTH1_PARENT)) {
      keep.add(g);
    }
  }

  return rewireParentsForKeptNodes(nodes, keep);
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

  const shapedNodes = applyBlankOrgChartRootShapeConstraints(nextNodes);
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

  const afterBfs =
    nodes.length > maxNodes ? breadthFirstLimit(nodes, maxNodes) : nodes;
  const nextNodes = applyBlankOrgChartRootShapeConstraints(afterBfs);
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

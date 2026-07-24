/**
 * Post-filter LinkedIn org-chart candidates for `current_node` / `selected_nodes`
 * using standardized function + grade labels (aligned with arxena-site boolean
 * standardization and ResultsModifications people filters).
 */

export type OrgChartNodeStdScope = {
  stdFunction?: string;
  stdGrade?: string;
};

export const normalizeOrgChartStdLabel = (value?: string): string => {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
};

const readCandidateStdFunction = (
  raw: Record<string, unknown>,
): string | undefined => {
  const a = raw.std_function;
  const b = raw.stdFunction;
  const c = raw.std_function_root;
  if (typeof a === 'string' && a.trim()) {
    return a;
  }
  if (typeof b === 'string' && b.trim()) {
    return b;
  }
  if (typeof c === 'string' && c.trim()) {
    return c;
  }
  return undefined;
};

const readCandidateStdGrade = (
  raw: Record<string, unknown>,
): string | undefined => {
  const a = raw.std_grade;
  const b = raw.stdGrade;
  if (typeof a === 'string' && a.trim()) {
    return a;
  }
  if (typeof b === 'string' && b.trim()) {
    return b;
  }
  return undefined;
};

const matchOptionalStdLabel = (
  candidateRaw: string | undefined,
  targetNormalized: string,
): boolean => {
  if (!targetNormalized) {
    return true;
  }
  const c = normalizeOrgChartStdLabel(candidateRaw);
  if (!c) {
    return false;
  }
  return (
    c === targetNormalized ||
    c.includes(targetNormalized) ||
    targetNormalized.includes(c)
  );
};

const candidateMatchesScope = (
  raw: Record<string, unknown>,
  scope: OrgChartNodeStdScope,
): boolean => {
  const tFn = normalizeOrgChartStdLabel(scope.stdFunction);
  const tGr = normalizeOrgChartStdLabel(scope.stdGrade);
  if (!tFn && !tGr) {
    return true;
  }
  const fnOk = matchOptionalStdLabel(readCandidateStdFunction(raw), tFn);
  const grOk = matchOptionalStdLabel(readCandidateStdGrade(raw), tGr);
  return fnOk && grOk;
};

/**
 * `current_node`: single pair via stdFunction/stdGrade (or one entry in selectedNodeStdScopes).
 * `selected_nodes`: OR across `selectedNodeStdScopes` — candidate kept if it matches any scope
 * (each scope uses AND between function and grade when both are set).
 */
export const filterOrgChartCandidatesByNodeStdLabels = (
  items: unknown[],
  mode: string | undefined,
  args: {
    stdFunction?: string;
    stdGrade?: string;
    selectedNodeStdScopes?: OrgChartNodeStdScope[];
  },
): unknown[] => {
  if (mode !== 'current_node' && mode !== 'selected_nodes') {
    return items;
  }

  const fromArray = (args.selectedNodeStdScopes ?? [])
    .map((s) => ({
      stdFunction: s.stdFunction?.trim(),
      stdGrade: s.stdGrade?.trim(),
    }))
    .filter((s) => (s.stdFunction?.length ?? 0) > 0 || (s.stdGrade?.length ?? 0) > 0);

  const legacyPair: OrgChartNodeStdScope[] =
    (args.stdFunction?.trim() || args.stdGrade?.trim()) && fromArray.length === 0
      ? [
          {
            stdFunction: args.stdFunction?.trim(),
            stdGrade: args.stdGrade?.trim(),
          },
        ]
      : [];

  const scopes: OrgChartNodeStdScope[] =
    fromArray.length > 0 ? fromArray : legacyPair;

  if (scopes.length === 0) {
    return items;
  }

  if (mode === 'current_node' || scopes.length === 1) {
    const scope = scopes[0]!;
    return items.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      return candidateMatchesScope(item as Record<string, unknown>, scope);
    });
  }

  return items.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const raw = item as Record<string, unknown>;
    return scopes.some((scope) => candidateMatchesScope(raw, scope));
  });
};

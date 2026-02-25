/**
 * Extracts and processes org chart data for GoJS TreeModel.
 * Matches arxena getOrgChartJsonObj + processCandidate structure.
 */

type Candidate = {
  full_name?: string | null;
  job_title?: string | null;
  image?: string | null;
  std_linkedin_url?: string | null;
  location_name?: string | null;
  [key: string]: unknown;
};

type RawOrgNode = {
  key?: number;
  parent?: number;
  headline?: string;
  candidates?: Candidate[] | Candidate;
  country?: string;
  std_function?: string;
  std_grade?: string;
  [key: string]: unknown;
};

export type NodeState = 'preview' | 'active' | 'lock';

export type OrgChartNodeData = {
  key: number;
  parent?: number;
  headline: string;
  country?: string;
  category?: string;
  nodeState?: NodeState;
  [key: string]: unknown;
};

const isMaskedName = (name: string | null | undefined): boolean => {
  if (!name) return true;

  const normalized = name.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return true;

  if (normalized === 'unknownlinkedinmember') {
    return true;
  }

  return /^x+$/u.test(normalized) || /^[xy]+$/u.test(normalized);
};

const isUnknownCandidate = (candidate: Candidate | null | undefined): boolean => {
  if (!candidate) return true;

  const fullName = (candidate.full_name ?? '').trim().toLowerCase();
  const linkedinUrl =
    (candidate.std_linkedin_url ??
      (candidate as { linkedin_url?: string }).linkedin_url ??
      '') as string;

  return (
    fullName === 'unknown linkedin member' ||
    fullName === '' ||
    (typeof linkedinUrl === 'string' &&
      linkedinUrl.includes('search/results/people/headless'))
  );
};

function processCandidate(
  candidate: Candidate,
  node: OrgChartNodeData,
  index: number,
): void {
  node[`title_${index}`] =
    candidate?.job_title != null ? candidate.job_title : '';
  node[`name_${index}`] =
    candidate?.full_name != null ? candidate.full_name : '';
  node[`image_${index}`] = candidate?.image != null ? candidate.image : '';
  const linkedinUrl =
    candidate?.std_linkedin_url ??
    (candidate as { linkedin_url?: string } | undefined)?.linkedin_url ??
    '';
  node[`linkedin_url_${index}`] =
    linkedinUrl && linkedinUrl !== '0' ? linkedinUrl : '';
}

/**
 * Extract org_data from API response. Handles both direct and nested structures.
 */
export function extractOrgData(
  data: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!data) return null;

  const nested =
    (data.results as Record<string, unknown> | undefined)?.data as
      | Record<string, unknown>
      | undefined;
  const modified = nested?.modified_query_results;

  if (modified && typeof modified === 'object') {
    return modified as Record<string, unknown>;
  }
  if (data.orgchart != null || data.company_id != null) {
    return data;
  }
  return null;
}

/**
 * Process raw org chart data to GoJS nodeDataArray for TreeModel.
 */
export function processOrgChartToNodeData(
  orgData: Record<string, unknown>,
): OrgChartNodeData[] {
  const orgchartStr = orgData.orgchart;
  if (typeof orgchartStr !== 'string') return [];

  let rawNodes: RawOrgNode[];
  try {
    rawNodes = JSON.parse(orgchartStr) as RawOrgNode[];
  } catch {
    return [];
  }

  if (!Array.isArray(rawNodes)) return [];

  const result: OrgChartNodeData[] = [];
  let lastKey = 1;

  const getFlatCandidate = (node: RawOrgNode, i: number): Candidate | null => {
    const name = node[`name_${i}`];
    const title = node[`title_${i}`];
    const url = node[`linkedin_url_${i}`] ?? node[`url_${i}`];
    const fullName =
      name !== undefined && name !== null && name !== '' && name !== 0
        ? String(name)
        : null;
    const stdUrl =
      url !== undefined && url !== null && url !== '' && url !== 0
        ? String(url)
        : null;
    if (!fullName && !stdUrl) return null;
    return {
      full_name: fullName ?? undefined,
      job_title:
        title !== undefined && title !== null && title !== '' && title !== 0
          ? String(title)
          : undefined,
      std_linkedin_url: stdUrl ?? undefined,
    };
  };

  for (const raw of rawNodes) {
    const candidates = raw.candidates;
    let candidatesArr = Array.isArray(candidates)
      ? candidates
      : candidates
        ? [candidates as Candidate]
        : [];

    if (candidatesArr.length === 0) {
      const flatCandidates: Candidate[] = [];
      for (let i = 0; i < 4; i++) {
        const c = getFlatCandidate(raw, i);
        if (c) flatCandidates.push(c);
      }
      candidatesArr = flatCandidates;
    }

    let orderedCandidates = candidatesArr;

    try {
      if (candidatesArr.length > 0) {
        const knownCandidates = candidatesArr.filter(
          (candidate) => !isUnknownCandidate(candidate),
        );
        const unknownCandidates = candidatesArr.filter((candidate) =>
          isUnknownCandidate(candidate),
        );

        if (unknownCandidates.length > 0) {
          orderedCandidates = [...knownCandidates, ...unknownCandidates];
        }
      }
    } catch {
      orderedCandidates = candidatesArr;
    }

    const hasRealNamedCandidate = orderedCandidates.some(
      (candidate) => isMaskedName(candidate.full_name ?? null) === false,
    );

    let nodeState: NodeState = 'preview';
    const rawNodeState = (raw as { nodeState?: unknown }).nodeState;
    if (
      rawNodeState === 'active' ||
      rawNodeState === 'preview' ||
      rawNodeState === 'lock'
    ) {
      nodeState = rawNodeState;
    } else if (hasRealNamedCandidate) {
      nodeState = 'active';
    }

    const node: OrgChartNodeData = {
      key: typeof raw.key === 'number' ? raw.key : lastKey++,
      parent: typeof raw.parent === 'number' ? raw.parent : undefined,
      headline: raw.headline ?? 'Unknown',
      country: raw.country as string | undefined,
      category: 'detailed',
      nodeState,
    };

    if (typeof raw.std_function === 'string') {
      (node as Record<string, unknown>).std_function = raw.std_function;
    }

    if (typeof raw.std_grade === 'string') {
      (node as Record<string, unknown>).std_grade = raw.std_grade;
    }

    for (let i = 0; i < orderedCandidates.length && i < 4; i++) {
      processCandidate(orderedCandidates[i], node, i);
    }
    node.total_people = orderedCandidates.length;

    const PERSON_ROW_HEIGHT = 48;
    (node as Record<string, unknown>).height_0 =
      orderedCandidates.length >= 1 ? PERSON_ROW_HEIGHT : 0;
    (node as Record<string, unknown>).height_1 =
      orderedCandidates.length >= 2 ? PERSON_ROW_HEIGHT : 0;
    (node as Record<string, unknown>).height_2 =
      orderedCandidates.length >= 3 ? PERSON_ROW_HEIGHT : 0;
    (node as Record<string, unknown>).height_3 =
      orderedCandidates.length >= 4 ? PERSON_ROW_HEIGHT : 0;

    result.push(node);
  }

  return result;
}

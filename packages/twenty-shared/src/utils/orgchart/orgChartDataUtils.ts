import { toTitleCase } from '../strings/toTitleCase';

/**
 * Extracts and processes org chart data for GoJS TreeModel.
 * Matches arxena getOrgChartJsonObj + processCandidate structure.
 */

/** Recursive JSON value type - no unknown. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

type Candidate = {
  full_name?: string | null;
  job_title?: string | null;
  image?: string | null;
  std_linkedin_url?: string | null;
  location_name?: string | null;
  profile_picture_url?: string | null;
  linkedin_url?: string | null;
  [key: string]: JsonValue | undefined;
};

type RawOrgNode = {
  key?: number;
  parent?: number;
  headline?: string;
  candidates?: Candidate[] | Candidate;
  country?: string;
  std_function?: string;
  std_grade?: string;
  nodeState?: 'preview' | 'active' | 'lock';
  len_candidates?: number | string;
  [key: string]: JsonValue | undefined;
};

export type NodeState = 'preview' | 'active' | 'lock';

/**
 * Raw org chart payload from API/cache.
 * Shape from Python OrgStructure.create_org_charts_json_from_std_people_array.
 */
export type OrgChartData = {
  /** JSON string of node array - primary data for processing. */
  orgchart?: string;
  company_id?: string;
  count_org?: number;
  job_company_id?: string;
  job_company_name?: string;
  job_company_linkedin_url?: string;
  job_company_website?: string;
  job_id?: string;
  industry?: string;
  country?: string;
  countries?: string;
  type?: string;
  functions?: string;
  analytics?: string;
  gender_analytics?: string;
  location_analytics?: string;
  functions_analytics?: string;
  country_analytics?: string;
  /** Direct people count fields (used by inferPeopleCountFromOrgChart). */
  people_count?: number;
  peopleCount?: number;
  candidate_count?: number;
  candidateCount?: number;
  total_people?: number;
  totalPeople?: number;
  itemCount?: number;
  [key: string]: JsonValue | undefined;
};

export type OrgChartNodeData = {
  key: number;
  parent?: number;
  headline: string;
  country?: string;
  category?: string;
  nodeState?: NodeState;
  [key: string]: JsonValue | undefined;
};

export const isMaskedName = (name: string | null | undefined): boolean => {
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
    fullName === 'out of network profile' ||
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
    candidate?.job_title != null
      ? toTitleCase(candidate.job_title, { skipIfMasked: true })
      : '';
  node[`name_${index}`] =
    candidate?.full_name != null
      ? toTitleCase(candidate.full_name, { skipIfMasked: true })
      : '';
  const imageUrl =
    candidate?.image ??
    (candidate as { profile_picture_url?: string })?.profile_picture_url;
  node[`image_${index}`] =
    imageUrl != null && imageUrl !== '' ? imageUrl : '';
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
): OrgChartData | null {
  if (!data) return null;

  const nested =
    (data.results as Record<string, unknown> | undefined)?.data as
      | Record<string, unknown>
      | undefined;
  const modified = nested?.modified_query_results;

  if (modified && typeof modified === 'object') {
    return modified as OrgChartData;
  }
  if (data.orgchart != null || data.company_id != null) {
    return data as OrgChartData;
  }
  return null;
}

/**
 * Process raw org chart data to GoJS nodeDataArray for TreeModel.
 */
export function processOrgChartToNodeData(
  orgData: OrgChartData,
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
    const image = node[`image_${i}`];
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
      image:
        image !== undefined && image !== null && image !== '' && image !== 0
          ? String(image)
          : undefined,
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
      headline: toTitleCase(raw.headline ?? 'Unknown', {
        skipIfMasked: true,
      }),
      country: raw.country as string | undefined,
      category: 'detailed',
      nodeState,
    };

    if (typeof raw.std_function === 'string') {
      node.std_function = raw.std_function;
    }

    if (typeof raw.std_grade === 'string') {
      node.std_grade = raw.std_grade;
    }

    for (let i = 0; i < orderedCandidates.length && i < 4; i++) {
      processCandidate(orderedCandidates[i], node, i);
    }
    const rawLen = raw.len_candidates;
    const totalFromRaw =
      typeof rawLen === 'number' && rawLen >= 0
        ? rawLen
        : typeof rawLen === 'string' && rawLen !== ''
          ? parseInt(rawLen, 10)
          : NaN;
    node.total_people =
      !Number.isNaN(totalFromRaw) && totalFromRaw >= orderedCandidates.length
        ? totalFromRaw
        : orderedCandidates.length;
    node.allCandidates = orderedCandidates.slice();

    if (typeof console !== 'undefined') {
      console.log('[orgchart/processOrgChartToNodeData]', {
        headline: node.headline,
        key: node.key,
        totalPeople: node.total_people,
        allCandidatesLength: orderedCandidates.length,
        rawLenCandidates: raw.len_candidates,
      });
    }

    const PERSON_ROW_HEIGHT = 48;
    node.height_0 = orderedCandidates.length >= 1 ? PERSON_ROW_HEIGHT : 0;
    node.height_1 = orderedCandidates.length >= 2 ? PERSON_ROW_HEIGHT : 0;
    node.height_2 = orderedCandidates.length >= 3 ? PERSON_ROW_HEIGHT : 0;
    node.height_3 = orderedCandidates.length >= 4 ? PERSON_ROW_HEIGHT : 0;

    result.push(node);
  }

  return result;
}

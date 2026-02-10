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

export type OrgChartNodeData = {
  key: number;
  parent?: number;
  headline: string;
  country?: string;
  category?: string;
  [key: string]: unknown;
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
  node[`image_${index}`] =
    candidate?.image != null ? candidate.image : '';
  node[`linkedin_url_${index}`] =
    candidate?.std_linkedin_url != null ? candidate.std_linkedin_url : '';
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

  for (const raw of rawNodes) {
    const candidates = raw.candidates;
    const candidatesArr = Array.isArray(candidates)
      ? candidates
      : candidates
        ? [candidates as Candidate]
        : [];

    const node: OrgChartNodeData = {
      key: typeof raw.key === 'number' ? raw.key : lastKey++,
      parent: typeof raw.parent === 'number' ? raw.parent : undefined,
      headline: raw.headline ?? 'Unknown',
      country: raw.country as string | undefined,
      category: 'detailed',
    };

    if (typeof raw.std_function === 'string') {
      (node as Record<string, unknown>).std_function = raw.std_function;
    }

    if (typeof raw.std_grade === 'string') {
      (node as Record<string, unknown>).std_grade = raw.std_grade;
    }

    for (let i = 0; i < candidatesArr.length && i < 4; i++) {
      processCandidate(candidatesArr[i], node, i);
    }
    node.total_people = candidatesArr.length;

    result.push(node);
  }

  return result;
}

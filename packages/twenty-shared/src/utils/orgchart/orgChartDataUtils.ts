import { toTitleCase } from '../strings/toTitleCase';

import { isValidLinkedInProfileUrl } from './isValidLinkedInProfileUrl';

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
  email?: string | null;
  phone?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
  [key: string]: JsonValue | undefined;
};

export type RawOrgNode = {
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

const normalizeMaybeImageUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  // Some upstream payloads serialize null-ish values as strings.
  if (lowered === 'null' || lowered === 'undefined' || lowered === 'none') return '';
  // Some sources use "0" / 0 for "missing".
  if (lowered === '0') return '';
  return trimmed;
};

/**
 * Raw org chart payload from API/cache.
 * Shape from Python OrgStructure.create_org_charts_json_from_std_people_array.
 */
export type OrgChartData = {
  /** Node array, or legacy JSON string of the same (API may return either). */
  orgchart?: string | RawOrgNode[];
  company_id?: string;
  count_org?: number;
  job_company_id?: string;
  job_company_name?: string;
  job_company_linkedin_url?: string;
  job_company_website?: string;
  job_id?: string;
  industry?: string;
  country?: string;
  countries?: string | string[];
  type?: string;
  functions?: string | string[];
  analytics?: string | Record<string, JsonValue>;
  gender_analytics?: string | Record<string, number>;
  location_analytics?: string | Record<string, number>;
  functions_analytics?: string | Record<string, JsonValue>;
  country_analytics?: string | Record<string, number>;
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

function getRawOrgNodesFromOrgchartField(
  orgchart: OrgChartData['orgchart'],
): RawOrgNode[] | null {
  if (Array.isArray(orgchart)) {
    return orgchart as RawOrgNode[];
  }
  if (typeof orgchart === 'string') {
    try {
      const parsed = JSON.parse(orgchart) as unknown;
      return Array.isArray(parsed) ? (parsed as RawOrgNode[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

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
  const imageUrlRaw =
    candidate?.image ??
    (candidate as { profile_picture_url?: unknown })?.profile_picture_url;
  const imageUrl = normalizeMaybeImageUrl(imageUrlRaw);
  node[`image_${index}`] = imageUrl;
  const rawLinkedin =
    candidate?.std_linkedin_url ??
    (candidate as { linkedin_url?: string } | undefined)?.linkedin_url ??
    '';
  const linkedinUrl =
    typeof rawLinkedin === 'string' &&
    rawLinkedin !== '0' &&
    isValidLinkedInProfileUrl(rawLinkedin)
      ? rawLinkedin.trim()
      : '';
  node[`linkedin_url_${index}`] = linkedinUrl;

  const emailFromCandidate =
    typeof candidate.email === 'string' && candidate.email.trim()
      ? candidate.email.trim()
      : Array.isArray(candidate.emails) && candidate.emails.length > 0
        ? String(candidate.emails[0] ?? '').trim()
        : '';
  node[`email_${index}`] = emailFromCandidate;

  const phoneFromCandidate =
    typeof candidate.phone === 'string' && candidate.phone.trim()
      ? candidate.phone.trim()
      : Array.isArray(candidate.phones) && candidate.phones.length > 0
        ? String(candidate.phones[0] ?? '').trim()
        : '';
  node[`phone_${index}`] = phoneFromCandidate;
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
  const rawNodes = getRawOrgNodesFromOrgchartField(orgData.orgchart);
  if (!rawNodes) return [];

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

    const node: OrgChartNodeData = {
      key: typeof raw.key === 'number' ? raw.key : lastKey++,
      parent: typeof raw.parent === 'number' ? raw.parent : undefined,
      headline: toTitleCase(raw.headline ?? 'Unknown', {
        skipIfMasked: true,
      }),
      country: raw.country as string | undefined,
      category: 'detailed',
      nodeState: 'preview',
    };

    if (typeof raw.std_function === 'string') {
      node.std_function = raw.std_function;
    }

    if (typeof raw.std_grade === 'string') {
      node.std_grade = raw.std_grade;
    }

    const rawNodeFields = raw as Record<string, unknown>;
    for (let i = 0; i < orderedCandidates.length && i < 4; i++) {
      processCandidate(orderedCandidates[i], node, i);
      const candRec = orderedCandidates[i] as Record<string, unknown> | undefined;
      const tenureRaw =
        candRec?.org_chart_company_tenure ?? rawNodeFields[`org_chart_company_tenure_${i}`];
      if (tenureRaw === 'current' || tenureRaw === 'past') {
        (node as Record<string, string>)[`org_chart_company_tenure_${i}`] = tenureRaw;
      }
      const ds = rawNodeFields[`ds_${i}`];
      if (typeof ds === 'string' && ds.length > 0) {
        (node as Record<string, string>)[`ds_${i}`] = ds;
      }
      const he = rawNodeFields[`has_email_${i}`];
      if (typeof he === 'boolean') {
        (node as Record<string, boolean>)[`has_email_${i}`] = he;
      }
      const hd = rawNodeFields[`has_direct_phone_${i}`];
      if (typeof hd === 'boolean') {
        (node as Record<string, boolean>)[`has_direct_phone_${i}`] = hd;
      }
      const ho = rawNodeFields[`has_org_phone_${i}`];
      if (typeof ho === 'boolean') {
        (node as Record<string, boolean>)[`has_org_phone_${i}`] = ho;
      }
    }

    // Derive node state client-side from persisted fields so ES vs Redis/S3
    // payload differences don't change UI.
    const anyMasked = Array.from({ length: 4 }).some((_, i) => {
      const name = (node as Record<string, unknown>)[`name_${i}`];
      return typeof name === 'string' && isMaskedName(name);
    });
    const anyEnriched = Array.from({ length: 4 }).some((_, i) => {
      const li = (node as Record<string, unknown>)[`linkedin_url_${i}`];
      const email = (node as Record<string, unknown>)[`email_${i}`];
      const phone = (node as Record<string, unknown>)[`phone_${i}`];
      const hasLi =
        typeof li === 'string' && isValidLinkedInProfileUrl(li.trim());
      const hasEmail = typeof email === 'string' && email.trim().length > 0;
      const hasPhone = typeof phone === 'string' && phone.trim().length > 0;
      return hasLi || hasEmail || hasPhone;
    });
    const anyDirectorySource = Array.from({ length: 4 }).some((_, i) => {
      const ds = (node as Record<string, unknown>)[`ds_${i}`];
      if (typeof ds !== 'string') return false;
      const s = ds.toLowerCase();
      return s.includes('apollo') || s.includes('m7kq');
    });

    if (anyMasked && !anyEnriched) {
      node.nodeState = 'preview';
    } else if (anyEnriched) {
      node.nodeState = 'active';
    } else if (anyDirectorySource) {
      node.nodeState = 'lock';
    } else if (hasRealNamedCandidate) {
      node.nodeState = 'active';
    } else {
      node.nodeState = 'preview';
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

    // if (typeof console !== 'undefined') {
    //   console.log('[orgchart/processOrgChartToNodeData]', {
    //     headline: node.headline,
    //     key: node.key,
    //     totalPeople: node.total_people,
    //     allCandidatesLength: orderedCandidates.length,
    //     rawLenCandidates: raw.len_candidates,
    //   });
    // }

    const PERSON_ROW_HEIGHT = 48;
    node.height_0 = orderedCandidates.length >= 1 ? PERSON_ROW_HEIGHT : 0;
    node.height_1 = orderedCandidates.length >= 2 ? PERSON_ROW_HEIGHT : 0;
    node.height_2 = orderedCandidates.length >= 3 ? PERSON_ROW_HEIGHT : 0;
    node.height_3 = orderedCandidates.length >= 4 ? PERSON_ROW_HEIGHT : 0;

    result.push(node);
  }

  return result;
}

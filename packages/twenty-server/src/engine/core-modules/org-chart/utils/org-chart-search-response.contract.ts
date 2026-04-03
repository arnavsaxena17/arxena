/**
 * Runtime shape checks for JSON returned by POST /org-chart/search
 * (OrgChartLinkedInBuildService.searchOrgchartFromLinkedIn).
 * Keeps server output aligned with what twenty-front useOrgChartActions expects.
 */

const ORGCHART_SEARCH_MODES = new Set([
  'current_node',
  'leadership',
  'entire_company',
  'function_grade',
  'all_people',
  'selected_nodes',
]);

const ORGCHART_SEARCH_TYPES = new Set([
  'classic',
  'sales_navigator',
  'recruiter',
]);

function expectPlainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('org-chart search response must be a non-null plain object');
  }
  return value as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(`org-chart search response: expected string "${key}"`);
  }
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new Error(`org-chart search response: expected number "${key}"`);
  }
  return v;
}

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new Error(`org-chart search response: expected boolean "${key}"`);
  }
  return v;
}

function requireStringArray(obj: Record<string, unknown>, key: string): string[] {
  const v = obj[key];
  if (!Array.isArray(v)) {
    throw new Error(`org-chart search response: expected array "${key}"`);
  }
  for (let i = 0; i < v.length; i += 1) {
    if (typeof v[i] !== 'string') {
      throw new Error(
        `org-chart search response: "${key}[${i}]" must be a string`,
      );
    }
  }
  return v as string[];
}

/** Each item is an opaque object (TransformedCandidateForTable-like). */
function assertOrgChartSearchItemRows(items: unknown[]): void {
  for (let i = 0; i < items.length; i += 1) {
    const row = items[i];
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(
        `org-chart search response: items[${i}] must be a plain object`,
      );
    }
  }
}

/**
 * orgChart payload from Python / cache: object with optional orgchart node list.
 */
function assertOrgChartPayloadWhenPresent(orgChart: unknown): void {
  if (orgChart === undefined || orgChart === null) {
    return;
  }
  if (typeof orgChart !== 'object' || Array.isArray(orgChart)) {
    throw new Error('org-chart search response: orgChart must be an object when present');
  }
  const o = orgChart as Record<string, unknown>;
  const raw = o.orgchart;
  if (raw === undefined) {
    return;
  }
  if (typeof raw === 'string') {
    return;
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      'org-chart search response: orgChart.orgchart must be string | array when present',
    );
  }
}

/**
 * Typical Unipile (non-queued) success body from searchOrgchartFromLinkedIn.
 */
export function assertOrgChartSearchUnipileSuccessResponse(
  value: unknown,
): asserts value is {
  success: true;
  mode: string;
  searchType: string;
  companyName: string;
  jobTitles: string[];
  itemCount: number;
  items: Record<string, unknown>[];
  orgChart?: Record<string, unknown>;
  orgChartError?: string;
  isCached: boolean;
  cacheSource: string;
} {
  const o = expectPlainObject(value);

  if (o.success !== true) {
    throw new Error('org-chart search response: expected success === true');
  }

  if (o.queued === true) {
    throw new Error(
      'org-chart search response: got queued Apify response; use assertOrgChartSearchApifyQueuedResponse',
    );
  }

  const mode = requireString(o, 'mode');
  if (!ORGCHART_SEARCH_MODES.has(mode)) {
    throw new Error(
      `org-chart search response: unexpected mode "${mode}"`,
    );
  }

  const searchType = requireString(o, 'searchType');
  if (!ORGCHART_SEARCH_TYPES.has(searchType)) {
    throw new Error(
      `org-chart search response: unexpected searchType "${searchType}"`,
    );
  }

  requireString(o, 'companyName');
  requireStringArray(o, 'jobTitles');
  requireNumber(o, 'itemCount');

  const items = o.items;
  if (!Array.isArray(items)) {
    throw new Error('org-chart search response: expected array "items"');
  }
  assertOrgChartSearchItemRows(items);

  if ('orgChartError' in o && o.orgChartError !== undefined) {
    if (typeof o.orgChartError !== 'string') {
      throw new Error(
        'org-chart search response: orgChartError must be a string when present',
      );
    }
  }

  assertOrgChartPayloadWhenPresent(o.orgChart);

  requireBoolean(o, 'isCached');
  requireString(o, 'cacheSource');
}

/**
 * Response when candidateSource is apify and the job is queued (no items yet).
 */
export function assertOrgChartSearchApifyQueuedResponse(
  value: unknown,
): asserts value is {
  success: true;
  queued: true;
  candidateSource: 'apify';
  requestId?: string;
  mode: string;
  searchType: string;
  companyName: string;
  companyId?: string;
  jobTitles: string[];
  linkedinCompanyUrl: string;
  itemCount: number;
  items: unknown[];
  orgChart: undefined;
  isCached: boolean;
  cacheSource: string;
} {
  const o = expectPlainObject(value);

  if (o.success !== true) {
    throw new Error('org-chart Apify queued response: expected success === true');
  }
  if (o.queued !== true) {
    throw new Error('org-chart Apify queued response: expected queued === true');
  }
  if (o.candidateSource !== 'apify') {
    throw new Error(
      'org-chart Apify queued response: expected candidateSource "apify"',
    );
  }

  requireString(o, 'mode');
  requireString(o, 'searchType');
  requireString(o, 'companyName');
  requireStringArray(o, 'jobTitles');
  requireString(o, 'linkedinCompanyUrl');
  requireNumber(o, 'itemCount');

  if (!Array.isArray(o.items)) {
    throw new Error('org-chart Apify queued response: expected items array');
  }
  if (o.items.length !== 0) {
    throw new Error(
      'org-chart Apify queued response: expected items to be empty when queued',
    );
  }
  if (o.orgChart !== undefined) {
    throw new Error(
      'org-chart Apify queued response: expected orgChart to be undefined when queued',
    );
  }

  requireBoolean(o, 'isCached');
  requireString(o, 'cacheSource');
}

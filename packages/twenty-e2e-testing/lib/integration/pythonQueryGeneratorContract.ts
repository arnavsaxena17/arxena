/**
 * JSON shapes returned by arxena-site Python LinkedIn query APIs must match what
 * twenty-server {@link PythonQueryGenerationService} parses before
 * `mapLinkedinSearchQueriesToGeneratedParameters` (resolved LinkedIn search params).
 *
 * Endpoints:
 * - POST /api/query-generator/linkedin  → single query fields
 * - POST /api/query-generator/linkedin/query-set  → search_query_set[]
 *
 * @see packages/twenty-server/src/engine/core-modules/candidate-search/services/python-query-generation.service.ts
 * @see packages/twenty-server/src/engine/core-modules/candidate-search/services/orgchart-linkedin-query-router.service.ts buildPythonQueryInputForOrgchartMode
 */

function expectPlainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Python query response: expected a JSON object');
  }
  return value as Record<string, unknown>;
}

function assertNullableString(value: unknown, field: string): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'string') {
    throw new Error(`Python query response: "${field}" must be string | null, got ${typeof value}`);
  }
}

function assertNullableStringArray(value: unknown, field: string): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Python query response: "${field}" must be an array or null`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== 'string') {
      throw new Error(`Python query response: "${field}[${i}]" must be string`);
    }
  }
}

/**
 * Response from POST /api/query-generator/linkedin (single-query path).
 */
export function assertPythonLinkedinSingleQueryResponse(json: unknown): void {
  const o = expectPlainObject(json);
  assertNullableString(o.job_title, 'job_title');
  assertNullableString(o.keywords, 'keywords');
  assertNullableStringArray(o.company, 'company');
}

/**
 * One row in search_query_set — matches SearchQuery in twenty-server.
 */
function assertSearchQueryRow(row: unknown, index: number): void {
  const o = expectPlainObject(row);
  assertNullableString(o.keywords, `search_query_set[${index}].keywords`);
  assertNullableString(o.job_title, `search_query_set[${index}].job_title`);
  assertNullableStringArray(o.company, `search_query_set[${index}].company`);
  assertNullableStringArray(o.location, `search_query_set[${index}].location`);
  assertNullableString(o.years_of_experience, `search_query_set[${index}].years_of_experience`);
}

/**
 * Response from POST /api/query-generator/linkedin/query-set (function_root path).
 */
export function assertPythonLinkedinQuerySetResponse(json: unknown): void {
  const o = expectPlainObject(json);
  const raw = o.search_query_set;
  if (raw === undefined) {
    throw new Error('Python query-set response: missing "search_query_set"');
  }
  if (!Array.isArray(raw)) {
    throw new Error('Python query-set response: "search_query_set" must be an array');
  }
  for (let i = 0; i < raw.length; i += 1) {
    assertSearchQueryRow(raw[i], i);
  }
}

export async function postPythonLinkedinQuery(
  arxenaBaseUrl: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const url = `${arxenaBaseUrl.replace(/\/+$/, '')}/api/query-generator/linkedin`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text.length > 0 ? (JSON.parse(text) as unknown) : {};
  } catch {
    throw new Error(`Python /api/query-generator/linkedin: non-JSON body (status ${res.status}): ${text.slice(0, 200)}`);
  }
  return { status: res.status, data };
}

export async function postPythonLinkedinQuerySet(
  arxenaBaseUrl: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const url = `${arxenaBaseUrl.replace(/\/+$/, '')}/api/query-generator/linkedin/query-set`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text.length > 0 ? (JSON.parse(text) as unknown) : {};
  } catch {
    throw new Error(`Python /api/query-generator/linkedin/query-set: non-JSON body (status ${res.status}): ${text.slice(0, 200)}`);
  }
  return { status: res.status, data };
}

/**
 * Mirrors PythonQueryGenerationService.generateSearchParameters: when `function_root`
 * is non-empty, call query-set first; if `search_query_set` is empty, fall back to the single
 * `/linkedin` endpoint with the same JSON body.
 */
export async function assertPythonSearchParametersFlowLikeNest(
  arxenaBaseUrl: string,
  input: Record<string, unknown>,
): Promise<void> {
  const roots = input.function_root;
  const hasFunctionRoot = Array.isArray(roots) && roots.length > 0;

  if (hasFunctionRoot) {
    const qs = await postPythonLinkedinQuerySet(arxenaBaseUrl, input);
    if (qs.status !== 200) {
      throw new Error(
        `Python query-set: expected 200, got ${qs.status}: ${JSON.stringify(qs.data).slice(0, 300)}`,
      );
    }
    console.log(
      '[python-query-generator] POST /linkedin/query-set response',
      JSON.stringify(qs.data),
    );
    assertPythonLinkedinQuerySetResponse(qs.data);
    const rows = (qs.data as { search_query_set?: unknown[] }).search_query_set;
    if (Array.isArray(rows) && rows.length > 0) {
      return;
    }
    console.log(
      '[python-query-generator] query-set empty; falling back to POST /linkedin',
    );
  }

  const single = await postPythonLinkedinQuery(arxenaBaseUrl, input);
  if (single.status !== 200) {
    throw new Error(
      `Python single-query: expected 200, got ${single.status}: ${JSON.stringify(single.data).slice(0, 300)}`,
    );
  }
  console.log(
    '[python-query-generator] POST /linkedin response',
    JSON.stringify(single.data),
  );
  assertPythonLinkedinSingleQueryResponse(single.data);
}

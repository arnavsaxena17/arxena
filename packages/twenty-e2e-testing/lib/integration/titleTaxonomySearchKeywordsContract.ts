/**
 * POST /api/title-taxonomy/search-keywords — same contract as
 * {@link TitleTaxonomyRemoteService.searchKeywordsFromQuery} (twenty-server).
 *
 * Used for business-division enrichment when org-chart queryGenerator=python
 * (orgchart-search.service calls arxena-site after the BD parser produces business_division_keywords).
 *
 * @see packages/twenty-server/src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service.ts
 * @see arxena-site/routes/title_taxonomy_api.py
 */

function expectPlainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('title-taxonomy search-keywords: expected a JSON object');
  }
  return value as Record<string, unknown>;
}

/**
 * Response shape from TitleTaxonomyService.generate_search_keywords_from_query (minimal assertions).
 */
export function assertTitleTaxonomySearchKeywordsResponse(json: unknown): void {
  const o = expectPlainObject(json);
  if (!('boolean_query' in o)) {
    throw new Error('title-taxonomy search-keywords: missing "boolean_query"');
  }
  const bq = o.boolean_query;
  if (bq !== null && bq !== undefined && typeof bq !== 'string') {
    throw new Error('title-taxonomy search-keywords: "boolean_query" must be string | null');
  }
  const kg = o.keyword_groups;
  if (kg !== undefined && kg !== null && !Array.isArray(kg)) {
    throw new Error('title-taxonomy search-keywords: "keyword_groups" must be an array when present');
  }
  const intent = o.interpreted_intent;
  if (intent !== undefined && intent !== null) {
    if (typeof intent !== 'object' || Array.isArray(intent)) {
      throw new Error('title-taxonomy search-keywords: "interpreted_intent" must be an object');
    }
  }
}

export async function postTitleTaxonomySearchKeywords(
  arxenaBaseUrl: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const url = `${arxenaBaseUrl.replace(/\/+$/, '')}/api/title-taxonomy/search-keywords`;
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
    throw new Error(
      `title-taxonomy search-keywords: non-JSON body (status ${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return { status: res.status, data };
}

/**
 * BD-shaped query aligned with org-chart matrix `business_division_map` + Nest enrich call
 * (`query` + `company_name`).
 */
export function buildTitleTaxonomySearchKeywordsBodyForBdProbe(args: {
  businessDivisionRawQuery: string;
  companyName: string;
}): Record<string, unknown> {
  return {
    query: args.businessDivisionRawQuery,
    company_name: args.companyName,
    max_primary_terms: 6,
    max_modifier_terms: 2,
  };
}

/**
 * Full flow: POST search-keywords, assert 200 + JSON contract, log response.
 */
export async function assertTitleTaxonomySearchKeywordsBdProbe(args: {
  arxenaBaseUrl: string;
  businessDivisionRawQuery: string;
  companyName: string;
}): Promise<void> {
  const body = buildTitleTaxonomySearchKeywordsBodyForBdProbe({
    businessDivisionRawQuery: args.businessDivisionRawQuery,
    companyName: args.companyName,
  });
  const { status, data } = await postTitleTaxonomySearchKeywords(args.arxenaBaseUrl, body);
  if (status !== 200) {
    throw new Error(
      `title-taxonomy search-keywords: expected 200, got ${status}: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  console.log(
    '[title-taxonomy] POST /api/title-taxonomy/search-keywords response',
    JSON.stringify(data),
  );
  assertTitleTaxonomySearchKeywordsResponse(data);
}

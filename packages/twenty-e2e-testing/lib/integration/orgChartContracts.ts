/**
 * Runtime checks aligned with twenty-server org-chart search contracts
 * (avoid importing twenty-server from Playwright to keep resolution simple).
 */

export function assertOrgChartSearchResponseShape(json: Record<string, unknown>): void {
  if (json.success !== true) {
    throw new Error(`Expected success true, got ${String(json.success)}`);
  }
  if (typeof json.mode !== 'string') throw new Error('Expected string mode');
  if (typeof json.searchType !== 'string') {
    throw new Error('Expected string searchType');
  }
  if (typeof json.companyName !== 'string') {
    throw new Error('Expected string companyName');
  }
  if (!Array.isArray(json.jobTitles)) throw new Error('Expected jobTitles array');
  if (typeof json.itemCount !== 'number') throw new Error('Expected number itemCount');
  if (!Array.isArray(json.items)) throw new Error('Expected items array');
  if (typeof json.isCached !== 'boolean') throw new Error('Expected boolean isCached');
  if (typeof json.cacheSource !== 'string') {
    throw new Error('Expected string cacheSource');
  }
}

export function assertOrgChartQueuedShape(json: Record<string, unknown>): void {
  if (json.success !== true) {
    throw new Error(`Expected success true, got ${String(json.success)}`);
  }
  if (json.queued !== true) throw new Error('Expected queued true');
  const src = json.candidateSource;
  if (src !== 'apify' && src !== 'linkedin_xray' && src !== 'unipile') {
    throw new Error(`Unexpected candidateSource: ${String(src)}`);
  }
  if (!Array.isArray(json.items) || json.items.length !== 0) {
    throw new Error('Expected empty items when queued');
  }
}

export function assertLitifyEnrichedShape(payload: Record<string, unknown>): void {
  if (payload.status !== 'ok') {
    throw new Error(`Expected status ok, got ${String(payload.status)}`);
  }
  const result = payload.result;
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Expected result object');
  }
  const r = result as Record<string, unknown>;
  const oc = r.orgchart;
  if (oc !== undefined && typeof oc !== 'string' && !Array.isArray(oc)) {
    throw new Error('orgchart must be string | array when present');
  }
}

/**
 * GET /org-chart/:companyId/enriched — orgchart must parse to a node array (twenty-front / orgchart renderers).
 */
export function assertLitifyEnrichedOrgChartRenderable(payload: Record<string, unknown>): void {
  assertLitifyEnrichedShape(payload);
  const result = payload.result as Record<string, unknown>;
  const oc = result.orgchart;
  if (oc === undefined || oc === '') {
    return;
  }
  let nodes: unknown;
  if (typeof oc === 'string') {
    try {
      nodes = JSON.parse(oc) as unknown;
    } catch {
      throw new Error('orgchart must be valid JSON string when string-typed');
    }
  } else {
    nodes = oc;
  }
  if (!Array.isArray(nodes)) {
    throw new Error('orgchart payload must be a JSON array of nodes when present');
  }
}

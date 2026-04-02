/**
 * Elasticsearch and legacy pipelines often store org-chart fields as JSON strings.
 * Normalizes those to real arrays/objects so HTTP responses are plain nested JSON.
 */
const ARRAY_JSON_FIELDS = new Set(['orgchart', 'countries', 'functions']);

const OBJECT_JSON_FIELDS = new Set([
  'country_analytics',
  'gender_analytics',
  'location_analytics',
  'analytics',
  'functions_analytics',
]);

function tryParseStructuredJsonString(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function normalizeOrgChartPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };

  for (const key of ARRAY_JSON_FIELDS) {
    const v = out[key];
    if (v === undefined) continue;
    if (Array.isArray(v)) continue;
    if (typeof v !== 'string') continue;
    const parsed = tryParseStructuredJsonString(v);
    if (Array.isArray(parsed)) {
      out[key] = parsed;
    }
  }

  for (const key of OBJECT_JSON_FIELDS) {
    const v = out[key];
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) continue;
    if (typeof v !== 'string') continue;
    const parsed = tryParseStructuredJsonString(v);
    if (
      parsed !== undefined &&
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      out[key] = parsed as Record<string, unknown>;
    }
  }

  return out;
}

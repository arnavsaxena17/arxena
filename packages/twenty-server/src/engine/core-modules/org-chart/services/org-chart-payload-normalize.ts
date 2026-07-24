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

const ORGCHART_LABEL_REPLACEMENTS: Record<string, string> = {
  'estate real': 'real estate',
  'marketing event': 'event marketing',
  'marketing events': 'event marketing',
  'learning machine': 'machine learning',
  'marketing account': 'account marketing',
  'marketing digital': 'digital marketing',
  'marketing field': 'field marketing',
  'marketing product': 'product marketing',
  'marketing retail': 'retail marketing',
  'media social': 'social media',
  'control credit': 'credit control',
  'markets capital': 'capital markets',
  'development customer': 'customer development',
  'services security': 'security services',
  'service field': 'field service',
  'services corporate': 'corporate services',
  'support technology': 'technology support',
  'support business': 'business support',
  'design engineering': 'engineering design',
  'engineer system': 'systems engineering',
  'design interior': 'interior design',
  'writer editor': 'writing and editing',
  'finance corporate': 'corporate finance',
  'finance project': 'project finance',
  'sales channel': 'channel sales',
  'sales enterprise': 'enterprise sales',
  'sales project': 'project sales',
  'sales retail': 'retail sales',
  'sales solutions': 'solution sales',
  'sales technical': 'technical sales',
  'sales banking': 'banking sales',
  'banking relationship': 'relationship banking',
  'audit technology': 'technology audit',
  'designer experience': 'experience design',
  'designer graphic': 'graphic designer',
  'business engineer': 'business engineering',
  'training development': 'learning and development',
  'organisation development': 'organization development',
  'marketing partnerships': 'partner marketing',
};

const ORGCHART_LABEL_FIELDS = new Set([
  'std_function',
  'std_function_root',
  'std_function_category',
]);

function normalizeOrgChartLabel(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  return ORGCHART_LABEL_REPLACEMENTS[normalized] ?? normalized;
}

function normalizeHeadline(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  let nextValue = value;

  for (const [from, to] of Object.entries(ORGCHART_LABEL_REPLACEMENTS)) {
    const pattern = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    nextValue = nextValue.replace(pattern, (match) => {
      if (match === match.toUpperCase()) {
        return to.toUpperCase();
      }
      if (match === match.toLowerCase()) {
        return to.toLowerCase();
      }
      return to;
    });
  }

  return nextValue;
}

function normalizeFunctionsAnalytics(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeOrgChartLabel(key);
    const targetKey =
      typeof normalizedKey === 'string' ? normalizedKey : key;

    const previousValue = out[targetKey];

    if (
      typeof previousValue === 'number' &&
      typeof nestedValue === 'number'
    ) {
      out[targetKey] = previousValue + nestedValue;
      continue;
    }

    out[targetKey] = nestedValue;
  }

  return out;
}

function normalizeFunctionsArray(values: unknown[]): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalizedValue = normalizeOrgChartLabel(value);

    if (typeof normalizedValue === 'string') {
      if (seen.has(normalizedValue)) {
        continue;
      }
      seen.add(normalizedValue);
    }

    out.push(normalizedValue);
  }

  return out;
}

function normalizeOrgChartPayloadDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeOrgChartPayloadDeep);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(input)) {
    if (key === 'functions' && Array.isArray(nestedValue)) {
      out[key] = normalizeFunctionsArray(nestedValue);
      continue;
    }

    if (key === 'functions_analytics' && nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      out[key] = normalizeFunctionsAnalytics(
        normalizeOrgChartPayloadDeep(nestedValue) as Record<string, unknown>,
      );
      continue;
    }

    if (ORGCHART_LABEL_FIELDS.has(key)) {
      out[key] = normalizeOrgChartLabel(nestedValue);
      continue;
    }

    if (key === 'headline') {
      out[key] = normalizeHeadline(nestedValue);
      continue;
    }

    out[key] = normalizeOrgChartPayloadDeep(nestedValue);
  }

  return out;
}

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

  return normalizeOrgChartPayloadDeep(out) as Record<string, unknown>;
}

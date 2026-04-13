import { z } from 'zod';

/**
 * LLMs often emit "/null" or the word "null" instead of JSON null. Treat as absent
 * so we do not pass bogus values to LinkedIn facet resolution or labels.
 */
export function normalizeLlmNullishString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const t = value.trim();
  if (t === '') {
    return null;
  }
  const lower = t.toLowerCase();
  if (
    t === '/null' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'n/a'
  ) {
    return null;
  }
  return t;
}

/** Canonical org-chart function roots (aligned with org chart std_function_root). */
export const FUNCTION_ROOT_VALUES = [
  'engineering',
  'marketing',
  'projects',
  'operations',
  'sales',
  'human resources',
  'education',
  'finance',
  'technology',
  'research',
  'support service',
  'healthcare',
  'product',
  'design',
  'secretarial',
  'supply chain',
  'trading',
  'legal',
  'real estate',
  'aviation',
  'events',
  'corporate',
  'government',
  'banking',
  'partnerships',
] as const;

export const FunctionRootSchema = z.enum(
  FUNCTION_ROOT_VALUES,
);

export type FunctionRoot = z.infer<
  typeof FunctionRootSchema
>;

const NullableOrgChartStringSchema = z.preprocess(
  normalizeLlmNullishString,
  z.union([z.string(), z.null()]),
);

const NullableFunctionRootSchema = z.preprocess((val: unknown) => {
  const n = normalizeLlmNullishString(val);
  if (n === null) {
    return null;
  }
  return n;
}, z.union([FunctionRootSchema, z.null()]));

const NullableStdGradeLevelsSchema = z.preprocess((val: unknown) => {
  if (val === null || val === undefined) {
    return null;
  }
  if (!Array.isArray(val)) {
    return null;
  }
  const cleaned = val
    .map((x) => normalizeLlmNullishString(x))
    .filter((x): x is string => x !== null);
  return cleaned.length > 0 ? cleaned : null;
}, z.array(z.string()).nullable());

/**
 * Structured LLM output for mapping a natural-language business division
 * request: business_division_keywords (BU/product/geo only) plus optional org-chart filters.
 */
export const OrgChartParsedSchema = z.object({
  business_division_keywords: z
    .string()
    .describe(
      'Boolean-style keyword string (AND / OR / parentheses) that filters by business unit / product line / geography only — not corporate function (HR, finance, IT). Max ~6 OR terms per parenthetical group. Short synonyms (e.g. PU OR polyurethane). Function targeting uses function_root / title taxonomy separately.',
    ),
  // No .describe() on shared NullableOrgChartStringSchema: OpenAI response_format rejects
  // $ref + sibling "description" (zodResponseFormat emits $ref for reused preprocess schemas).
  country: NullableOrgChartStringSchema,
  business_division: NullableOrgChartStringSchema,
  role_description: NullableOrgChartStringSchema,
  /**
   * Set only when the user explicitly mentions job level / seniority (director, VP, junior, intern, etc.).
   * Use normalized buckets: entry | mid | leadership. Null when levels were not stated — do not infer from division names alone.
   */
  std_grade_levels: NullableStdGradeLevelsSchema,
  function_root: NullableFunctionRootSchema,
  rationale: NullableOrgChartStringSchema,
});

export type OrgChartParsed = z.infer<
  typeof OrgChartParsedSchema
>;

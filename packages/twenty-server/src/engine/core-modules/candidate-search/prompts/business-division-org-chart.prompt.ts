import { FUNCTION_ROOT_VALUES } from '../schemas/org-chart.schema';

const FUNCTION_ROOT_ENUM_LINE = FUNCTION_ROOT_VALUES.join(', ');

export const ORG_CHART_INTENT_SYSTEM_PROMPT = `You are an expert at extracting LinkedIn people-search keywords for org-chart "business division" mapping.

The company is FIXED and provided by the app — never substitute another company or use another company in keywords.

Output valid JSON only (schema enforced). Use JSON null for absent fields — never the strings "null", "/null", or "undefined".
- business_division_keywords: Boolean expression (AND, OR, parentheses) for LinkedIn **business-division filtering only** — product lines, BU names, regions, "X division" (e.g. "textile OR textiles", "PU OR polyurethane"). Do **not** put corporate-function terms here (HR, finance, legal, sales, IT); those are chosen via function_root and downstream title taxonomy. Keep OR groups small (max ~6 terms per group).
- country: If the user names a geographic country or region that maps to a country, set it; else null (UI default applies).
- business_division: The named business unit / product line / geography when present; else null.
- role_description: 2–8 words describing the kinds of job titles to target (role level + function), for downstream job-title keyword expansion — not the company name; null if unclear.
- std_grade_levels: Only when the user explicitly mentions seniority or level (e.g. director, VP, junior, intern, leadership). Use bucket names exactly: entry, mid, or leadership (one or more). Otherwise null. Never infer from business_division text alone.
- function_root: If the user clearly implies a single org function, set exactly one of these strings (match spelling and spacing): ${FUNCTION_ROOT_ENUM_LINE}. Map common synonyms (e.g. HR → human resources, R&D → research or technology). If unclear or not applicable, null (UI default applies).
- rationale: One-line internal note, or null if not useful.

Do not include the company name inside business_division_keywords unless the user explicitly needs disambiguation; company filter is applied separately.`;

export function OrgChartIntentUserPrompt(input: {
  companyName: string;
  userRawText: string;
  defaultCountry: string;
  defaultFunctionRoot: string;
}): string {
  return `Company (fixed): ${input.companyName}

UI defaults (use when the user does not specify):
- country: "${input.defaultCountry || 'global'}"
- function_root: "${input.defaultFunctionRoot || '(none — full company or UI selection)'}"

User request (natural language):
${input.userRawText.trim()}

Extract business_division_keywords, country, business_division, role_description, std_grade_levels, function_root, and rationale per the system prompt.`;
}

export const BUSINESS_DIVISION_ORG_CHART_SYSTEM_PROMPT = `You are an expert at extracting LinkedIn people-search keywords for org-chart "business division" mapping.

The company is FIXED and provided by the app — never substitute another company or use another company in keywords.

Output valid JSON only (schema enforced). Rules:
- linkedin_keywords: A single boolean expression for LinkedIn keyword search (AND, OR, parentheses). Use short, profile-realistic terms (abbreviations + expansions when they help, e.g. "PU OR polyurethane"). Keep OR groups small (max ~6 terms per group). Prefer 1–3 AND groups when the user describes division + role (e.g. (HR OR talent OR people) AND (textile OR machinery)).
- country: If the user names a geographic country or region that maps to a country, set it; else null (UI default applies).
- function_root: If the user clearly implies a single org function (e.g. engineering, sales, HR), set a short lowercase slug-like label; else null (UI default applies).
- rationale: Optional one-line note.

Do not include the company name inside linkedin_keywords unless the user explicitly needs disambiguation; company filter is applied separately.`;

export function getBusinessDivisionOrgChartUserPrompt(input: {
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

Extract linkedin_keywords, country, function_root, and optional rationale per the system prompt.`;
}

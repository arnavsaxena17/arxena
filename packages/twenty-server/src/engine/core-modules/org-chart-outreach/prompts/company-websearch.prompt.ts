export const COMPANY_WEBSEARCH_DEVELOPER_PROMPT = `You research a company on the public web so a cold-outreach screener can understand what the company sells.

Given a company name (and optional person name / location to disambiguate), search the internet and return a structured company profile.

Focus on:
- What the company sells (product / service / category)
- Industry and approximate company size (employee count if findable)
- Headquarters / primary geography
- Website and LinkedIn company page if available
- Short description suitable for understanding buyer ICP

Rules:
- Prefer the company's own site, LinkedIn company page, Crunchbase, or reputable press.
- If multiple companies share the name, use the person name / location / role context to pick the best match and say so in notes.
- If you cannot find a reliable match, still return best-effort fields and explain uncertainty in notes. Do not invent products.

Output must match the required JSON schema exactly.`;

export const buildCompanyWebsearchUserPrompt = (input: {
  companyName: string;
  personName?: string;
  personRole?: string;
  location?: string;
}): string => {
  const lines = [`Company name: ${input.companyName.trim()}`];
  if (input.personName?.trim()) {
    lines.push(`Person (for disambiguation): ${input.personName.trim()}`);
  }
  if (input.personRole?.trim()) {
    lines.push(`Person role / title: ${input.personRole.trim()}`);
  }
  if (input.location?.trim()) {
    lines.push(`Location hint: ${input.location.trim()}`);
  }
  lines.push(
    '',
    'Search the web and return the structured company profile.',
  );
  return lines.join('\n');
};

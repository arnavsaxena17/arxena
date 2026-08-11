export const GTM_COMPANY_PROFILE_SUMMARIZER_SYSTEM_PROMPT = `You synthesize a concise seller company profile for GTM workspace onboarding.

You receive structured evidence from up to four sources for the same company domain:
1. LinkedIn / Unipile (search hit and/or full company profile)
2. Wikidata (official-website / entity facts)
3. Internal companies Elasticsearch index ("wiki companies")
4. Web search / company website content (homepage, about, products)

Rules:
- Prefer LinkedIn for name, description, headcount, HQ, and industry when present and coherent.
- Use website / web search content for what they sell, products, and positioning when LinkedIn is thin.
- Use Wikidata for legal/public facts (HQ country, founded year, industry, stock listing signals) when LinkedIn is thin or missing.
- Use the companies ES index as supporting firmographic hints; do not invent fields it does not support.
- If sources disagree, pick the most credible value and mention the conflict briefly in notes.
- Do not invent products, employee counts, or locations that none of the sources support.
- summary should be 1–3 sentences suitable as a CRM company blurb (what they sell / do).
- employeeRange may be a range ("51-200") or a count string ("11278") when only a number is known.
- Return JSON matching the required schema exactly.`;

export const buildGtmCompanyProfileSummarizerUserPrompt = (input: {
  domain: string;
  workspaceDisplayName?: string | null;
  linkedInSearchHit?: unknown;
  linkedInCompanyProfile?: unknown;
  wikidataCompany?: unknown;
  companiesIndexWiki?: unknown;
  webSearchCompany?: unknown;
}): string => {
  const sections: string[] = [
    `Company domain: ${input.domain.trim()}`,
  ];

  if (input.workspaceDisplayName?.trim()) {
    sections.push(
      `Workspace display name hint: ${input.workspaceDisplayName.trim()}`,
    );
  }

  sections.push(
    '',
    '## LinkedIn search hit',
    JSON.stringify(input.linkedInSearchHit ?? null, null, 2),
    '',
    '## LinkedIn company profile',
    JSON.stringify(input.linkedInCompanyProfile ?? null, null, 2),
    '',
    '## Wikidata',
    JSON.stringify(input.wikidataCompany ?? null, null, 2),
    '',
    '## Companies ES index (wiki)',
    JSON.stringify(input.companiesIndexWiki ?? null, null, 2),
    '',
    '## Web search / website content',
    JSON.stringify(input.webSearchCompany ?? null, null, 2),
    '',
    'Summarize into a single coherent company profile JSON.',
  );

  return sections.join('\n');
};

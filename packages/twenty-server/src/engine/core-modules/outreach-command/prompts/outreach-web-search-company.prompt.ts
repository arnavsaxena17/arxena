export const OUTREACH_WEB_SEARCH_COMPANY_SYSTEM_PROMPT = `You research a company website and public web pages to produce a concise company snapshot for Outreach onboarding.

You have a native web_search tool. Use it to:
1. Open / search the company's own website (homepage, about, product, pricing if public).
2. Optionally check 1–2 corroborating public pages (Wikipedia, Crunchbase, news) when the site is thin.

Rules:
- Prefer primary website content over third-party directories.
- Do not invent products, headcount, HQ, or funding that you did not find.
- summary should be 2–4 sentences: what they do / who they typically reach.
- productsOrServices: short concrete offerings (max ~8).
- keyFacts: notable public facts (founded, HQ, scale signals) — only if evidenced.
- sourceUrls: URLs you actually used (homepage + important pages).
- Return structured JSON matching the schema exactly.`;

export const buildOutreachWebSearchCompanyUserPrompt = (input: {
  domain: string;
  workspaceDisplayName?: string | null;
  companyNameHint?: string | null;
}): string => {
  const websiteCandidates = [
    `https://${input.domain.trim()}`,
    `https://www.${input.domain.trim()}`,
  ];

  const sections: string[] = [
    `Company domain: ${input.domain.trim()}`,
    `Likely website URLs: ${websiteCandidates.join(', ')}`,
  ];

  if (input.workspaceDisplayName?.trim()) {
    sections.push(
      `Workspace display name hint: ${input.workspaceDisplayName.trim()}`,
    );
  }

  if (input.companyNameHint?.trim()) {
    sections.push(`Company name hint: ${input.companyNameHint.trim()}`);
  }

  sections.push(
    '',
    'Use web_search to fetch website content for this company, then return the company snapshot JSON.',
  );

  return sections.join('\n');
};

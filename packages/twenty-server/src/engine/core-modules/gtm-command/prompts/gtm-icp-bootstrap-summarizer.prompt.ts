export const GTM_ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT = `You draft a default Ideal Customer Profile for a B2B seller during GTM workspace bootstrap.

You receive the seller company (what they sell), not the customer. Infer who they typically sell to.

Return only:
- buyerTitles: 3–8 realistic decision-maker / champion job titles.
- locations: target customer markets (countries or regions). This is the renamed geos field. Do not copy seller HQ unless they clearly sell only in that market.

Do not invent titles or markets the evidence does not support. If evidence is thin, keep lists short. Return JSON matching the schema exactly.`;

export const buildGtmIcpBootstrapSummarizerUserPrompt = (input: {
  domain: string;
  companyName: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
}): string =>
  [
    'Seller company (not the customer):',
    `Domain: ${input.domain.trim()}`,
    `Name: ${input.companyName.trim() || '(unknown)'}`,
    `Industry: ${input.industry.trim() || '(unknown)'}`,
    `Employee range: ${input.employeeRange.trim() || '(unknown)'}`,
    `HQ: ${input.hq.trim() || '(unknown)'}`,
    '',
    'Summary:',
    input.summary.trim() || '(none)',
    '',
    'Draft buyerTitles and locations for who this company sells to.',
  ].join('\n');

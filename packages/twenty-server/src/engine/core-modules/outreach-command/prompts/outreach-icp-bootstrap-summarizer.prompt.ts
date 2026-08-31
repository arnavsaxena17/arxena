export const ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT = `You draft a default Ideal Customer Profile for a workspace company during Outreach bootstrap.

You receive the workspace company (what they do), not the target accounts. Infer who they typically reach out to.

Return only:
- targetTitles: 3–8 realistic decision-maker / champion job titles (JSON key name is fixed).
- locations: target markets (countries or regions). This is the renamed geos field. Do not copy company HQ unless they clearly operate only in that market.

Do not invent titles or markets the evidence does not support. If evidence is thin, keep lists short. Return JSON matching the schema exactly.`;

export const buildIcpBootstrapSummarizerUserPrompt = (input: {
  domain: string;
  companyName: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
}): string =>
  [
    'Workspace company (not the target account):',
    `Domain: ${input.domain.trim()}`,
    `Name: ${input.companyName.trim() || '(unknown)'}`,
    `Industry: ${input.industry.trim() || '(unknown)'}`,
    `Employee range: ${input.employeeRange.trim() || '(unknown)'}`,
    `HQ: ${input.hq.trim() || '(unknown)'}`,
    '',
    'Summary:',
    input.summary.trim() || '(none)',
    '',
    'Draft targetTitles and locations for who this company typically reaches out to.',
  ].join('\n');

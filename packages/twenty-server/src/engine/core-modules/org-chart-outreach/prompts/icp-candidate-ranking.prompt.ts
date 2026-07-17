import type { IcpProfile } from 'src/engine/core-modules/org-chart-outreach/schemas/icp-extraction.schema';
import type { IcpCandidateCompany } from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';

const formatCandidateForPrompt = (candidate: IcpCandidateCompany): string => {
  const parts = [
    `name: ${candidate.name}`,
    candidate.industry ? `industry: ${candidate.industry}` : null,
    candidate.headcount ? `headcount: ${candidate.headcount}` : null,
    typeof candidate.employeeCount === 'number'
      ? `employee_count: ${candidate.employeeCount}`
      : null,
    candidate.location ? `location: ${candidate.location}` : null,
    candidate.domain ? `domain: ${candidate.domain}` : null,
    candidate.keywords?.length
      ? `keywords: ${candidate.keywords.join(', ')}`
      : null,
    candidate.technologies?.length
      ? `technologies: ${candidate.technologies.join(', ')}`
      : null,
  ].filter(Boolean);

  return `- ${parts.join(' | ')}`;
};

export const buildIcpCandidateRankingPrompt = (input: {
  icp: IcpProfile;
  chartFunction?: string | null;
  candidates: IcpCandidateCompany[];
  candidateSource: 'apollo' | 'sales_navigator';
}): string => {
  return [
    'You are the second step in a cold-outreach pipeline. Step 1 already',
    'screened this lead and produced an ICP for who THEIR company should',
    'be selling to. Your job here is to pick which real target company,',
    'from a supplied candidate list, to build the actual org-chart lure',
    'for.',
    '',
    'Given the ICP and a list of real candidate companies pulled from',
    `${input.candidateSource === 'apollo' ? 'Apollo' : 'LinkedIn Sales Navigator'},`,
    'rank the top 3 by fit against that ICP, and for each one state which',
    'function/title layer to chart — start from chart_function in the ICP',
    "input, adjusted only if that candidate's actual org structure calls",
    'for a different label (e.g. "Platform Engineering" vs',
    '"Infrastructure," if the data shows which term that specific company',
    'uses). Only choose from the provided list — do not suggest companies',
    'outside it.',
    '',
    'If no candidate is a plausible fit for the ICP, output',
    '{"proceed": false, "reason": "..."} and stop.',
    '',
    `ICP: ${JSON.stringify(input.icp, null, 2)}`,
    `chart_function from step 1: ${input.chartFunction ?? 'null'}`,
    '',
    'Candidates:',
    ...input.candidates.map(formatCandidateForPrompt),
    '',
    'Output as JSON only, no other text:',
    '{',
    '  "proceed": true,',
    '  "ranked_candidates": [',
    '    {',
    '      "company_name": "...",',
    '      "fit_reasoning": "... — reference the specific matching',
    '        signal(s) from the ICP, not a generic restatement",',
    '      "chart_function": "..."',
    '    }',
    '  ]',
    '}',
  ].join('\n');
};

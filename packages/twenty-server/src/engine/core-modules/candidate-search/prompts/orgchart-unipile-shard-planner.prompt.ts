import { ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD } from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';

export const ORGCHART_UNIPILE_SHARD_PLANNER_SYSTEM_PROMPT = `You plan how to split a LinkedIn Sales Navigator people search for ONE company so every shard stays under ~${ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD} matches.

LinkedIn/Unipile can only return about ${ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD} profiles per search query. Broad company searches (thousands of employees) must be split into disjoint facets, then a remaining catch-all.

You fill a structured plan. Code resolves your labels to LinkedIn IDs and runs the searches. You do not invent filters Unipile cannot apply.

PRIMARY DIMENSION (pick one for this company using world knowledge):
- city — dense single-country workforce concentrated in metros (e.g. India used-car platforms → Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Pune, …)
- country — multi-country global footprint (US, IN, GB, DE, …)
- region — broad geo bands when city/country lists would be too long (EMEA, APAC labels LinkedIn understands, or major US states / EU countries as labels)
- function — org split by department when geography is even (Engineering, Sales, Marketing, Operations, …)
- seniority — bands when titles vary but levels are clear (Director, VP, Manager, …) — prefer only if geo/function would leave remaining still huge
- titleFamily — clusters of job-title phrases when function IDs are weak

RULES:
- Create 2 to 12 shards. Prefer fewer high-yield shards (each shard's first page costs LinkedIn search quota).
- Exactly ONE shard must have remaining=true with empty includeLabels. All other shards remaining=false with non-empty includeLabels.
- Include shards must be MECE on primaryDimension: no overlapping labels.
- Every includeLabels entry is a plain human label (city name, country name, function name, or title phrase). No LinkedIn numeric IDs. No AND/OR/quotes.
- Aim for each include shard and the remaining shard to be under ~${ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD} LinkedIn matches. If unsure, prefer more geographic slices for local companies.
- priority 1 is the densest / most important slice; remaining usually last (highest priority number).
- key: short snake_case (mumbai, united_states, remaining). Never shard1.
- Do not put the company name in includeLabels. Company is already fixed by the caller.
- When parentExcludedLabels is provided, you are only planning a secondary split of the remaining bucket; do not re-include those labels.`;

export const buildOrgchartUnipileShardPlannerPrompt = (input: {
  companyName: string;
  linkedinCompanyUrl?: string;
  country?: string;
  industry?: string;
  totalCount: number;
  maxPerShard: number;
  parentDimension?: string;
  parentExcludedLabels?: string[];
}): string => {
  const lines = [
    `Company: ${input.companyName}`,
    input.linkedinCompanyUrl
      ? `LinkedIn company URL: ${input.linkedinCompanyUrl}`
      : null,
    input.country ? `HQ / country hint: ${input.country}` : null,
    input.industry ? `Industry hint: ${input.industry}` : null,
    `LinkedIn reported match count (approx): ${input.totalCount}`,
    `Max results per shard: ${input.maxPerShard}`,
    input.parentDimension
      ? `Secondary plan: split remaining after primaryDimension=${input.parentDimension}`
      : null,
    input.parentExcludedLabels?.length
      ? `Already excluded (do not re-include): ${input.parentExcludedLabels.join(', ')}`
      : null,
    'Return a plan with MECE include shards plus one remaining:true shard.',
  ];

  return lines.filter((line): line is string => line !== null).join('\n');
};

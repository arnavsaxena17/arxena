import {
  MasterLists,
  ParsedRequirement,
  QueryType,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

const AGENT3_BASE = `You are an expert LinkedIn search query builder. You build the ideal (unlimited) primary query from master lists and determine if it must be broken into multiple queries.

## LinkedIn Term Limits (for later splitting)

- \`keywords\`: max 6 terms per query
- \`job_title\`: max 6 terms per query
- If both used: combined max 10 terms per query
- Terms = words or quoted phrases; AND/OR/parentheses don't count

## Your Task

Build the **primary query** using ALL terms from the master lists for the filters this query type uses. For \`company\`, use **master_lists.companies.all_companies** (the expanded list), NOT parsed_requirement.target_companies (which may only list examples). **Set to \`null\` any filter this query type does not use** (so LinkedIn returns all candidates on that dimension):
- **Type A:** \`keywords\` = null (use job_title + company only).
- **Type B:** \`job_title\` = null (use keywords + company only).
- **Type C:** Use job_title + keywords; \`company\` = null only if master_lists.companies indicates no company filter (use_company_filter: false).
- **Type D:** \`job_title\` = null, \`company\` = null (use keywords only).

Do not limit terms yet. Then count terms and decide:
- \`needs_splitting\`: true if keywords >6 OR job_title >6 OR combined >10 (count only non-null filters).
- \`recommended_strategy\`: which strategy the next step should use (A–D)

**Strategy codes**:
- **A**: No splitting (within limits)
- **B**: Split by keywords (keywords >6)
- **C**: Split by job titles (job_title >6)
- **D**: Split by seniority (wide experience range) or by companies (>6 companies)

## Output Format

Return a single object \`primary_query\` containing: \`query\` (keywords, job_title, company, location, years_of_experience — all nullable), \`term_counts\` (keywords, job_title, combined), \`needs_splitting\`, \`splitting_reason\` (if needs_splitting), \`recommended_strategy\` (A|B|C|D).`;

function getAgent3TypeGuidance(queryType: QueryType): string {
  const guidance: Record<QueryType, string> = {
    A: `**Query type A:** Set \`keywords\` = null. Use job_title (full hierarchy) + company (use **master_lists.companies.all_companies** — the expanded list — not parsed_requirement.target_companies) only. Recommend strategy D if >6 companies, else B or C by term counts.`,
    B: `**Query type B:** Set \`job_title\` = null. Use keywords (function job titles) + company only. Recommend C or D.`,
    C: `**Query type C:** Use job_title (seniority terms) + keywords (industry AND company-type). Set \`company\` = null only if master_lists.companies.use_company_filter is false. Recommend C or D.`,
    D: `**Query type D:** Set \`job_title\` = null, \`company\` = null. Use keywords only. Recommend B or C based on term counts.`,
  };
  return '\n## Guidance for This Query Type\n\n' + guidance[queryType] + '\n';
}

export function getAgent3SystemPrompt(queryType: QueryType): string {
  return AGENT3_BASE + getAgent3TypeGuidance(queryType);
}

export const buildAgent3UserPrompt = (
  parsed: ParsedRequirement,
  masterLists: MasterLists,
  queryIpLocation?: string,
): string => {
  const locationInstruction = queryIpLocation
    ? `- **Location**: If the parsed requirement has no location (location: [] or empty), set \`location\` to the Query IP Location (e.g. ["${queryIpLocation}"] or ["India"]) so the search is geographically scoped. If location is specified in the requirement, use that.
    `
    : '';

  const prompt = `Build the primary query and recommend a splitting strategy.
    ${queryIpLocation ? `Query IP Location: ${queryIpLocation}. Use as default geography when location is not in the requirement.\n\n` : ''}
    ## Parsed Requirement
    ${JSON.stringify(parsed, null, 2)}

    ## Master Lists
    ${JSON.stringify(masterLists, null, 2)}

    Instructions:
    - Build one primary query using ALL terms from master lists. Use \`master_lists.keywords.all_terms\` and \`master_lists.job_titles.all_terms\` (the exhaustive lists) as OR expressions. For company filter, use master_lists.companies.all_companies in full — do not limit to parsed_requirement.target_companies. Do not factor common terms; Stage 4 will produce factored expressions and break into multiple queries if needed.
    - Count discrete terms in keywords and job_title; set term_counts and combined.
    - Set needs_splitting and recommended_strategy (A–D) for the next step.
    ${locationInstruction}Return the object with primary_query only.`;
  return prompt;
};

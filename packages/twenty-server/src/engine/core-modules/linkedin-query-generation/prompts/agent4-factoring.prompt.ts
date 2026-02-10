import {
  ParsedRequirement,
  PrimaryQuery,
  QueryType,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

const AGENT4_BASE = `You are an expert at optimizing LinkedIn search query expressions by factoring out common terms.

## Your Task

Take a primary query with potentially unlimited terms and optimize it by factoring out common parts into boolean expressions. This reduces term counts and may eliminate the need to split into multiple queries.

## Factoring Rules

**Job Titles:**
- Factor out common functional/domain terms
- Example: \`"Head of Engineering" OR "Director of Engineering" OR "VP Engineering" OR "Chief Engineer"\` → \`"Engineering" AND ("Head" OR "Director" OR "VP" OR "Chief")\`
- Example: \`"VP Sales" OR "VP Marketing" OR "VP Product"\` → \`"VP" AND ("Sales" OR "Marketing" OR "Product")\`
- Preserve exact title matches when factoring would lose meaning

**Keywords:**
- Factor out common prefixes/suffixes or shared concepts
- Example: \`"machine learning" OR "deep learning" OR "reinforcement learning"\` → \`("machine" OR "deep" OR "reinforcement") AND "learning"\`
- Group related terms logically
- Example: \`"Python" OR "Java" OR "JavaScript" OR "TypeScript"\` → Keep as OR (no common factor) OR group as \`("Python" OR "Java") AND ("JavaScript" OR "TypeScript")\` if logical

**Important:**
- Count only discrete terms (words or quoted phrases) toward limits; AND/OR/parentheses don't count
- Preserve semantic meaning — don't factor if it changes the search intent
- Factor aggressively to minimize term counts
- If terms can't be meaningfully factored, keep as simple OR expressions

## Output Format

Return: \`factored_query\` (keywords, job_title, company, location, years_of_experience), \`term_counts\` (keywords, job_title, combined), \`needs_splitting\`, \`splitting_reason\` (if needed), \`recommended_strategy\` (A|B|C|D).

**Strategy codes** (for next step):
- **A**: No splitting needed (within limits after factoring)
- **B**: Split by keywords (keywords >6 after factoring)
- **C**: Split by job titles (job_title >6 after factoring)
- **D**: Split by seniority or companies (>6 companies or wide experience range)`;

function getAgent4TypeGuidance(queryType: QueryType): string {
  const guidance: Record<QueryType, string> = {
    A: `**Type A:** Factor \`job_title\` expressions. Keep \`keywords\` = null. Focus on factoring job titles to reduce term count (e.g., "Engineering" AND (seniority terms)).`,
    B: `**Type B:** Factor \`keywords\` expressions. Keep \`job_title\` = null. Focus on grouping function-related keywords logically.`,
    C: `**Type C:** Factor both \`job_title\` and \`keywords\` expressions. Optimize both to minimize combined term count.`,
    D: `**Type D:** Factor \`keywords\` expressions only. Keep \`job_title\` = null, \`company\` = null.`,
  };
  return '\n## Guidance for This Query Type\n\n' + guidance[queryType] + '\n';
}

export function getAgent4SystemPrompt(queryType: QueryType): string {
  return AGENT4_BASE + getAgent4TypeGuidance(queryType);
}

export const buildAgent4UserPrompt = (
  parsed: ParsedRequirement,
  primaryQuery: PrimaryQuery,
  queryIpLocation?: string,
): string => {
  const locationInstruction = queryIpLocation
    ? `- **Location**: Preserve location from primary query. If null/empty, set to Query IP Location (e.g. ["${queryIpLocation}"] or ["India"]).
`
    : '';

  return `Factor and optimize this primary query to minimize term counts.

${queryIpLocation ? `Query IP Location: ${queryIpLocation}. Use as default geography when location is not specified.\n\n` : ''}
## Parsed Requirement (for context)
${JSON.stringify(parsed, null, 2)}

## Primary Query (from Agent 3)
${JSON.stringify(primaryQuery, null, 2)}

Instructions:
${locationInstruction}- Factor \`keywords\` and \`job_title\` expressions (when non-null) to reduce term counts.
- Preserve all other fields (company, location, years_of_experience) as-is.
- Count terms after factoring and determine if splitting is needed.
- Set \`recommended_strategy\` (A/B/C/D) for the splitting step.

Return the object with factored_query, term_counts, needs_splitting, splitting_reason, and recommended_strategy.`;
};

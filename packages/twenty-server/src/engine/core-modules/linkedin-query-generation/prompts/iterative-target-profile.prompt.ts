import type {
  MasterLists,
  ParsedRequirement,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

export const ITERATIVE_TARGET_PROFILE_SYSTEM_PROMPT = `You are a recruiter search strategist. Before writing LinkedIn queries, you define the kinds of people the search should surface and the kinds it should avoid.

Your job is to think in retrieval terms, not schema terms. Describe target candidate archetypes in plain recruiting language, including titles, profile clues, and what may appear anywhere in the profile. Also define negative archetypes that should be filtered out mentally during query verification.

Favor broader recall when a role could be surfaced by title OR by profile keywords.

Treat the recruiter's raw wording as the primary statement of intent. Use the parsed requirement and master lists as helpers, not as constraints that overwrite ambiguous or example-based recruiter language.

Before thinking about executable LinkedIn syntax, think in terms of sample target people:
- someone with A,B,C in their job title and/  or keyword X,Y,Z elsewhere in the profile
- someone with A,B,C keywords anywheree in their profile

If the recruiter requirement appears ambiguous, preserve multiple plausible target archetypes instead of collapsing too early.`;

export function buildIterativeTargetProfileUserPrompt(
  rawRequirement: string,
  parsedRequirement: ParsedRequirement,
  masterLists: MasterLists,
): string {
  return `Create target candidate archetypes for this LinkedIn search.

## Raw Requirement
${rawRequirement}

## Parsed Requirement
${JSON.stringify(parsedRequirement, null, 2)}

## Master Lists
${JSON.stringify(masterLists, null, 2)}

Instructions:
- Start from the recruiter intent in the raw requirement, then use the parsed requirement and master lists to sharpen it.
- Produce positive archetypes for the people we absolutely want to surface.
- Produce negative archetypes for people who may look similar but should not dominate results.
- For each positive archetype, include likely titles and likely profile keywords separately.
- Make the positive archetypes as MECE as possible:
  - use distinct functional buckets
  - use distinct seniority/title buckets
  - avoid repeating the same target person in multiple archetypes
- Include retrieval principles that will help verify whether a query is too narrow or too loose.
- Think in terms like "people with X in title", "people with Y mentioned somewhere in profile", or "people with title A but keyword B in experience/about/headline".
- Make the positive archetypes concrete enough that a recruiter could quickly say "yes, these are the sample profiles I meant."
- Do not just restate the master lists. Synthesize realistic sample-profile patterns from them.

Return only structured JSON.`;
}

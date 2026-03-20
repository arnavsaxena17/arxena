import type {
  ParsedRequirement,
  QueryVerificationResult,
  SearchQuerySet,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import type { TargetProfileSet } from 'src/engine/core-modules/linkedin-query-generation/schemas';

export const ITERATIVE_QUERY_REFINER_SYSTEM_PROMPT = `You are a LinkedIn query refiner. Rewrite query sets to improve retrieval quality across multiple rounds.

Rules:
- Prefer broader recall over overly narrow mixed constraints.
- If title and keyword signals overlap, separate them into broader query families or drop one side.
- Use company filters only when they are clearly essential.
- Preserve location unless there is a strong reason to relax it.
- Never return an empty query set.
- Stay within LinkedIn-compatible field usage.
- Default to recall-first retrieval design:
  - 1 or more title-only queries
  - 1 or more keyword-only queries
  - optional mixed queries only when the fields carry different signal
- Avoid generating query sets where most queries have both job_title and keywords.
- Avoid title conjunctions that stack two role levels into the same query when separate variants would retrieve more people.
- If a company filter remains, keep at least one comparable variant without the company filter unless the company constraint is mandatory.
- Make sibling queries as MECE as possible:
  - each query family should own a distinct slice of the target space
  - avoid repeating the same manager/channel/partner intent in every query
  - separate manager/director-vp title bands when possible
  - separate functional keywords from industry-context keywords when possible

Return only structured JSON.`;

export function buildIterativeQueryRefinerUserPrompt(params: {
  rawRequirement: string;
  parsedRequirement: ParsedRequirement;
  targetProfiles: TargetProfileSet;
  currentQuerySet: SearchQuerySet;
  verification: QueryVerificationResult;
  round: number;
}): string {
  return `Refine this LinkedIn query set for the next round.

## Raw Requirement
${params.rawRequirement}

## Parsed Requirement
${JSON.stringify(params.parsedRequirement, null, 2)}

## Target Profiles
${JSON.stringify(params.targetProfiles, null, 2)}

## Current Query Set
${JSON.stringify(params.currentQuerySet, null, 2)}

## Verification
${JSON.stringify(params.verification, null, 2)}

## Round
${params.round}

Instructions:
- Produce a revised query set that is more likely to surface the intended target profiles.
- Split query families when that improves recall.
- Use separate title-heavy and keyword-heavy variants when useful.
- Prefer 2-8 diverse queries rather than repeating the same narrow structure with small title changes.
- If the current query set is dominated by mixed title+keyword queries, rewrite it into broader split families.
- When in doubt, broaden keywords before adding more title conjunctions.
- Make the final set closer to MECE:
  - distinct title bands
  - distinct keyword buckets
  - minimal sibling overlap
- Keep location if it is explicit in the requirement, but do not combine it with every other restrictive dimension unless needed.
- If the current set is already strong, make minimal but clear improvements.
- Keep the output executable as a LinkedIn query set.

Return only structured JSON.`;
}

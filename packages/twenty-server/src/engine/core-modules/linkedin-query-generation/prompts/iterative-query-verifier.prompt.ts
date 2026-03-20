import type {
  ParsedRequirement,
  QueryVerificationResult,
  SearchQuerySet,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import type { TargetProfileSet } from 'src/engine/core-modules/linkedin-query-generation/schemas';

export const ITERATIVE_QUERY_VERIFIER_SYSTEM_PROMPT = `You are a LinkedIn query verifier. Your task is to judge whether a query set is likely to surface the intended people.

You must reason from target archetypes first, not from syntax alone.

Evaluate:
- coverage of positive archetypes
- leakage toward negative archetypes
- whether title and keyword signals are redundant
- whether company filters are overly restrictive
- whether a broad recall strategy is being respected
- whether sibling queries are MECE enough across the query set

Recall-first rules:
- Prefer multiple broader query families over a single tightly constrained mixed query.
- If job_title and keywords express nearly the same role signal, treat that as a retrieval failure, not a minor issue.
- Strong query sets usually contain a mix of title-only and keyword-only variants.
- Only allow mixed title+keyword queries when each field contributes clearly distinct signal.
- If every query combines title + keywords + location + company, penalize heavily for over-constraint.
- Company filters should usually appear in only a minority of queries unless the requirement makes specific companies mandatory.
- Penalize query sets where multiple sibling queries would obviously return many of the same profiles.
- Reward query sets where each query family has a distinct role:
  - manager-level titles
  - leadership-level titles
  - keyword-driven partner/channel profiles
  - keyword-driven industry/context profiles

Use the deterministic findings as hard guardrails, but make an independent judgment about retrieval quality.

Return only structured JSON.`;

export function buildIterativeQueryVerifierUserPrompt(params: {
  rawRequirement: string;
  parsedRequirement: ParsedRequirement;
  targetProfiles: TargetProfileSet;
  querySet: SearchQuerySet;
  deterministicVerification: QueryVerificationResult;
  livePreviewSummary?: Record<string, unknown> | null;
}): string {
  const liveSection = params.livePreviewSummary
    ? `## Live Preview Summary
${JSON.stringify(params.livePreviewSummary, null, 2)}
`
    : '';

  return `Verify this LinkedIn query set against the target candidate archetypes.

## Raw Requirement
${params.rawRequirement}

## Parsed Requirement
${JSON.stringify(params.parsedRequirement, null, 2)}

## Target Profiles
${JSON.stringify(params.targetProfiles, null, 2)}

## Query Set
${JSON.stringify(params.querySet, null, 2)}

## Deterministic Verification
${JSON.stringify(params.deterministicVerification, null, 2)}

${liveSection}
Instructions:
- Score how well this query set will retrieve the positive archetypes while avoiding the negative ones.
- Penalize overlapping title+keyword combinations when they express the same signal.
- Penalize company filters when they seem example-based rather than essential.
- Prefer query families like:
  - title-only leadership variants
  - keyword-only profile-text variants
  - relaxed-company variants when company is only an example
- Penalize sibling queries that are not MECE:
  - repeated channel/partner/sales terms spread across every keyword query
  - repeated manager titles spread across multiple title queries with little separation
- Reward clear partitioning by seniority, function, or retrieval surface.
- Do not reward a query merely because it is precise; reward it when it is likely to surface many useful candidates.
- If the set is dominated by conjunctive title-heavy queries, score breadth and expected candidate volume aggressively lower.
- Recommend actions only from the provided action enum.
- The final score should reflect retrieval usefulness, not just schema validity.

Return only structured JSON.`;
}

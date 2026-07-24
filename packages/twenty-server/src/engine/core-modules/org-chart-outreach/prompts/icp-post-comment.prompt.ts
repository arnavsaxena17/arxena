import type { IcpProfile } from 'src/engine/core-modules/org-chart-outreach/schemas/icp-extraction.schema';
import type {
    IcpRankedCandidateInput,
    LinkedinPostSummary,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';

const formatRankedCandidatesForPrompt = (
  candidates: IcpRankedCandidateInput[],
): string => {
  if (candidates.length === 0) {
    return 'None supplied — keep any org-chart reference generic (e.g. "mapping the infra-leadership layer at accounts like yours"); never invent a company name.';
  }
  return candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.company_name} — chart: ${candidate.chart_function}`,
    )
    .join('\n');
};

/**
 * Generates public comments for the target's LinkedIn post. Comments are a
 * softer channel than DMs: they must add genuine value to the post first,
 * with at most a light bridge toward the org-chart offer relevant to the
 * author's ICP. Overtly salesy comments get ignored (or worse, flagged).
 */
export const buildIcpPostCommentPrompt = (input: {
  icp: IcpProfile;
  sells?: string;
  chartFunction?: string | null;
  authorName?: string;
  post: LinkedinPostSummary;
  rankedCandidates: IcpRankedCandidateInput[];
  variants: number;
  customInstructions?: string;
}): string => {
  return [
    'You write public LinkedIn comments on a prospect\'s post as part of a',
    'warm-up sequence. We map full-depth org charts; the author sells into',
    'a specific function at companies matching their ICP (below). A good',
    'comment earns a profile visit and primes a later DM — it is NOT a',
    'pitch.',
    '',
    `Write ${input.variants} distinct comment variant(s) on the post below.`,
    '',
    'Quality bar for every variant:',
    '- React to the actual substance of the post: agree with a specific',
    '  point, add a data point or experience, or ask one sharp question.',
    '- Sound like a practitioner, not a marketer. No emojis unless the',
    '  post itself is casual. No hashtags.',
    '- At most ONE variant may include a light redirect toward org-chart',
    '  value relevant to their ICP (e.g. knowing who owns the function',
    '  they sell into at their target accounts). The other variants must',
    '  be pure value-adds with no mention of our offer.',
    '- Never name-drop a target company unless it appears in the ranked',
    '  list below.',
    '- 1-3 sentences each, under 500 characters. No URLs. No placeholder',
    '  tokens.',
    '- Do not fabricate facts not present in the context.',
    '',
    input.customInstructions
      ? `Additional instructions: ${input.customInstructions.trim()}`
      : '',
    '',
    `Post author: ${input.authorName ?? 'Unknown'}`,
    input.sells ? `What their company sells: ${input.sells}` : '',
    `Their company's ICP (who they sell to): ${JSON.stringify(input.icp)}`,
    `Chart function relevant to them: ${input.chartFunction ?? 'derive from buyer_titles'}`,
    '',
    `The post (${input.post.parsedDatetime ?? 'date unknown'}${input.post.isRepost ? ', repost' : ''}):`,
    input.post.text,
    '',
    'Ranked target companies matching their ICP:',
    formatRankedCandidatesForPrompt(input.rankedCandidates),
    '',
    'Output as JSON only, no other text:',
    '{"comments":["...", "..."]}',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
};

import type { IcpProfile } from 'src/engine/core-modules/org-chart-outreach/schemas/icp-extraction.schema';
import type {
    IcpRankedCandidateInput,
    LinkedinPostSummary,
    OutreachMessageType,
    OutreachTone,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';

const messageTypeInstructions = (
  messageType: OutreachMessageType,
): string => {
  switch (messageType) {
    case 'connection_request':
      return [
        'Write a LinkedIn connection request note.',
        'Hard limit: message MUST be 300 characters or fewer (including spaces).',
        'Return JSON: {"message":"..."}',
      ].join('\n');
    case 'inmail':
      return [
        'Write a LinkedIn InMail.',
        'Subject limit: 200 characters. Body: concise, roughly 500-800 characters.',
        'Return JSON: {"subject":"...","message":"..."}',
      ].join('\n');
    case 'message':
      return [
        'Write a LinkedIn direct message.',
        'Keep the message under 1000 characters.',
        'Return JSON: {"message":"..."}',
      ].join('\n');
  }
};

const formatRankedCandidatesForPrompt = (
  candidates: IcpRankedCandidateInput[],
): string => {
  if (candidates.length === 0) {
    return 'No ranked target companies supplied — reference the org-chart value generically for their ICP (never invent a company name).';
  }
  return candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.company_name} — chart: ${candidate.chart_function}${candidate.fit_reasoning ? ` — why it fits their ICP: ${candidate.fit_reasoning}` : ''}`,
    )
    .join('\n');
};

const formatRecentPostForPrompt = (
  post: LinkedinPostSummary | null,
): string => {
  if (!post) {
    return 'No post in the last month — do NOT pretend they posted recently; hook on what their company does instead.';
  }
  return `[${post.parsedDatetime ?? 'recent'}${post.isRepost ? ', repost' : ''}] ${post.text}`;
};

/**
 * Prompt 3 of the ICP pipeline: composes the actual outreach message. The
 * lure mechanic: we map org charts, and we lead with org charts of companies
 * that match the TARGET's own ICP — i.e. their prospects, not ours.
 */
export const buildIcpOutreachMessagePrompt = (input: {
  icp: IcpProfile;
  sells?: string;
  chartFunction?: string | null;
  targetName?: string;
  targetHeadline?: string;
  recentPost: LinkedinPostSummary | null;
  rankedCandidates: IcpRankedCandidateInput[];
  messageType: OutreachMessageType;
  tone: OutreachTone;
  customInstructions?: string;
}): string => {
  const toneGuide =
    input.tone === 'warm'
      ? 'Use a warm, personable tone.'
      : input.tone === 'direct'
        ? 'Use a direct, concise tone.'
        : 'Use a professional, respectful tone.';

  return [
    'You are the final step of a cold-outreach pipeline. Earlier steps',
    'extracted the ICP of the recipient\'s company (who THEY sell to) and',
    'ranked real companies matching that ICP. The lure: we map full-depth',
    'org charts, so we can hand the recipient the org chart of the exact',
    'function they sell into, inside companies that look like their buyers.',
    '',
    messageTypeInstructions(input.messageType),
    '',
    toneGuide,
    '',
    'Ground the message in exactly two things:',
    '1. What they do — from their company\'s ICP below (what they sell,',
    '   who they sell to). Show you understood their motion in one clause,',
    '   not a recitation.',
    '2. Their recent post (last month) if one is provided — open with a',
    '   specific, non-generic hook from it. If none is provided, hook on',
    '   their company\'s selling motion instead.',
    '',
    'Rules:',
    '- Mention at most 1-2 of the ranked target companies by name and the',
    '  function layer we can chart for them (e.g. "the platform-engineering',
    '  layer at X").',
    '- The value proposition: they get the mapped decision-makers/teams',
    '  they are already trying to reach. Do not oversell; one concrete',
    '  offer beats three adjectives.',
    '- No placeholder tokens like [Company] or [Name] in the final text.',
    '- Do not fabricate facts not present in the context.',
    '- No URLs.',
    '',
    input.customInstructions
      ? `Additional instructions: ${input.customInstructions.trim()}`
      : '',
    '',
    `Recipient: ${input.targetName ?? 'Unknown'}${input.targetHeadline ? ` — ${input.targetHeadline}` : ''}`,
    input.sells ? `What their company sells: ${input.sells}` : '',
    `Their company's ICP (who they sell to): ${JSON.stringify(input.icp)}`,
    `Chart function to lead with: ${input.chartFunction ?? 'derive from buyer_titles'}`,
    '',
    'Their recent post (last month):',
    formatRecentPostForPrompt(input.recentPost),
    '',
    'Ranked target companies matching their ICP (our org-chart inventory):',
    formatRankedCandidatesForPrompt(input.rankedCandidates),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
};

import type { OutreachProfileContext } from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';
import {
    formatCommentsForPrompt,
    formatPostsForPrompt,
    formatProfileSummaryForPrompt,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';

export const buildOutreachCompanySelectionPrompt = (
  context: OutreachProfileContext,
): string => {
  return [
    'You sell organizational charts (org charts) for companies on LinkedIn.',
    'Given the sender profile and target prospect profile below, pick exactly 2 or 3 companies',
    'whose org charts would be most relevant for the target to explore right now.',
    '',
    'Prioritize:',
    '- Target current employer',
    '- Recent employers from the last 2-3 years when relevant to their function',
    '- Companies they actively engage with in posts or comments (partnerships, growth, hiring)',
    '- Avoid unrelated companies from casual reposts unless clearly relevant to their work',
    '',
    'Return strictly valid JSON with this shape:',
    '{"companies":[{"name":"Company Name","rationale":"short reason"}],"excludedReason":"optional note"}',
    '',
    formatProfileSummaryForPrompt('Sender profile', context.sender),
    '',
    formatProfileSummaryForPrompt('Target profile', context.target),
    '',
    'Target posts:',
    formatPostsForPrompt(context.posts),
    '',
    'Target comments:',
    formatCommentsForPrompt(context.comments),
  ].join('\n');
};

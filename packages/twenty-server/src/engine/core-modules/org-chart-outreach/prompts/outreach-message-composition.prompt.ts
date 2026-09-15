import type {
  OutreachMessageType,
  OutreachProfileContext,
  OutreachTone,
  SuggestedOutreachCompany,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';
import {
  buildOrgChartMessageTypeInstructions,
  buildOrgChartToneGuide,
  ORG_CHART_CONNECTION_REQUEST_MAX_LENGTH,
  ORG_CHART_DIRECT_MESSAGE_MAX_LENGTH,
  ORG_CHART_INMAIL_SUBJECT_MAX_LENGTH,
} from 'src/engine/core-modules/org-chart-outreach/prompts/org-chart-message-type-instructions';
import {
  formatCommentsForPrompt,
  formatPostsForPrompt,
  formatProfileSummaryForPrompt,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';

const formatCompaniesForPrompt = (
  companies: SuggestedOutreachCompany[],
  includeOrgChartLinks: boolean,
): string => {
  if (companies.length === 0) {
    return 'No resolved companies — mention org charts generically without inventing URLs.';
  }

  return companies
    .map((company, index) => {
      const parts = [
        `${index + 1}. ${company.name}`,
        `   Rationale: ${company.rationale}`,
      ];
      if (company.linkedinSlug) {
        parts.push(`   LinkedIn slug: ${company.linkedinSlug}`);
      }
      if (includeOrgChartLinks && company.orgChartUrl) {
        parts.push(`   Org chart URL: ${company.orgChartUrl}`);
      }
      return parts.join('\n');
    })
    .join('\n');
};

export const buildOutreachMessageCompositionPrompt = (input: {
  context: OutreachProfileContext;
  companies: SuggestedOutreachCompany[];
  messageType: OutreachMessageType;
  includeOrgChartLinks: boolean;
  tone: OutreachTone;
  customInstructions?: string;
}): string => {
  return [
    'You are drafting a personalized LinkedIn outreach opener to introduce org chart offerings.',
    buildOrgChartMessageTypeInstructions(input.messageType),
    '',
    buildOrgChartToneGuide(input.tone),
    '',
    'Rules:',
    '- Open with a personalized hook from the target recent activity, role, or post.',
    '- Briefly establish sender credibility without being pushy or salesy.',
    '- Naturally mention 1-2 of the suggested companies as org chart value.',
    input.includeOrgChartLinks
      ? '- Include org chart URLs when referencing those companies.'
      : '- Do NOT include URLs — mention company names only.',
    '- No placeholder tokens like [Company] or [Name] in the final text.',
    '- Do not fabricate facts not present in the context.',
    '',
    input.customInstructions
      ? `Additional instructions: ${input.customInstructions.trim()}`
      : '',
    '',
    formatProfileSummaryForPrompt('Sender profile', input.context.sender),
    '',
    formatProfileSummaryForPrompt('Target profile', input.context.target),
    '',
    'Target posts:',
    formatPostsForPrompt(input.context.posts),
    '',
    'Target comments:',
    formatCommentsForPrompt(input.context.comments),
    '',
    'Suggested companies (with resolved LinkedIn data):',
    formatCompaniesForPrompt(input.companies, input.includeOrgChartLinks),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
};

export const CONNECTION_REQUEST_MAX_LENGTH =
  ORG_CHART_CONNECTION_REQUEST_MAX_LENGTH;
export const INMAIL_SUBJECT_MAX_LENGTH = ORG_CHART_INMAIL_SUBJECT_MAX_LENGTH;
export const DIRECT_MESSAGE_MAX_LENGTH = ORG_CHART_DIRECT_MESSAGE_MAX_LENGTH;

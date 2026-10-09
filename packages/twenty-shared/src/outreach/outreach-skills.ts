import { OUTREACH_SKILL_MARKDOWN } from './outreach-skill-markdown.generated';

export const OUTREACH_SKILL_LABELS = {
  search: 'Search (companies, people, LinkedIn / Harvest)',
  'resolve-company-name': 'Resolve Company Name',
  'org-structure-insights': 'Org Structure Insights',
  outreach: 'Outreach',
  'local-business-search': 'Local Business Search',
  'ai-filter-enrich': 'AI Filter & Enrich',
  setup: 'Setup',
} as const;

export type OutreachSkillName = keyof typeof OUTREACH_SKILL_LABELS;

// The `search` skill is one playbook assembled from these parts, in order.
export const OUTREACH_SEARCH_SKILL_PARTS = [
  'search-preamble',
  'search-companies',
  'search-people',
  'search-linkedin-harvest',
] as const;

export type OutreachSkill = {
  name: OutreachSkillName;
  label: string;
  content: string;
};

const readMarkdown = (fileName: string): string => {
  const content = OUTREACH_SKILL_MARKDOWN[fileName];

  if (content === undefined) {
    throw new Error(`Missing outreach skill markdown: ${fileName}`);
  }

  return content;
};

const isOutreachSkillName = (name: string): name is OutreachSkillName =>
  Object.prototype.hasOwnProperty.call(OUTREACH_SKILL_LABELS, name);

export const listOutreachSkillNames = (): OutreachSkillName[] =>
  Object.keys(OUTREACH_SKILL_LABELS) as OutreachSkillName[];

export const getOutreachSkillContent = (
  name: OutreachSkillName,
): string =>
  name === 'search'
    ? OUTREACH_SEARCH_SKILL_PARTS.map(readMarkdown).join('\n')
    : readMarkdown(name);

export const getOutreachSkillByName = (
  name: string,
): OutreachSkill | undefined =>
  isOutreachSkillName(name)
    ? {
        name,
        label: OUTREACH_SKILL_LABELS[name],
        content: getOutreachSkillContent(name),
      }
    : undefined;

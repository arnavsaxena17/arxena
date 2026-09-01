import { readFileSync } from 'fs';
import { join } from 'path';

import { type AllStandardSkillName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-skill-name.type';

const skillContentCache = new Map<AllStandardSkillName, string>();

const SEARCH_SKILL_CONTENT_PARTS = [
  'search-preamble.md',
  'search-companies.md',
  'search-people.md',
  'search-linkedin-harvest.md',
] as const;

const loadSearchSkillContent = (): string => {
  return SEARCH_SKILL_CONTENT_PARTS.map((partFileName) =>
    readFileSync(join(__dirname, 'contents', partFileName), 'utf-8'),
  ).join('\n');
};

export const loadStandardSkillContent = (
  skillName: AllStandardSkillName,
): string => {
  const cachedContent = skillContentCache.get(skillName);

  if (cachedContent !== undefined) {
    return cachedContent;
  }

  const content =
    skillName === 'search'
      ? loadSearchSkillContent()
      : readFileSync(
          join(__dirname, 'contents', `${skillName}.md`),
          'utf-8',
        );

  skillContentCache.set(skillName, content);

  return content;
};

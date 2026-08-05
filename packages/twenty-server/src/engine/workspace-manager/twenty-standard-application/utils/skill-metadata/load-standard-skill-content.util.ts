import { readFileSync } from 'fs';
import { join } from 'path';

import { type AllStandardSkillName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-skill-name.type';

const skillContentCache = new Map<AllStandardSkillName, string>();

export const loadStandardSkillContent = (
  skillName: AllStandardSkillName,
): string => {
  const cachedContent = skillContentCache.get(skillName);

  if (cachedContent !== undefined) {
    return cachedContent;
  }

  const content = readFileSync(
    join(__dirname, 'contents', `${skillName}.md`),
    'utf-8',
  );

  skillContentCache.set(skillName, content);

  return content;
};

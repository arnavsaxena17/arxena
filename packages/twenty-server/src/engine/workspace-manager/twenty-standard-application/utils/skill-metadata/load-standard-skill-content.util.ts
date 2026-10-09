import { readFileSync } from 'fs';
import { join } from 'path';

import {
  type OutreachSkillName,
  getOutreachSkillContent,
  listOutreachSkillNames,
} from 'twenty-shared/outreach';

import { type AllStandardSkillName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-skill-name.type';

const skillContentCache = new Map<AllStandardSkillName, string>();

const OUTREACH_SKILL_NAMES = new Set<string>(listOutreachSkillNames());

const isOutreachSkillName = (
  skillName: AllStandardSkillName,
): skillName is AllStandardSkillName & OutreachSkillName =>
  OUTREACH_SKILL_NAMES.has(skillName);

export const loadStandardSkillContent = (
  skillName: AllStandardSkillName,
): string => {
  const cachedContent = skillContentCache.get(skillName);

  if (cachedContent !== undefined) {
    return cachedContent;
  }

  // Outreach playbooks live in twenty-shared so the MCP server serves the same text.
  const content = isOutreachSkillName(skillName)
    ? getOutreachSkillContent(skillName)
    : readFileSync(join(__dirname, 'contents', `${skillName}.md`), 'utf-8');

  skillContentCache.set(skillName, content);

  return content;
};

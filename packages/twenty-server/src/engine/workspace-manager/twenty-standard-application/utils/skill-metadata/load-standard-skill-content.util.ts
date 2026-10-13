import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

// Every skill, core or playbook, is read from its markdown file in ./contents
export const loadStandardSkillContent = (skillName: string): string =>
  getSkillContent(skillName);

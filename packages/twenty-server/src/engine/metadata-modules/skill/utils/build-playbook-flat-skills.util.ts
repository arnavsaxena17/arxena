import {
  getSkillDescription,
  getSkillIcon,
  getSkillLabel,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import {
  getPlaybookUniversalIdentifier,
  STANDARD_PLAYBOOK_SKILL_NAMES,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-playbook-skills.constant';
import { TWENTY_STANDARD_APPLICATION } from 'src/engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications';
import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

const NOT_STORED_ID = '00000000-0000-0000-0000-000000000000';

// A playbook is usable the moment its markdown file is deployed. Until the
// workspace has a stored row for it, the AI-facing lookups see this one, built
// from the file. A stored row of the same name always wins.
export const withUnstoredPlaybooks = (
  workspaceId: string,
  storedSkills: FlatSkill[],
): FlatSkill[] => {
  const storedNames = new Set(storedSkills.map((skill) => skill.name));
  const now = new Date().toISOString();

  const unstored = STANDARD_PLAYBOOK_SKILL_NAMES.filter(
    (name) => !storedNames.has(name),
  ).map(
    (name) =>
      ({
        id: NOT_STORED_ID,
        universalIdentifier: getPlaybookUniversalIdentifier(name),
        name,
        label: getSkillLabel(name),
        icon: getSkillIcon(name),
        description: getSkillDescription(name),
        content: loadStandardSkillContent(name),
        isCustom: false,
        isActive: true,
        workspaceId,
        applicationId: NOT_STORED_ID,
        applicationUniversalIdentifier:
          TWENTY_STANDARD_APPLICATION.universalIdentifier,
        createdAt: now,
        updatedAt: now,
      }) as FlatSkill,
  );

  return [...storedSkills, ...unstored];
};

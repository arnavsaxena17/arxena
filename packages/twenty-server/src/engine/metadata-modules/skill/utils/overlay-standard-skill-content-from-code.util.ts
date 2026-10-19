import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { STANDARD_PLAYBOOK_SKILL_NAMES } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-playbook-skills.constant';
import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { canonicalSkillName } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';
import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

// A row stored under an old name is still the standard skill until the upgrade
// command renames it
const isStandardSkillName = (storedName: string): boolean => {
  const name = canonicalSkillName(storedName);

  return (
    Object.prototype.hasOwnProperty.call(STANDARD_SKILL, name) ||
    STANDARD_PLAYBOOK_SKILL_NAMES.includes(name)
  );
};

// Standard skill text ships with the build, so the stored copy is only a
// fallback. Serving the code version means a skill edit reaches every
// workspace on deploy, without a per-workspace sync command.
export const overlayStandardSkillContentFromCode = (
  flatSkill: FlatSkill,
): FlatSkill => {
  if (flatSkill.isCustom || !isStandardSkillName(flatSkill.name)) {
    return flatSkill;
  }

  return {
    ...flatSkill,
    content: loadStandardSkillContent(flatSkill.name),
  };
};

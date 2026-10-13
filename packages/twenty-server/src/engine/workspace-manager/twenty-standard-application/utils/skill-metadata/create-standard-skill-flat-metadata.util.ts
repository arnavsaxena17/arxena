import { v4 } from 'uuid';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { TWENTY_STANDARD_APPLICATION } from 'src/engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications';
import { getPlaybookUniversalIdentifier } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-playbook-skills.constant';
import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { type StandardBuilderArgs } from 'src/engine/workspace-manager/twenty-standard-application/types/metadata-standard-buillder-args.type';

export type CreateStandardSkillContext = {
  // A name in STANDARD_SKILL, or a playbook (a markdown file with front matter)
  skillName: string;
  name: string;
  label: string;
  icon: string | null;
  description: string | null;
  content: string;
  isCustom: boolean;
  isActive?: boolean;
};

export type CreateStandardSkillArgs = StandardBuilderArgs<'skill'> & {
  context: CreateStandardSkillContext;
};

export const createStandardSkillFlatMetadata = ({
  context: {
    skillName,
    name,
    label,
    icon,
    description,
    content,
    isCustom,
    isActive = true,
  },
  workspaceId,
  twentyStandardApplicationId,
  now,
}: CreateStandardSkillArgs): FlatSkill => {
  const universalIdentifier =
    STANDARD_SKILL[skillName as keyof typeof STANDARD_SKILL]
      ?.universalIdentifier ?? getPlaybookUniversalIdentifier(skillName);

  return {
    id: v4(),
    universalIdentifier,
    name,
    label,
    icon,
    description,
    content,
    isCustom,
    isActive,
    workspaceId,
    applicationId: twentyStandardApplicationId,
    applicationUniversalIdentifier:
      TWENTY_STANDARD_APPLICATION.universalIdentifier,
    createdAt: now,
    updatedAt: now,
  };
};

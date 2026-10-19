import { isDefined } from 'twenty-shared/utils';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';

type SkillMapsByUniversalIdentifier = {
  byUniversalIdentifier: Record<string, FlatSkill | undefined>;
};

// Standard skills missing from a workspace are created; present ones are
// refreshed only when their name, text, label or description differ from the code.
export const planStandardSkillSync = ({
  existingFlatSkillMaps,
  standardFlatSkillMaps,
}: {
  existingFlatSkillMaps: SkillMapsByUniversalIdentifier;
  standardFlatSkillMaps: SkillMapsByUniversalIdentifier;
}): { skillsToCreate: FlatSkill[]; skillsToUpdate: FlatSkill[] } => {
  const skillsToCreate: FlatSkill[] = [];
  const skillsToUpdate: FlatSkill[] = [];

  for (const standardSkill of Object.values(
    standardFlatSkillMaps.byUniversalIdentifier,
  ).filter(isDefined)) {
    const existingSkill =
      existingFlatSkillMaps.byUniversalIdentifier[
        standardSkill.universalIdentifier
      ];

    if (!isDefined(existingSkill)) {
      skillsToCreate.push(standardSkill);
      continue;
    }

    if (
      existingSkill.name !== standardSkill.name ||
      existingSkill.content !== standardSkill.content ||
      existingSkill.description !== standardSkill.description ||
      existingSkill.label !== standardSkill.label
    ) {
      skillsToUpdate.push({
        ...existingSkill,
        name: standardSkill.name,
        content: standardSkill.content,
        description: standardSkill.description,
        label: standardSkill.label,
      });
    }
  }

  return { skillsToCreate, skillsToUpdate };
};

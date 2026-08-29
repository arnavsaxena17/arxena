import { z } from 'zod';

import { type SkillService } from 'src/engine/metadata-modules/skill/skill.service';

export const LIST_SKILLS_TOOL_NAME = 'list_skills';

export const listSkillsInputSchema = z.object({});

export type ListSkillsResult = {
  skillNames: string[];
  message: string;
};

export const createListSkillsTool = (
  skillService: SkillService,
  workspaceId: string,
) => ({
  description:
    'List skill names only when the initialize instructions look stale. Do not call this on the happy path — skill names are already listed in server instructions. Then load a matching skill with load_skills.',
  inputSchema: listSkillsInputSchema,
  execute: async (): Promise<ListSkillsResult> => {
    const allSkills = await skillService.findAllFlatSkills(workspaceId);

    const skillNames = allSkills.map((skill) => skill.name);

    return {
      skillNames,
      message:
        skillNames.length > 0
          ? `Found ${skillNames.length} skill(s): ${skillNames.join(', ')}.`
          : 'No skills are currently available in this workspace.',
    };
  },
});

import { z } from 'zod';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';

export const LOAD_SKILL_TOOL_NAME = 'load_skills';

export const loadSkillInputSchema = z.object({
  skillNames: z
    .array(z.string())
    .describe(
      'Names of the skills to load (e.g., ["workflow-building", "data-manipulation"])',
    ),
});

export type LoadSkillInput = z.infer<typeof loadSkillInputSchema>;

export type LoadSkillResult = {
  skills: Array<{
    name: string;
    label: string;
    content: string;
  }>;
  message: string;
};

export type LoadSkillFunction = (names: string[]) => Promise<FlatSkill[]>;
export type ListAvailableSkillNamesFunction = () => Promise<string[]>;

export const createLoadSkillTool = (
  loadSkills: LoadSkillFunction,
  listAvailableSkillNames: ListAvailableSkillNamesFunction,
) => ({
  description:
    'Arxena CRM toolkit: company and people search (Apollo, LinkedIn, Harvest, Bright Data), CRM records, outreach campaigns and sequencers, workflows and automations, dashboards, and org charts. Load specialized skills for complex tasks. Returns detailed step-by-step instructions for building workflows, dashboards, manipulating data, or managing metadata. Call this before attempting complex operations. START HERE for any request to search, find, list, or source companies, jobs, or people (e.g. "find companies which do XYZ in India", "CTOs at fintechs"). Call this first to understand capabilities.',
  inputSchema: loadSkillInputSchema,
  execute: async (parameters: LoadSkillInput): Promise<LoadSkillResult> => {
    const { skillNames } = parameters;

    const skills = await loadSkills(skillNames);

    if (skills.length === 0) {
      const availableNames = await listAvailableSkillNames();

      const availableMessage =
        availableNames.length > 0
          ? `Available skills: ${availableNames.join(', ')}.`
          : 'No skills are currently available in this workspace.';

      return {
        skills: [],
        message: `No skills found with names: ${skillNames.join(', ')}. ${availableMessage}`,
      };
    }

    return {
      skills: skills.map((skill) => ({
        name: skill.name,
        label: skill.label,
        content: skill.content,
      })),
      message: `Loaded ${skills.map((skill) => skill.label).join(', ')}.`,
    };
  },
});

import { selectSkillSections } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';
import { resolveSkillSections } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';
import { z } from 'zod';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';

export const LOAD_SKILL_TOOL_NAME = 'load_skills';

export const loadSkillInputSchema = z.object({
  skillNames: z
    .array(z.string())
    .describe(
      'Names of the skills to load (e.g., ["workflow-building", "data-manipulation"])',
    ),
  sections: z
    .array(z.string())
    .optional()
    .describe(
      'Long skills such as search are split into sections (companies, people, people-by-company). Pass only the ones the task needs; the intro is always included. Omit to load the whole skill.',
    ),
});

export type LoadSkillInput = z.infer<typeof loadSkillInputSchema>;

export type LoadSkillResult = {
  skills: Array<{
    name: string;
    label: string;
    content: string;
    availableSections?: string[];
  }>;
  message: string;
};

export type LoadSkillFunction = (names: string[]) => Promise<FlatSkill[]>;
export type ListAvailableSkillNamesFunction = () => Promise<string[]>;
export type SkillNoteFunction = (
  skillName: string,
) => Promise<string | undefined>;

// LinkedIn account status is only needed to pick a searchType or to start
// Unipile outreach. Resolve it when these skills load, not on every prompt.
const LINKEDIN_CHANNEL_SKILL_NAMES = new Set(['search', 'outreach']);

export const createLinkedinChannelSkillNote = (
  resolveNote: () => Promise<string>,
): SkillNoteFunction => {
  let note: Promise<string> | undefined;

  return (skillName) => {
    if (!LINKEDIN_CHANNEL_SKILL_NAMES.has(skillName)) {
      return Promise.resolve(undefined);
    }

    note ??= resolveNote();

    return note;
  };
};

export const createLoadSkillTool = (
  loadSkills: LoadSkillFunction,
  listAvailableSkillNames: ListAvailableSkillNamesFunction,
  skillNote?: SkillNoteFunction,
) => ({
  description:
    'Arxena CRM toolkit: company and people search (Apollo, LinkedIn, Harvest, Bright Data), CRM records, outreach campaigns and sequencers, workflows and automations, dashboards, and org charts. Load specialized skills for complex tasks. Returns detailed step-by-step instructions for building workflows, dashboards, manipulating data, or managing metadata. Call this before attempting complex operations. START HERE for any request to search, find, list, or source companies, jobs, or people (e.g. "find companies which do XYZ in India", "CTOs at fintechs"). Call this first to understand capabilities. For the long search skill pass `sections` to load only the part the task needs.',
  inputSchema: loadSkillInputSchema,
  execute: async (parameters: LoadSkillInput): Promise<LoadSkillResult> => {
    const { skillNames, sections } = parameters;

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

    const selected = skills.map((skill) => ({
      skill,
      ...selectSkillSections(
        skill.content,
        resolveSkillSections(skill.name, sections),
      ),
    }));
    const unknownSections = [
      ...new Set(
        selected
          .filter((entry) => entry.availableSections.length > 0)
          .flatMap((entry) => entry.unknownSections),
      ),
    ];

    const skillsWithNotes = await Promise.all(
      selected.map(async ({ skill, content, availableSections }) => {
        const note = skillNote ? await skillNote(skill.name) : undefined;

        return {
          name: skill.name,
          label: skill.label,
          content: note ? `${content}\n\n${note}` : content,
          ...(availableSections.length > 0 && { availableSections }),
        };
      }),
    );

    return {
      skills: skillsWithNotes,
      message:
        `Loaded ${skills.map((skill) => skill.label).join(', ')}.` +
        (unknownSections.length > 0
          ? ` Unknown sections: ${unknownSections.join(', ')}.`
          : ''),
    };
  },
});

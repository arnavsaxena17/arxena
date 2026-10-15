import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import {
  createLinkedinChannelSkillNote,
  createLoadSkillTool,
} from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';

const searchSkill = {
  name: 'search',
  label: 'Search',
  content: getSkillContent('search'),
} as FlatSkill;

const buildTool = () =>
  createLoadSkillTool(
    async (names) => (names.includes('search') ? [searchSkill] : []),
    async () => ['search'],
  );

describe('load_skills', () => {
  it('should load the whole skill when no sections are requested', async () => {
    const result = await buildTool().execute({ skillNames: ['search'] });

    expect(result.skills[0].content).toBe(searchSkill.content);
    expect(result.skills[0].availableSections).toEqual([
      'companies',
      'people',
      'people-by-company',
    ]);
  });

  it('should load only the requested sections', async () => {
    const result = await buildTool().execute({
      skillNames: ['search'],
      sections: ['people'],
    });

    expect(result.skills[0].content).toContain('## People');
    expect(result.skills[0].content).not.toContain('## People by company');
  });

  it('should name sections that do not exist', async () => {
    const result = await buildTool().execute({
      skillNames: ['search'],
      sections: ['people', 'nope'],
    });

    expect(result.message).toContain('Unknown sections: nope');
  });

  it('appends the LinkedIn status only for search and outreach', async () => {
    const resolveNote = jest.fn().mockResolvedValue('LinkedIn: connected');
    const tool = createLoadSkillTool(
      async (names) =>
        names.map(
          (name) =>
            ({
              name,
              label: name,
              content: `${name} body`,
            }) as FlatSkill,
        ),
      async () => ['search', 'outreach', 'crm'],
      createLinkedinChannelSkillNote(resolveNote),
    );

    const result = await tool.execute({
      skillNames: ['search', 'crm'],
    });

    expect(resolveNote).toHaveBeenCalledTimes(1);
    expect(result.skills[0].content).toContain('LinkedIn: connected');
    expect(result.skills[1].content).toBe('crm body');
  });
});

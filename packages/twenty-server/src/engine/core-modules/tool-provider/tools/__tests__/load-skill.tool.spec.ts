import {
  getSkillContent,
  getSkillFrontMatter,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import {
  createLinkedinChannelSkillNote,
  createLoadSkillTool,
} from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';

const searchSkill = {
  name: 'sourcing',
  label: 'Sourcing',
  content: getSkillContent('sourcing'),
} as FlatSkill;

const buildTool = () =>
  createLoadSkillTool(
    async (names) =>
      names.includes('sourcing') || names.includes('search')
        ? [searchSkill]
        : [],
    async () => ['sourcing'],
  );

describe('load_skills', () => {
  it('should load the default sections when no sections are requested', async () => {
    const result = await buildTool().execute({ skillNames: ['search'] });

    expect(result.skills[0].content).toContain('## People');
    expect(result.skills[0].content).toContain('## Companies');
    expect(result.skills[0].content).not.toContain('## People by company');
    expect(result.skills[0].availableSections).toEqual(
      getSkillFrontMatter('sourcing')?.parts,
    );
  });

  it('should add the sections a requested section requires', async () => {
    const result = await buildTool().execute({
      skillNames: ['sourcing'],
      sections: ['people'],
    });

    expect(result.skills[0].content).toContain(
      '## Source: Bright Data, people',
    );
    expect(result.skills[0].content).not.toContain('## Source: LinkedIn');
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

  it('appends the LinkedIn status only for sourcing and outreach', async () => {
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
      async () => ['sourcing', 'outreach', 'crm'],
      createLinkedinChannelSkillNote(resolveNote),
    );

    const result = await tool.execute({
      skillNames: ['sourcing', 'crm'],
    });

    expect(resolveNote).toHaveBeenCalledTimes(1);
    expect(result.skills[0].content).toContain('LinkedIn: connected');
    expect(result.skills[1].content).toBe('crm body');
  });
});

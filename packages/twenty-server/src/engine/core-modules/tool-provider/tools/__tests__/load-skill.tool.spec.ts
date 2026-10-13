import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { createLoadSkillTool } from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';

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
      'list-building',
      'people',
      'linkedin-harvest',
    ]);
  });

  it('should load only the requested sections', async () => {
    const result = await buildTool().execute({
      skillNames: ['search'],
      sections: ['people'],
    });

    expect(result.skills[0].content).toContain('## People');
    expect(result.skills[0].content).not.toContain('## LinkedIn / Harvest');
  });

  it('should name sections that do not exist', async () => {
    const result = await buildTool().execute({
      skillNames: ['search'],
      sections: ['people', 'nope'],
    });

    expect(result.message).toContain('Unknown sections: nope');
  });
});

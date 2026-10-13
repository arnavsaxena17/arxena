import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { overlayStandardSkillContentFromCode } from 'src/engine/metadata-modules/skill/utils/overlay-standard-skill-content-from-code.util';
import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

const buildFlatSkill = (overrides: Partial<FlatSkill>): FlatSkill =>
  ({
    name: 'search',
    content: 'stale copy from the database',
    isCustom: false,
    ...overrides,
  }) as FlatSkill;

describe('overlayStandardSkillContentFromCode', () => {
  it('should replace the stored content of a standard skill with the code version', () => {
    const result = overlayStandardSkillContentFromCode(buildFlatSkill({}));

    expect(result.content).toBe(loadStandardSkillContent('search'));
  });

  it('should keep a custom skill untouched', () => {
    const customSkill = buildFlatSkill({ isCustom: true });

    expect(overlayStandardSkillContentFromCode(customSkill)).toBe(customSkill);
  });

  it('should keep a skill whose name is not a standard skill', () => {
    const unknownSkill = buildFlatSkill({ name: 'my-own-playbook' });

    expect(overlayStandardSkillContentFromCode(unknownSkill)).toBe(
      unknownSkill,
    );
  });
});

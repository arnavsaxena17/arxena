import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { planStandardSkillSync } from 'src/database/commands/upgrade-version-command/common/plan-standard-skill-sync.util';

const buildSkill = (overrides: Partial<FlatSkill>): FlatSkill =>
  ({
    universalIdentifier: 'skill-a',
    name: 'search',
    label: 'Search',
    description: 'Find things',
    content: 'text',
    ...overrides,
  }) as FlatSkill;

const toMaps = (skills: FlatSkill[]) => ({
  byUniversalIdentifier: Object.fromEntries(
    skills.map((skill) => [skill.universalIdentifier, skill]),
  ),
});

describe('planStandardSkillSync', () => {
  it('should create a standard skill the workspace does not have', () => {
    const plan = planStandardSkillSync({
      existingFlatSkillMaps: toMaps([]),
      standardFlatSkillMaps: toMaps([buildSkill({})]),
    });

    expect(plan.skillsToCreate.map((skill) => skill.name)).toEqual(['search']);
    expect(plan.skillsToUpdate).toEqual([]);
  });

  it('should refresh label and description but keep the workspace row identity', () => {
    const existing = buildSkill({
      id: 'row-1',
      label: 'Old',
      description: 'Old description',
    } as Partial<FlatSkill>);
    const plan = planStandardSkillSync({
      existingFlatSkillMaps: toMaps([existing]),
      standardFlatSkillMaps: toMaps([buildSkill({})]),
    });

    expect(plan.skillsToUpdate).toEqual([
      expect.objectContaining({
        id: 'row-1',
        label: 'Search',
        description: 'Find things',
      }),
    ]);
  });

  it('should leave an up-to-date skill alone', () => {
    const plan = planStandardSkillSync({
      existingFlatSkillMaps: toMaps([buildSkill({})]),
      standardFlatSkillMaps: toMaps([buildSkill({})]),
    });

    expect(plan).toEqual({ skillsToCreate: [], skillsToUpdate: [] });
  });

  it('should not touch a skill that is not standard', () => {
    const plan = planStandardSkillSync({
      existingFlatSkillMaps: toMaps([
        buildSkill({ universalIdentifier: 'custom', name: 'mine' }),
      ]),
      standardFlatSkillMaps: toMaps([]),
    });

    expect(plan).toEqual({ skillsToCreate: [], skillsToUpdate: [] });
  });
});

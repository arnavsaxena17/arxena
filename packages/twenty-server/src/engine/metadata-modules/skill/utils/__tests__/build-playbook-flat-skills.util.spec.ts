import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { withUnstoredPlaybooks } from 'src/engine/metadata-modules/skill/utils/build-playbook-flat-skills.util';

describe('withUnstoredPlaybooks', () => {
  it('should not invent a find-role playbook', () => {
    const skills = withUnstoredPlaybooks('workspace-id', []);

    expect(skills.map((skill) => skill.name)).not.toContain(
      'find-role-at-companies',
    );
  });

  it('should keep the other stored skills', () => {
    const stored = { name: 'search' } as FlatSkill;

    expect(withUnstoredPlaybooks('workspace-id', [stored])[0]).toBe(stored);
  });
});

import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { withUnstoredPlaybooks } from 'src/engine/metadata-modules/skill/utils/build-playbook-flat-skills.util';

const PLAYBOOK = 'find-role-at-companies';

describe('withUnstoredPlaybooks', () => {
  it('should offer a playbook that has no stored row, built from its file', () => {
    const skills = withUnstoredPlaybooks('workspace-id', []);
    const playbook = skills.find((skill) => skill.name === PLAYBOOK);

    expect(playbook).toMatchObject({
      label: 'Find Role At Companies',
      isActive: true,
      isCustom: false,
      workspaceId: 'workspace-id',
      content: getSkillContent(PLAYBOOK),
    });
  });

  it('should let a stored row win over the file-built one', () => {
    const stored = {
      name: PLAYBOOK,
      label: 'Stored',
      content: 'stored text',
    } as FlatSkill;

    const skills = withUnstoredPlaybooks('workspace-id', [stored]);

    expect(skills.filter((skill) => skill.name === PLAYBOOK)).toEqual([stored]);
  });

  it('should keep the other stored skills', () => {
    const stored = { name: 'search' } as FlatSkill;

    expect(withUnstoredPlaybooks('workspace-id', [stored])[0]).toBe(stored);
  });
});

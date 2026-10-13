import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { getPlaybookUniversalIdentifier } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-playbook-skills.constant';
import { buildStandardFlatSkillMetadataMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-standard-flat-skill-metadata-maps.util';

const PLAYBOOK = 'find-role-at-companies';

describe('standard playbook skills', () => {
  const maps = buildStandardFlatSkillMetadataMaps({
    workspaceId: 'workspace-id',
    twentyStandardApplicationId: 'application-id',
    now: '2026-10-13T00:00:00.000Z',
  } as never);
  const skills = Object.values(maps.byUniversalIdentifier);

  it('should register a playbook as a standard skill with no entry in code', () => {
    const playbook = skills.find((skill) => skill?.name === PLAYBOOK);

    expect(playbook).toMatchObject({
      label: 'Find Role At Companies',
      icon: 'IconUserSearch',
      isCustom: false,
      content: getSkillContent(PLAYBOOK),
    });
  });

  it('should derive the same universal identifier from the name every time', () => {
    expect(getPlaybookUniversalIdentifier(PLAYBOOK)).toBe(
      getPlaybookUniversalIdentifier(PLAYBOOK),
    );
    expect(getPlaybookUniversalIdentifier(PLAYBOOK)).not.toBe(
      getPlaybookUniversalIdentifier('another-playbook'),
    );
    expect(
      skills.find((skill) => skill?.name === PLAYBOOK)?.universalIdentifier,
    ).toBe(getPlaybookUniversalIdentifier(PLAYBOOK));
  });

  it('should not collide with the hand-registered skills', () => {
    const identifiers = skills.map((skill) => skill?.universalIdentifier);

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });
});

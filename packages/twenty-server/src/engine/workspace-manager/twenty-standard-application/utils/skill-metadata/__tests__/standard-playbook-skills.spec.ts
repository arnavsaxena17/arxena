import { getPlaybookUniversalIdentifier } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-playbook-skills.constant';
import { buildStandardFlatSkillMetadataMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-standard-flat-skill-metadata-maps.util';

describe('standard playbook skills', () => {
  const maps = buildStandardFlatSkillMetadataMaps({
    workspaceId: 'workspace-id',
    twentyStandardApplicationId: 'application-id',
    now: '2026-10-13T00:00:00.000Z',
  } as never);
  const skills = Object.values(maps.byUniversalIdentifier);

  it('should not register find-role-at-companies', () => {
    expect(
      skills.find((skill) => skill?.name === 'find-role-at-companies'),
    ).toBeUndefined();
  });

  it('should derive the same universal identifier from the name every time', () => {
    expect(getPlaybookUniversalIdentifier('find-role-at-companies')).toBe(
      getPlaybookUniversalIdentifier('find-role-at-companies'),
    );
    expect(getPlaybookUniversalIdentifier('find-role-at-companies')).not.toBe(
      getPlaybookUniversalIdentifier('another-playbook'),
    );
  });

  it('should not collide with the hand-registered skills', () => {
    const identifiers = skills.map((skill) => skill?.universalIdentifier);

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });
});

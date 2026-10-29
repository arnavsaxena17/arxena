import { getPlaybookUniversalIdentifier } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-playbook-skills.constant';
import { buildStandardFlatSkillMetadataMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-standard-flat-skill-metadata-maps.util';

describe('standard playbook skills', () => {
  const maps = buildStandardFlatSkillMetadataMaps({
    workspaceId: 'workspace-id',
    twentyStandardApplicationId: 'application-id',
    now: '2026-10-13T00:00:00.000Z',
  } as never);
  const skills = Object.values(maps.byUniversalIdentifier);

  it('should not register find-people-by-company', () => {
    expect(
      skills.find((skill) => skill?.name === 'find-people-by-company'),
    ).toBeUndefined();
  });

  it('should derive the same universal identifier from the name every time', () => {
    expect(getPlaybookUniversalIdentifier('find-people-by-company')).toBe(
      getPlaybookUniversalIdentifier('find-people-by-company'),
    );
    expect(getPlaybookUniversalIdentifier('find-people-by-company')).not.toBe(
      getPlaybookUniversalIdentifier('another-playbook'),
    );
  });

  it('should not collide with the hand-registered skills', () => {
    const identifiers = skills.map((skill) => skill?.universalIdentifier);

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });
});

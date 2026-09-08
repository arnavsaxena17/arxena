import {
  buildOutreachMockUnipileUploadPeople,
  findOutreachMockUnipileRawProfile,
  mapOutreachMockUnipileProfile,
  OUTREACH_MOCK_UNIPILE_RAW_PROFILES,
  toOutreachMockUnipileUploadPerson,
} from '../outreach-mock-unipile-profiles.util';

describe('outreach-mock-unipile-profiles', () => {
  it('loads seven raw Unipile fixtures', () => {
    expect(OUTREACH_MOCK_UNIPILE_RAW_PROFILES).toHaveLength(7);
    expect(
      OUTREACH_MOCK_UNIPILE_RAW_PROFILES.every(
        (profile) =>
          typeof profile.public_identifier === 'string' &&
          typeof profile.provider_id === 'string',
      ),
    ).toBe(true);
  });

  it('finds fixtures by public_identifier and provider_id', () => {
    expect(findOutreachMockUnipileRawProfile('sarbvirsingh')?.first_name).toBe(
      'Sarbvir',
    );
    expect(
      findOutreachMockUnipileRawProfile(
        'ACoAAAAOewkB59q5KIC03Ex8Ufp9zVLL1F0lH-I',
      )?.public_identifier,
    ).toBe('sarbvirsingh');
  });

  it('maps Unipile raw → upload-profiles person with experience details', () => {
    const raw = findOutreachMockUnipileRawProfile('saurabhsinghz');

    expect(raw).toBeDefined();

    const mapped = mapOutreachMockUnipileProfile(raw!);
    const person = toOutreachMockUnipileUploadPerson(raw!, 'project-1');

    expect(mapped.linkedinUrl).toBe(
      'https://www.linkedin.com/in/saurabhsinghz',
    );
    expect(mapped.linkedinProfileId).toMatch(/^ACoAA/);
    expect(mapped.experience.length).toBeGreaterThan(0);
    expect(person).toEqual(
      expect.objectContaining({
        name: 'SAURABH SINGH',
        title: 'Director & CEO',
        company: 'Appinventiv',
        linkedinUrl: 'https://www.linkedin.com/in/saurabhsinghz',
        projectId: 'project-1',
      }),
    );
    expect(person?.current_positions).toEqual(mapped.experience);
  });

  it('builds unique-company upload people for all fixtures', () => {
    const people = buildOutreachMockUnipileUploadPeople({
      projectId: 'project-1',
    });

    expect(people).toHaveLength(7);
    expect(new Set(people.map((person) => person.company)).size).toBe(7);
    expect(people.map((person) => person.name)).toEqual([
      'Arvind Pathak',
      'Deepak Korpal',
      'Divyesh Shah',
      'Rajeev Sonthalia',
      'SAURABH SINGH',
      'Sarbvir Singh',
      'Vineet Sharma',
    ]);
  });
});

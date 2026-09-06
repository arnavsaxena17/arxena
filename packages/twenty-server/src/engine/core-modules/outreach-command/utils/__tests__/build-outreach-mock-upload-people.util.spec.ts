import {
  buildOutreachMockUploadPeople,
  OUTREACH_MOCK_UPLOAD_DEFAULT_COUNT,
  OUTREACH_MOCK_UPLOAD_MAX_COUNT,
  resolveOutreachMockUploadCount,
} from '../build-outreach-mock-upload-people.util';

describe('buildOutreachMockUploadPeople', () => {
  it('builds unique linkedin + company rows', () => {
    const people = buildOutreachMockUploadPeople({
      count: 3,
      projectId: 'project-1',
      stamp: 1_700_000_000_000,
    });

    expect(people).toHaveLength(3);
    expect(people[0]).toEqual(
      expect.objectContaining({
        name: 'Mock Profile 1',
        company: 'Mock Co 1',
        linkedinProfileId: 'mock-bc-profile-1700000000000-1',
        projectId: 'project-1',
      }),
    );
    expect(people[2].linkedinUrl).toBe(
      'https://www.linkedin.com/in/mock-bc-profile-1700000000000-3',
    );
    expect(new Set(people.map((person) => person.company)).size).toBe(3);
  });
});

describe('resolveOutreachMockUploadCount', () => {
  it('defaults and clamps', () => {
    expect(resolveOutreachMockUploadCount(undefined)).toBe(
      OUTREACH_MOCK_UPLOAD_DEFAULT_COUNT,
    );
    expect(resolveOutreachMockUploadCount(7.9)).toBe(7);
    expect(() => resolveOutreachMockUploadCount(0)).toThrow(/at least 1/);
    expect(() =>
      resolveOutreachMockUploadCount(OUTREACH_MOCK_UPLOAD_MAX_COUNT + 1),
    ).toThrow(/at most/);
  });
});

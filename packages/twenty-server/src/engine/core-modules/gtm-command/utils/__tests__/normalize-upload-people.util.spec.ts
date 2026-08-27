import {
  collectUploadCandidateIds,
  normalizeUploadPeople,
  toUploadProfilesPerson,
} from '../normalize-upload-people.util';

describe('normalizeUploadPeople', () => {
  it('keeps search-people hits', () => {
    expect(
      normalizeUploadPeople({
        success: true,
        people: [
          {
            firstName: 'Arapa',
            lastName: 'Hara',
            linkedinUrl: 'https://www.linkedin.com/in/example',
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        firstName: 'Arapa',
        lastName: 'Hara',
        linkedinUrl: 'https://www.linkedin.com/in/example',
      }),
    ]);
  });

  it('wraps a fetch-linkedin-profile result as one person', () => {
    expect(
      normalizeUploadPeople({
        success: true,
        firstName: 'Prenisha',
        lastName: 'Harry',
        headline: 'Senior People Director, International - e.l.f Beauty',
        location: 'London, England, United Kingdom',
        linkedinUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
        linkedinProfileId: 'ACoAAAIRqlkBVrZQVLDnz6_oel2hQOLSyF77bKk',
        profilePictureUrl: 'https://media.licdn.com/example.jpg',
        experience: [
          {
            company: 'E.L.F. BEAUTY',
            position: 'Senior People Director, International',
          },
        ],
        skills: ['Talent Management'],
        snapshot: '{}',
        error: '',
      }),
    ).toEqual([
      {
        name: 'Prenisha Harry',
        firstName: 'Prenisha',
        lastName: 'Harry',
        title: 'Senior People Director, International',
        headline: 'Senior People Director, International - e.l.f Beauty',
        company: 'E.L.F. BEAUTY',
        companyName: 'E.L.F. BEAUTY',
        location: 'London, England, United Kingdom',
        linkedinUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
        linkedinProfileId: 'ACoAAAIRqlkBVrZQVLDnz6_oel2hQOLSyF77bKk',
        peopleId: 'ACoAAAIRqlkBVrZQVLDnz6_oel2hQOLSyF77bKk',
        profilePictureUrl: 'https://media.licdn.com/example.jpg',
      },
    ]);
  });

  it('accepts a LinkedIn URL string', () => {
    expect(
      normalizeUploadPeople('https://www.linkedin.com/in/prenisha-harry-075760b'),
    ).toEqual([
      {
        linkedinUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
        linkedinProfileId: 'prenisha-harry-075760b',
      },
    ]);
  });

  it('does not treat a candidate UUID as a LinkedIn slug', () => {
    expect(
      normalizeUploadPeople('02143774-8d09-44e8-bb72-9a0d1e5104f3'),
    ).toEqual([]);
  });

  it('maps a candidate record with Links + nested name', () => {
    expect(
      toUploadProfilesPerson({
        id: '02143774-8d09-44e8-bb72-9a0d1e5104f3',
        name: { firstName: 'Prenisha', lastName: 'Harry' },
        jobTitle: 'Senior People Director',
        jobCompanyName: 'E.L.F. BEAUTY',
        projectsId: '99b70b94-3d4d-425b-9e3a-881c1361de7f',
        peopleId: 'ACoAAAIRqlkBVrZQVLDnz6_oel2hQOLSyF77bKk',
        linkedinUrl: {
          primaryLinkUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        firstName: 'Prenisha',
        lastName: 'Harry',
        name: 'Prenisha Harry',
        title: 'Senior People Director',
        company: 'E.L.F. BEAUTY',
        linkedinUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
        linkedinProfileId: 'prenisha-harry-075760b',
        candidateId: '02143774-8d09-44e8-bb72-9a0d1e5104f3',
        projectId: '99b70b94-3d4d-425b-9e3a-881c1361de7f',
      }),
    );
  });
});

describe('collectUploadCandidateIds', () => {
  it('collects a candidate UUID string', () => {
    expect(
      collectUploadCandidateIds('02143774-8d09-44e8-bb72-9a0d1e5104f3'),
    ).toEqual(['02143774-8d09-44e8-bb72-9a0d1e5104f3']);
  });

  it('collects candidate ids from people and candidateId without treating projectId as a candidate', () => {
    expect(
      collectUploadCandidateIds(
        '02143774-8d09-44e8-bb72-9a0d1e5104f3',
        [
          {
            id: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
            linkedinUrl: {
              primaryLinkUrl: 'https://www.linkedin.com/in/example',
            },
            projectsId: '99b70b94-3d4d-425b-9e3a-881c1361de7f',
          },
        ],
        undefined,
        {
          projectId: '99b70b94-3d4d-425b-9e3a-881c1361de7f',
          candidateId: '11111111-1111-4111-8111-111111111111',
        },
      ),
    ).toEqual([
      '02143774-8d09-44e8-bb72-9a0d1e5104f3',
      'a1b2c3d4-e5f6-4789-8abc-def012345678',
      '11111111-1111-4111-8111-111111111111',
    ]);
  });
});

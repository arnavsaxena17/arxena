import { normalizeUploadPeople } from '../normalize-upload-people.util';

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
});

import {
  buildOutreachMockUploadPeople,
  OUTREACH_MOCK_MD_CEO_PROFILES,
  OUTREACH_MOCK_UPLOAD_DEFAULT_COUNT,
  OUTREACH_MOCK_UPLOAD_MAX_COUNT,
  resolveOutreachMockUploadCount,
} from '../build-outreach-mock-upload-people.util';
import { OUTREACH_MOCK_UNIPILE_RAW_PROFILES } from '../outreach-mock-unipile-profiles.util';

describe('buildOutreachMockUploadPeople', () => {
  it('leads with Unipile-transformed MD/CEO upload people', () => {
    const people = buildOutreachMockUploadPeople({
      count: 3,
      projectId: 'project-1',
      stamp: 1_700_000_000_000,
    });

    expect(people).toHaveLength(3);
    expect(people[0]).toEqual(
      expect.objectContaining({
        name: 'Arvind Pathak',
        firstName: 'Arvind',
        lastName: 'Pathak',
        title: 'GMD and CEO',
        company: 'Dangote Cement',
        companyName: 'Dangote Cement',
        headline: 'Group MD and CEO at Dangote Cement Plc.',
        linkedinUrl: 'https://www.linkedin.com/in/arvind-pathak-7b165255',
        linkedinProfileId: 'ACoAAAup_vUBg-znzOwjDf7Ro5xmidw6dCrh58I',
        projectId: 'project-1',
      }),
    );
    expect(people[0].current_positions?.length).toBeGreaterThan(0);
    expect(people[1]).toEqual(
      expect.objectContaining({
        name: 'Deepak Korpal',
        company: 'ACG Cellulose Private Ltd',
        title: 'President & CEO',
      }),
    );
    expect(people[2].linkedinUrl).toBe(
      'https://www.linkedin.com/in/divyesh-shah-b1b97698',
    );
    expect(new Set(people.map((person) => person.company)).size).toBe(3);
  });

  it('fills remaining slots from the curated MD/CEO catalog', () => {
    const unipileCount = OUTREACH_MOCK_UNIPILE_RAW_PROFILES.length;
    const people = buildOutreachMockUploadPeople({
      count: unipileCount + 2,
      projectId: 'project-1',
      stamp: 1_700_000_000_000,
    });

    expect(people).toHaveLength(unipileCount + 2);
    expect(people[unipileCount]).toEqual(
      expect.objectContaining({
        name: 'Satya Nadella',
        company: 'Microsoft',
        linkedinProfileId: 'satyanadella-mock-1700000000000-1',
      }),
    );
  });

  it('catalog fillers have unique companies and MD/CEO-style titles', () => {
    const companies = OUTREACH_MOCK_MD_CEO_PROFILES.map(
      (profile) => profile.company,
    );

    expect(new Set(companies).size).toBe(companies.length);

    const leadershipTitleCount = OUTREACH_MOCK_MD_CEO_PROFILES.filter(
      (profile) =>
        /\b(CEO|MD|Managing Director|Chairman|Founder|Co-CEO|President)\b/i.test(
          profile.title,
        ),
    ).length;

    expect(leadershipTitleCount).toBeGreaterThan(
      OUTREACH_MOCK_MD_CEO_PROFILES.length * 0.8,
    );
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

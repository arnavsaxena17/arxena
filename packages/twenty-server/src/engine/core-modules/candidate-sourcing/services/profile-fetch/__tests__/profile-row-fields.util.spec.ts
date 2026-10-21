import {
  isUsableProfile,
  profileToRowProfile,
  readRowProfile,
} from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';

const fetchedAt = '2026-10-19T10:00:00.000Z';

describe('profileToRowProfile', () => {
  it('should reduce a Bright Data record to compact fields with provenance', () => {
    const profile = profileToRowProfile({
      source: 'bright_data',
      fetchedAt,
      record: {
        about: 'Runs a chemicals plant.',
        experience: [
          {
            title: 'Plant Head',
            company: 'Clariant',
            start_date: '2019',
            end_date: null,
          },
        ],
        education: [{ title: 'IIT Bombay', end_year: '2001' }],
        followers: 1200,
        connections: 500,
        avatar: 'https://img/a.png',
        location: 'Pune',
      },
    });

    expect(profile).toMatchObject({
      source: 'bright_data',
      fetchedAt,
      experience: 'Plant Head @ Clariant (2019 - present)',
      education: 'IIT Bombay, 2001',
      followers: 1200,
      hasPhoto: true,
      location: 'Pune',
    });
    expect(profile.fieldsPresent).toEqual(
      expect.arrayContaining([
        'about',
        'experience',
        'education',
        'followers',
        'connections',
        'location',
        'photo',
      ]),
    );
  });

  it('should read the Harvest shape', () => {
    const profile = profileToRowProfile({
      source: 'harvest',
      fetchedAt,
      record: {
        headline: 'Head of Operations',
        experience: [
          {
            position: 'Head of Operations',
            companyName: 'Acme',
            duration: '3 yrs',
          },
        ],
      },
    });

    expect(profile.headline).toBe('Head of Operations');
    expect(profile.experience).toBe('Head of Operations @ Acme (3 yrs)');
    expect(profile.hasPhoto).toBeUndefined();
  });

  it('should not claim a part the provider did not return', () => {
    const profile = profileToRowProfile({
      source: 'harvest',
      fetchedAt,
      record: { headline: 'CEO' },
    });

    expect(profile.fieldsPresent).toEqual(['headline']);
    expect(profile.education).toBeUndefined();
  });

  it('should read Bright Data people-search bags for experience and education', () => {
    const profile = profileToRowProfile({
      source: 'bright_data',
      fetchedAt,
      record: {
        about: 'Founder',
        past_job_titles: 'Volunteer; Analyst',
        past_company_names: 'Dream Org; Acme',
        education_schools: 'IGNOU',
        education_details: 'BA',
        connections: 500,
      },
    });

    expect(profile.experience).toBe('Volunteer @ Dream Org; Analyst @ Acme');
    expect(profile.education).toBe('IGNOU, BA');
    expect(profile.fieldsPresent).toEqual(
      expect.arrayContaining([
        'experience',
        'education',
        'about',
        'connections',
      ]),
    );
  });

  it('should cut a long about text', () => {
    const profile = profileToRowProfile({
      source: 'bright_data',
      fetchedAt,
      record: { about: 'x'.repeat(2000) },
    });

    expect(profile.about?.length).toBeLessThan(900);
  });

  it('should keep only the most recent experience entries', () => {
    const profile = profileToRowProfile({
      source: 'bright_data',
      fetchedAt,
      record: {
        experience: Array.from({ length: 20 }, (_, index) => ({
          title: `Role ${index}`,
          company: 'Co',
        })),
      },
    });

    expect(profile.experience?.split('; ')).toHaveLength(8);
  });
});

describe('isUsableProfile', () => {
  it('should treat a record with no judgeable part as a miss', () => {
    expect(
      isUsableProfile(
        profileToRowProfile({
          source: 'bright_data',
          fetchedAt,
          record: { followers: 10, avatar: 'x' },
        }),
      ),
    ).toBe(false);
  });

  it('should accept a record with experience', () => {
    expect(
      isUsableProfile(
        profileToRowProfile({
          source: 'bright_data',
          fetchedAt,
          record: { experience: [{ title: 'CEO', company: 'Acme' }] },
        }),
      ),
    ).toBe(true);
  });
});

describe('readRowProfile', () => {
  it('should find a stored profile and ignore anything else', () => {
    expect(
      readRowProfile({ profile: { source: 'harvest', fetchedAt } }),
    ).toBeDefined();
    expect(readRowProfile({ profile: 'text' })).toBeUndefined();
    expect(readRowProfile({})).toBeUndefined();
  });
});

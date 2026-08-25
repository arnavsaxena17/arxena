import {
  hydrateLinkedinPremiumCandidates,
  linkedinPremiumProfileNeedsFetch,
  mapFetchedLinkedinProfileToPremiumUpload,
  readLinkedinUrlFromCandidate,
} from '../hydrate-linkedin-premium-from-fetch.util';

const fetchedProfile = {
  success: true as const,
  firstName: 'Prenisha',
  lastName: 'Harry',
  headline: 'Senior People Director, International - e.l.f Beauty',
  about: 'People leader',
  location: 'London, England, United Kingdom',
  linkedinUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
  profilePictureUrl: 'https://media.licdn.com/photo.jpg',
  linkedinProfileId: 'prenisha-harry-075760b',
  experience: [
    {
      company: 'E.L.F. BEAUTY',
      position: 'Senior People Director, International',
      location: 'London',
      start: 'Jan 2025',
      end: 'Present',
    },
  ],
  skills: ['Talent Management'],
  error: '',
};

describe('hydrate-linkedin-premium-from-fetch', () => {
  it('reads linkedin url from CRX parse shape', () => {
    expect(
      readLinkedinUrlFromCandidate({
        linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
      }),
    ).toBe('https://www.linkedin.com/in/prenisha-harry-075760b/');
  });

  it('needs fetch when url is present but name is missing or a placeholder', () => {
    expect(
      linkedinPremiumProfileNeedsFetch({
        linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
      }),
    ).toBe(true);
    expect(
      linkedinPremiumProfileNeedsFetch({
        fullName: 'John Doe',
        linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
      }),
    ).toBe(true);
    expect(
      linkedinPremiumProfileNeedsFetch({
        fullName: 'Prenisha Harry',
        linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
      }),
    ).toBe(false);
  });

  it('prefers a public /in/ url over a Recruiter talent url', () => {
    expect(
      readLinkedinUrlFromCandidate({
        linkedin_url: 'https://www.linkedin.com/talent/profile/abc',
        public_linkedin_url:
          'https://www.linkedin.com/in/prenisha-harry-075760b/',
      }),
    ).toBe('https://www.linkedin.com/in/prenisha-harry-075760b/');
  });

  it('maps fetch-linkedin-profile output to linkedin_premium upload fields', () => {
    expect(mapFetchedLinkedinProfileToPremiumUpload(fetchedProfile)).toEqual(
      expect.objectContaining({
        fullName: 'Prenisha Harry',
        full_name: 'Prenisha Harry',
        headline: 'Senior People Director, International - e.l.f Beauty',
        job_title: 'Senior People Director, International',
        location_name: 'London, England, United Kingdom',
        linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
        company_name: 'E.L.F. BEAUTY',
        fetched_from_url: true,
      }),
    );
  });

  it('fetches from url when CRX parse is incomplete and keeps phone/email', async () => {
    const fetchProfile = jest.fn().mockResolvedValue(fetchedProfile);

    const hydrated = await hydrateLinkedinPremiumCandidates(
      [
        {
          linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
          phone_number: '+44 7700 900000',
          email_address: 'prenisha@example.com',
        },
      ],
      fetchProfile,
    );

    expect(fetchProfile).toHaveBeenCalledWith(
      'https://www.linkedin.com/in/prenisha-harry-075760b/',
    );
    expect(hydrated[0]).toEqual(
      expect.objectContaining({
        fullName: 'Prenisha Harry',
        phone_number: '+44 7700 900000',
        email_address: 'prenisha@example.com',
      }),
    );
  });

  it('uses fetch-linkedin-profile as primary even when CRX parse already has a name', async () => {
    const fetchProfile = jest.fn().mockResolvedValue(fetchedProfile);

    const hydrated = await hydrateLinkedinPremiumCandidates(
      [
        {
          fullName: 'Wrong Name From DOM',
          linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
        },
      ],
      fetchProfile,
    );

    expect(fetchProfile).toHaveBeenCalledWith(
      'https://www.linkedin.com/in/prenisha-harry-075760b/',
    );
    expect(hydrated[0]).toEqual(
      expect.objectContaining({
        fullName: 'Prenisha Harry',
        fetched_from_url: true,
      }),
    );
  });

  it('keeps parsed profile when fetch fails', async () => {
    const original = {
      fullName: 'Prenisha Harry',
      linkedin_url: 'https://www.linkedin.com/in/prenisha-harry-075760b/',
    };
    const hydrated = await hydrateLinkedinPremiumCandidates(
      [original],
      async () => {
        throw new Error('Unipile down');
      },
    );

    expect(hydrated).toEqual([original]);
  });
});

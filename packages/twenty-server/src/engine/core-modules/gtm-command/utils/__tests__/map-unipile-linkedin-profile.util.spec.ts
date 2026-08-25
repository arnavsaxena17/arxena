import { mapUnipileLinkedinProfile } from 'src/engine/core-modules/gtm-command/utils/map-unipile-linkedin-profile.util';

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('mapUnipileLinkedinProfile', () => {
  it('stores provider_id on linkedinProfileId and builds the URL from public_identifier', () => {
    expect(
      mapUnipileLinkedinProfile(
        {
          provider_id: VALID_PROVIDER_ID,
          public_identifier: 'jane-doe',
          first_name: 'Jane',
          last_name: 'Doe',
        },
        'jane-doe',
      ),
    ).toMatchObject({
      linkedinProfileId: VALID_PROVIDER_ID,
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
      firstName: 'Jane',
      lastName: 'Doe',
    });
  });

  it('does not build /in/ACoAA… when public_identifier is missing', () => {
    expect(
      mapUnipileLinkedinProfile(
        {
          provider_id: VALID_PROVIDER_ID,
        },
        VALID_PROVIDER_ID,
      ),
    ).toMatchObject({
      linkedinProfileId: VALID_PROVIDER_ID,
      linkedinUrl: '',
    });
  });

  it('keeps an explicit profile_url and prefers it over a constructed slug URL', () => {
    expect(
      mapUnipileLinkedinProfile(
        {
          provider_id: VALID_PROVIDER_ID,
          public_identifier: 'jane-doe',
          profile_url: 'https://www.linkedin.com/in/jane-doe/',
        },
        'jane-doe',
      ).linkedinUrl,
    ).toBe('https://www.linkedin.com/in/jane-doe/');
  });

  it('falls back to the public identifier when provider_id is absent', () => {
    expect(
      mapUnipileLinkedinProfile(
        { public_identifier: 'jane-doe' },
        'other-slug',
      ),
    ).toMatchObject({
      linkedinProfileId: 'jane-doe',
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
    });
  });
});

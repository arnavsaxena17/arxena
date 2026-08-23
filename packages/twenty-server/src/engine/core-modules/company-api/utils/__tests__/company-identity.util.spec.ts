import {
  collectIdentityKeySet,
  extractLinkedinCompanyId,
  hitMatchesIdentityKeys,
  identityKeysForHit,
  normalizeCompanyUrl,
} from '../company-identity.util';

describe('company-identity.util', () => {
  it('normalizes LinkedIn and website URLs', () => {
    expect(normalizeCompanyUrl('https://www.Acme.com/about?x=1')).toBe(
      'acme.com/about',
    );
  });

  it('extracts numeric LinkedIn company ids', () => {
    expect(
      extractLinkedinCompanyId({
        id: 'acme',
        linkedinUrl: 'https://www.linkedin.com/company/1035',
      }),
    ).toBe('1035');
    expect(extractLinkedinCompanyId({ id: '1035', linkedinUrl: '' })).toBe(
      '1035',
    );
  });

  it('matches a search hit against stored company identity keys', () => {
    const known = collectIdentityKeySet([
      {
        name: 'Microsoft',
        linkedinId: '1035',
        linkedinLinkPrimaryLinkUrl:
          'https://www.linkedin.com/company/microsoft',
      },
    ]);

    expect(
      hitMatchesIdentityKeys(
        {
          id: '1035',
          name: 'Microsoft',
          website: '',
          linkedinUrl: 'https://www.linkedin.com/company/microsoft',
          industry: '',
        },
        known,
      ),
    ).toBe(true);
    expect(
      hitMatchesIdentityKeys(
        {
          id: '99',
          name: 'New Co',
          website: 'new.co',
          linkedinUrl: 'https://www.linkedin.com/company/new-co',
          industry: '',
        },
        known,
      ),
    ).toBe(false);
    expect(
      identityKeysForHit({
        id: '1035',
        name: 'Microsoft',
        website: '',
        linkedinUrl: '',
        industry: '',
      }),
    ).toContain('id:1035');
  });
});

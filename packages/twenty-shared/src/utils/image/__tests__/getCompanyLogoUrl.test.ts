import {
  buildCompanyLogoPath,
  getCompanyLogoUrl,
} from '@/utils/image/getCompanyLogoUrl';

describe('getCompanyLogoUrl', () => {
  it('builds the org-chart company-logo proxy url with website in the path', () => {
    expect(
      getCompanyLogoUrl({
        website: 'example.com',
        serverBaseUrl: 'http://localhost:3000',
      }),
    ).toBe('http://localhost:3000/org-chart/company-logo/example.com');
  });

  it('strips a trailing slash from the server base url', () => {
    expect(
      getCompanyLogoUrl({
        website: 'https://stripe.com',
        serverBaseUrl: 'http://localhost:3000/',
      }),
    ).toBe(
      'http://localhost:3000/org-chart/company-logo/https%3A%2F%2Fstripe.com',
    );
  });

  it('returns undefined when website or server base url is missing', () => {
    expect(
      getCompanyLogoUrl({
        website: 'example.com',
        serverBaseUrl: undefined,
      }),
    ).toBeUndefined();
    expect(
      getCompanyLogoUrl({
        website: '',
        serverBaseUrl: 'http://localhost:3000',
      }),
    ).toBeUndefined();
  });
});

describe('buildCompanyLogoPath', () => {
  it('encodes the website in the path segment', () => {
    expect(buildCompanyLogoPath('stripe.com')).toBe(
      '/org-chart/company-logo/stripe.com',
    );
  });
});

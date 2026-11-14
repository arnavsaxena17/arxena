import { buildGoogleLinkedinCompanySearchUrlFromDomain } from '../linkedin-company-from-serp.util';

describe('buildGoogleLinkedinCompanySearchUrlFromDomain', () => {
  it('should search Google for the domain plus linkedin company', () => {
    expect(
      buildGoogleLinkedinCompanySearchUrlFromDomain({
        domain: 'stayvista.com',
      }),
    ).toBe(
      'https://www.google.com/search?q=stayvista.com%20linkedin%20company',
    );
  });

  it('should include a country hint when provided', () => {
    expect(
      buildGoogleLinkedinCompanySearchUrlFromDomain({
        domain: 'stayvista.com',
        country: 'India',
      }),
    ).toBe(
      'https://www.google.com/search?q=stayvista.com%20India%20linkedin%20company',
    );
  });
});

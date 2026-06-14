import {
    buildCompanyWebsiteLookupVariants,
    collectDomainLookupCandidates,
    extractCompanyNameStemFromDomain,
    extractRootCompanyDomain,
    normalizeBareCompanyDomain,
} from './org-chart-resolve-domain.util';

describe('org-chart-resolve-domain.util', () => {
  it('normalizeBareCompanyDomain strips protocol and www', () => {
    console.log('normalizeBareCompanyDomain strips protocol and www');
    expect(normalizeBareCompanyDomain('https://www.arxena.com/about')).toBe(
      'arxena.com',
    );
    expect(normalizeBareCompanyDomain('arxena.com')).toBe('arxena.com');
  });

  it('buildCompanyWebsiteLookupVariants includes common stored forms', () => {
    console.log('buildCompanyWebsiteLookupVariants includes common stored forms');
    const variants = buildCompanyWebsiteLookupVariants('arxena.com');
    expect(variants).toContain('arxena.com');
    expect(variants).toContain('www.arxena.com');
    expect(variants).toContain('https://arxena.com');
  });

  it('extractRootCompanyDomain strips subdomains', () => {
    console.log('extractRootCompanyDomain strips subdomains');
    expect(extractRootCompanyDomain('dashboard.unipile.com')).toBe('unipile.com');
    expect(extractRootCompanyDomain('arxena.com')).toBe('arxena.com');
  });

  it('extractCompanyNameStemFromDomain removes TLD', () => {
    console.log('extractCompanyNameStemFromDomain removes TLD');
    expect(extractCompanyNameStemFromDomain('dashboard.unipile.com')).toBe(
      'unipile',
    );
    expect(extractCompanyNameStemFromDomain('arxena.com')).toBe('arxena');
  });

  it('collectDomainLookupCandidates orders specific before root', () => {
    console.log('collectDomainLookupCandidates orders specific before root');
    expect(collectDomainLookupCandidates('dashboard.unipile.com')).toEqual([
      'dashboard.unipile.com',
      'unipile.com',
    ]);
  });
});

import {
  buildOfficialWebsiteUrlVariants,
  extractBrandFromDomain,
  extractHostFromWebsiteUrl,
  normalizeCompanyDomain,
} from 'src/engine/core-modules/wikidata/utils/wikidata-domain.util';

describe('wikidata-domain.util', () => {
  it('normalizes domains and website URLs', () => {
    expect(normalizeCompanyDomain('https://www.clariant.com/path')).toBe(
      'clariant.com',
    );
    expect(normalizeCompanyDomain('www.dow.com')).toBe('dow.com');
    expect(normalizeCompanyDomain('dow.com')).toBe('dow.com');
    expect(normalizeCompanyDomain('not-a-domain')).toBeNull();
  });

  it('builds official website URL variants for P856 lookup', () => {
    const variants = buildOfficialWebsiteUrlVariants('clariant.com');

    expect(variants).toContain('https://www.clariant.com');
    expect(variants).toContain('http://www.clariant.com');
    expect(variants).toContain('https://clariant.com/');
    expect(variants).toContain('http://clariant.com');
    expect(variants).toHaveLength(8);
  });

  it('extracts host and brand', () => {
    expect(extractHostFromWebsiteUrl('https://www.dow.com/')).toBe('dow.com');
    expect(extractBrandFromDomain('clariant.com')).toBe('clariant');
  });
});

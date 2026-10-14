import {
  packLinkedinUrlLookupQueries,
  toShortLinkedinProfileUrl,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/linkedin-url-lookup-query.util';

describe('toShortLinkedinProfileUrl', () => {
  it('should drop the country host, scheme and trailing slash', () => {
    expect(
      toShortLinkedinProfileUrl('https://in.linkedin.com/in/jane-doe/'),
    ).toBe('linkedin.com/in/jane-doe');
  });

  it('should return null for a URL that is not a profile', () => {
    expect(
      toShortLinkedinProfileUrl('https://www.linkedin.com/company/acme'),
    ).toBeNull();
    expect(toShortLinkedinProfileUrl('not a url')).toBeNull();
  });
});

describe('packLinkedinUrlLookupQueries', () => {
  it('should keep every query within the length limit', () => {
    const urls = Array.from(
      { length: 20 },
      (_, index) => `https://www.linkedin.com/in/person-number-${index}`,
    );
    const batches = packLinkedinUrlLookupQueries(urls, 100);

    expect(batches.flat()).toHaveLength(20);
    expect(batches.length).toBeGreaterThan(1);

    for (const batch of batches) {
      expect(batch.join(' ').length).toBeLessThanOrEqual(100);
    }
  });

  it('should drop duplicates and non-profile URLs', () => {
    expect(
      packLinkedinUrlLookupQueries([
        'https://in.linkedin.com/in/jane',
        'https://www.linkedin.com/in/jane/',
        'https://www.linkedin.com/company/acme',
      ]),
    ).toEqual([['linkedin.com/in/jane']]);
  });
});

import {
    firstSegmentSlugCandidate,
    generateTheOrgSlugCandidates,
    mergeTheOrgSlugOverrides,
    normalizeTheOrgSlugInput,
    parseLinkedInCompanySlugFromUrl,
    stripTrailingCorporateSlugSegments,
} from './theorg-slug-candidates.util';

describe('theorg-slug-candidates.util', () => {
  describe('normalizeTheOrgSlugInput', () => {
    it('lowercases, trims, maps underscores to hyphens', () => {
      expect(normalizeTheOrgSlugInput('  Batliboi_LTD  ')).toBe('batliboi-ltd');
    });

    it('collapses repeated hyphens', () => {
      expect(normalizeTheOrgSlugInput('foo--bar')).toBe('foo-bar');
    });
  });

  describe('stripTrailingCorporateSlugSegments', () => {
    it('removes trailing ltd', () => {
      expect(stripTrailingCorporateSlugSegments('batliboi-ltd')).toBe('batliboi');
    });

    it('removes multiple trailing corporate segments', () => {
      expect(stripTrailingCorporateSlugSegments('acme-holdings-limited')).toBe('acme');
    });

    it('leaves unknown trailing segment', () => {
      expect(stripTrailingCorporateSlugSegments('acme-ltd-uk')).toBe('acme-ltd-uk');
    });
  });

  describe('firstSegmentSlugCandidate', () => {
    it('returns first segment when long enough', () => {
      expect(firstSegmentSlugCandidate('batliboi-ltd-something')).toBe('batliboi');
    });

    it('returns null for short first segment', () => {
      expect(firstSegmentSlugCandidate('h-m-corp')).toBeNull();
    });
  });

  describe('generateTheOrgSlugCandidates', () => {
    it('orders batliboi-ltd then batliboi via corporate suffix stripping', () => {
      const c = generateTheOrgSlugCandidates('batliboi-ltd');
      expect(c[0]).toBe('batliboi-ltd');
      expect(c[1]).toBe('batliboi');
    });

    it('applies runtime overrides', () => {
      const c = generateTheOrgSlugCandidates('foo-bar', { 'foo-bar': 'baz' });
      expect(c).toEqual(['foo-bar', 'baz', 'foo']);
    });

    it('dedupes identical candidates', () => {
      const c = generateTheOrgSlugCandidates('acme-ltd', { 'acme-ltd': 'acme' });
      const acmeCount = c.filter((s) => s === 'acme').length;
      expect(acmeCount).toBe(1);
    });
  });

  describe('parseLinkedInCompanySlugFromUrl', () => {
    it('extracts vanity slug from company URL', () => {
      expect(
        parseLinkedInCompanySlugFromUrl(
          'https://www.linkedin.com/company/batliboi-ltd',
        ),
      ).toBe('batliboi-ltd');
    });

    it('normalizes segment', () => {
      expect(
        parseLinkedInCompanySlugFromUrl(
          'https://www.linkedin.com/company/Foo_Bar/',
        ),
      ).toBe('foo-bar');
    });

    it('returns null for non-LinkedIn URLs', () => {
      expect(parseLinkedInCompanySlugFromUrl('https://example.com/x')).toBeNull();
    });
  });

  describe('mergeTheOrgSlugOverrides', () => {
    it('merges static with extra', () => {
      const m = mergeTheOrgSlugOverrides({ x: 'y' });
      expect(m.x).toBe('y');
    });
  });
});

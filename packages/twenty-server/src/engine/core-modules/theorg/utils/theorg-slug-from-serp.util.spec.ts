import {
    buildGoogleTheOrgSiteSearchUrl,
    extractTheOrgCompanySlugFromSerpOrganic,
} from './theorg-slug-from-serp.util';

describe('theorg-slug-from-serp.util', () => {
  describe('buildGoogleTheOrgSiteSearchUrl', () => {
    it('builds a Google search URL for site:theorg.com', () => {
      expect(buildGoogleTheOrgSiteSearchUrl('eureka-forbes-ltd')).toBe(
        'https://www.google.com/search?q=eureka-forbes-ltd%20site%3Atheorg.com',
      );
    });
  });

  describe('extractTheOrgCompanySlugFromSerpOrganic', () => {
    it('extracts company slug from org home result', () => {
      const slug = extractTheOrgCompanySlugFromSerpOrganic([
        {
          link: 'https://theorg.com/org/eureka-forbes-limited',
          global_rank: 1,
        },
      ]);
      expect(slug).toBe('eureka-forbes-limited');
    });

    it('extracts company slug from org-chart profile URL', () => {
      const slug = extractTheOrgCompanySlugFromSerpOrganic([
        {
          link: 'https://theorg.com/org/eureka-forbes-limited/org-chart/nishad-satambekar',
          global_rank: 2,
        },
      ]);
      expect(slug).toBe('eureka-forbes-limited');
    });

    it('returns null when organic is empty', () => {
      expect(extractTheOrgCompanySlugFromSerpOrganic([])).toBeNull();
      expect(extractTheOrgCompanySlugFromSerpOrganic(undefined)).toBeNull();
    });
  });
});

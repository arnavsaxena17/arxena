import {
  buildGoogleTheOfficialBoardSiteSearchUrl,
  extractTheOfficialBoardSlugFromSerpOrganic,
} from './theofficialboard-slug-from-serp.util';

describe('theofficialboard-slug-from-serp.util', () => {
  it('builds a Google site query', () => {
    expect(
      buildGoogleTheOfficialBoardSiteSearchUrl('amazon'),
    ).toBe(
      'https://www.google.com/search?q=amazon%20site%3Atheofficialboard.com%2Forg-chart',
    );
  });

  it('extracts an org chart slug from organic results', () => {
    expect(
      extractTheOfficialBoardSlugFromSerpOrganic([
        {
          link: 'https://www.theofficialboard.com/org-chart/walmart-2',
          global_rank: 1,
        },
      ]),
    ).toBe('walmart-2');
  });
});

import {
  buildGoogleSerpSearchUrl,
  mapGoogleSerpOrganicResults,
  resolveGoogleSerpResultLimit,
} from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';

describe('map-google-serp-organic.util', () => {
  it('caps the result limit at 10 and defaults to 8', () => {
    expect(resolveGoogleSerpResultLimit(undefined)).toBe(8);
    expect(resolveGoogleSerpResultLimit(0)).toBe(8);
    expect(resolveGoogleSerpResultLimit(25)).toBe(10);
    expect(resolveGoogleSerpResultLimit(3)).toBe(3);
  });

  it('builds a Google search URL for the query', () => {
    expect(buildGoogleSerpSearchUrl('Julian Lord British Airways', 8)).toBe(
      'https://www.google.com/search?q=Julian+Lord+British+Airways&hl=en&num=8',
    );
  });

  it('maps organic title, url, and snippet and skips incomplete rows', () => {
    expect(
      mapGoogleSerpOrganicResults(
        [
          {
            title: 'Julian Lord | LinkedIn',
            link: 'https://www.linkedin.com/in/lordjulian',
            description: 'Director of IT Operations at British Airways',
            global_rank: 1,
          },
          {
            title: 'Missing URL',
          },
          {
            url: 'https://example.com/about',
            title: 'About BA technology',
            description: 'Cloud and infrastructure',
            rank: 2,
          },
        ],
        8,
      ),
    ).toEqual([
      {
        title: 'Julian Lord | LinkedIn',
        url: 'https://www.linkedin.com/in/lordjulian',
        snippet: 'Director of IT Operations at British Airways',
        rank: 1,
      },
      {
        title: 'About BA technology',
        url: 'https://example.com/about',
        snippet: 'Cloud and infrastructure',
        rank: 2,
      },
    ]);
  });
});

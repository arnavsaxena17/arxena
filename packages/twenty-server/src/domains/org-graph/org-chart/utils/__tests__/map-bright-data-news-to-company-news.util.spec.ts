import {
  buildCompanyNewsSearchQuery,
  mapBrightDataNewsToCompanyNewsResult,
} from '../map-bright-data-news-to-company-news.util';

describe('mapBrightDataNewsToCompanyNewsResult', () => {
  it('maps Fast SERP news rows into company news items', () => {
    const result = mapBrightDataNewsToCompanyNewsResult({
      companyName: 'Acme Corp',
      location: 'New York',
      serp: {
        news: [
          {
            link: 'https://example.com/a',
            title: 'Acme raises Series B',
            source: 'TechCrunch',
            date: '2 hours ago',
            global_rank: 1,
          },
          {
            link: 'https://example.com/b',
            title: 'Acme opens new office',
            date: '1 day ago',
          },
          {
            title: 'Missing link is skipped',
            source: 'Nowhere',
          },
        ],
      },
    });

    expect(result).toEqual({
      company_name: 'Acme Corp',
      location: 'New York',
      news_items: [
        {
          summary: 'Acme raises Series B (TechCrunch)',
          date: '2 hours ago',
          url: 'https://example.com/a',
        },
        {
          summary: 'Acme opens new office',
          date: '1 day ago',
          url: 'https://example.com/b',
        },
      ],
      notes: 'Limited coverage: only 2 news item(s) found.',
    });
  });

  it('notes when no news rows are returned', () => {
    const result = mapBrightDataNewsToCompanyNewsResult({
      companyName: 'Tiny Co',
      serp: { news: [] },
    });

    expect(result.news_items).toEqual([]);
    expect(result.location).toBe('unknown');
    expect(result.notes).toContain('No Google News results');
  });
});

describe('buildCompanyNewsSearchQuery', () => {
  it('includes location when present', () => {
    expect(
      buildCompanyNewsSearchQuery({
        companyName: 'Acme',
        location: 'Austin, TX',
      }),
    ).toBe('Acme Austin, TX');
  });

  it('uses company name alone when location is blank', () => {
    expect(
      buildCompanyNewsSearchQuery({ companyName: 'Acme', location: '  ' }),
    ).toBe('Acme');
  });
});

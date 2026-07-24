import { mergeManualCompanyAutocompleteResults } from './manual-company-autocomplete.util';

describe('mergeManualCompanyAutocompleteResults', () => {
  it('prepends Arxena when the query is arxena (case-insensitive) and PDL returned nothing', () => {
    const merged = mergeManualCompanyAutocompleteResults('arxena', []);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Arxena');
    expect(merged[0].meta.linkedin_slug).toBe('arxena');
    expect(merged[0].meta.website).toBe('arxena.com');
    expect(merged[0].meta.industry).toBe('Internet');
    expect(merged[0].meta.linkedin_url).toBe(
      'https://www.linkedin.com/company/arxena/',
    );
  });

  it('does not duplicate when PDL already returned arxena', () => {
    const merged = mergeManualCompanyAutocompleteResults('arxena', [
      {
        name: 'Arxena',
        meta: {
          id: 'arxena',
          linkedin_slug: 'arxena',
          website: 'arxena.com',
        },
        count: 100,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(100);
  });

  it('returns only API results when the query is not arxena', () => {
    const api = [
      {
        name: 'Other Co',
        meta: { id: 'other' },
        count: 50,
      },
    ];
    expect(mergeManualCompanyAutocompleteResults('other', api)).toEqual(api);
  });
});

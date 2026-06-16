import {
  candidateRowMatchesOrgChartCountryFilter,
  filterOrgChartCandidatesByCountryAndFunctionRoot,
} from './orgchart-filter.util';

describe('candidateRowMatchesOrgChartCountryFilter', () => {
  it('matches locationCountry on ES-shaped rows', () => {
    expect(
      candidateRowMatchesOrgChartCountryFilter(
        { locationCountry: 'india' },
        'india',
      ),
    ).toBe(true);
  });

  it('matches location string on Unipile LinkedIn search rows', () => {
    expect(
      candidateRowMatchesOrgChartCountryFilter(
        { location: 'Mumbai, Maharashtra, India' },
        'india',
      ),
    ).toBe(true);
    expect(
      candidateRowMatchesOrgChartCountryFilter(
        { locationName: 'Bengaluru, Karnataka, India' },
        'india',
      ),
    ).toBe(true);
  });

  it('rejects rows with no location fields', () => {
    expect(
      candidateRowMatchesOrgChartCountryFilter({ name: 'Jane Doe' }, 'india'),
    ).toBe(false);
  });

  it('rejects rows whose location does not include the filter country', () => {
    expect(
      candidateRowMatchesOrgChartCountryFilter(
        { location: 'London, England, United Kingdom' },
        'india',
      ),
    ).toBe(false);
  });
});

describe('filterOrgChartCandidatesByCountryAndFunctionRoot', () => {
  it('keeps LinkedIn search candidates when country was already scoped in the query', () => {
    const items = [
      { name: 'A', location: 'Mumbai, Maharashtra, India' },
      { name: 'B', location: 'London, United Kingdom' },
    ];

    const filtered = filterOrgChartCandidatesByCountryAndFunctionRoot(
      items,
      'india',
      'fullcompany',
    );

    expect(filtered).toHaveLength(1);
    expect((filtered[0] as { name: string }).name).toBe('A');
  });

  it('returns all items when country is global and function root is fullcompany', () => {
    const items = [{ name: 'A', location: 'Paris, France' }];

    expect(
      filterOrgChartCandidatesByCountryAndFunctionRoot(
        items,
        'global',
        'fullcompany',
      ),
    ).toEqual(items);
  });
});

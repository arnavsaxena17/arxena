import { filterOrgChartCandidatesByCountryAndFunctionRoot } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';

describe('super-impose function-root candidate filter', () => {
  it('keeps unclassified Unipile rows when functionRoot is technology', () => {
    const items = [
      {
        name: 'Unclassified Tech Lead',
        headline: 'Engineering Lead at IG Group',
      },
      {
        name: 'Classified Sales',
        std_function_root: 'sales',
      },
      {
        name: 'Classified Tech',
        std_function_root: 'technology',
      },
    ];

    const filtered = filterOrgChartCandidatesByCountryAndFunctionRoot(
      items,
      'global',
      'technology',
    );

    expect(filtered.map((item) => (item as { name: string }).name)).toEqual([
      'Unclassified Tech Lead',
      'Classified Tech',
    ]);
  });

  it('does not zero out a technology fetch of only unclassified rows', () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      name: `Person ${index}`,
      headline: 'Software Engineer',
    }));

    const filtered = filterOrgChartCandidatesByCountryAndFunctionRoot(
      items,
      undefined,
      'technology',
    );

    expect(filtered).toHaveLength(10);
  });
});

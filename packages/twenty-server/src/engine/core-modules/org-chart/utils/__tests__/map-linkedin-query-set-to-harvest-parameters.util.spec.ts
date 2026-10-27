import { isHarvestCompanyNameMatch } from 'src/engine/core-modules/org-chart/utils/harvest-company-name-match.util';
import { mapLinkedinQuerySetToHarvestParameters } from 'src/engine/core-modules/org-chart/utils/map-linkedin-query-set-to-harvest-parameters.util';

const query = {
  keywords: 'textile OR fabric',
  job_title: '"Plant Manager" OR "Factory Manager"',
  company: ['Arvind Ltd'],
  location: ['Mumbai', 'Surat'],
  years_of_experience: null,
};

describe('mapLinkedinQuerySetToHarvestParameters', () => {
  it('should keep titles and locations as text for people', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
      querySet: { search_query_set: [query] },
      category: 'people',
    });

    expect(mapped.searchParameters).toEqual({
      search: 'textile OR fabric',
      currentJobTitles: ['Plant Manager', 'Factory Manager'],
      locations: ['Mumbai', 'Surat'],
    });
    expect(mapped.companyNames).toEqual(['Arvind Ltd']);
  });

  it('should fold a factored title into search', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [
          { ...query, job_title: '"Engineering" AND (Head OR VP)' },
        ],
      },
      category: 'people',
    });

    expect(mapped.searchParameters).toEqual({
      search: '(textile OR fabric) AND ("Engineering" AND (Head OR VP))',
      locations: ['Mumbai', 'Surat'],
    });
  });

  it('should map companies to search and headquarter locations', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
      querySet: { search_query_set: [query] },
      category: 'companies',
    });

    expect(mapped.searchParameters).toEqual({
      search: 'textile OR fabric',
      headquarterLocations: ['Mumbai', 'Surat'],
    });
    expect(mapped.companyNames).toEqual([]);
  });

  it('should drop duplicate queries', () => {
    expect(
      mapLinkedinQuerySetToHarvestParameters({
        querySet: { search_query_set: [query, { ...query, company: null }] },
        category: 'companies',
      }),
    ).toHaveLength(1);
  });
});

describe('isHarvestCompanyNameMatch', () => {
  it('should accept a regional variant and ignore legal suffixes', () => {
    expect(isHarvestCompanyNameMatch('Trident Group', 'Trident Group India')).toBe(
      true,
    );
    expect(isHarvestCompanyNameMatch('Arvind Ltd', 'Arvind Limited')).toBe(true);
  });

  it('should reject a different firm', () => {
    expect(isHarvestCompanyNameMatch('Trident Group', 'Trident Hotels')).toBe(
      false,
    );
    expect(isHarvestCompanyNameMatch('Raymond James', 'Raymond')).toBe(false);
  });
});

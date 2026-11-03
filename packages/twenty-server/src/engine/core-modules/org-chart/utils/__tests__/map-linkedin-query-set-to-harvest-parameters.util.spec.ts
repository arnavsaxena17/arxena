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

  // Harvest's company search documents `location`; `headquarterLocations` is a
  // people-search name, and sending it to the company endpoint drops the filter
  // with no error
  it('should map companies to search and location', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
      querySet: { search_query_set: [query] },
      category: 'companies',
    });

    expect(mapped.searchParameters).toEqual({
      search: 'textile OR fabric',
      location: ['Mumbai', 'Surat'],
    });
    expect(mapped.companyNames).toEqual([]);
    expect(mapped.searchParameters).not.toHaveProperty('headquarterLocations');
  });

  // A facet is a sieve, not a net: Harvest ANDs every parameter and the
  // seniority/function/industry ids are labels a profile may never carry, so
  // combining them with a title search silently loses people a direct search
  // would find.
  it('should send the direct title search and the facet browse separately', () => {
    const mapped = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [
          {
            ...query,
            industry_terms: ['Pharmaceutical Manufacturing'],
            seniority: 'director',
            function: 'sales',
          },
        ],
      },
      category: 'people',
    });

    expect(mapped).toHaveLength(2);

    const [direct, faceted] = mapped;

    expect(direct.id).toContain('direct');
    expect(direct.searchParameters).toHaveProperty('currentJobTitles');
    expect(direct.searchParameters).not.toHaveProperty('industryIds');
    expect(direct.searchParameters).not.toHaveProperty('seniorityLevelIds');

    expect(faceted.id).toContain('faceted');
    // 15 is the vendor id for Pharmaceutical Manufacturing, 220 for director,
    // 25 for sales (verified against the Harvest tables)
    expect(faceted.searchParameters).toMatchObject({
      industryIds: ['15'],
      seniorityLevelIds: ['220'],
      functionIds: ['25'],
    });
    expect(faceted.searchParameters).not.toHaveProperty('currentJobTitles');
  });

  it('should send only one search when there is no carrier or no facet', () => {
    const directOnly = mapLinkedinQuerySetToHarvestParameters({
      querySet: { search_query_set: [{ ...query, industry_terms: null }] },
      category: 'people',
    });

    expect(directOnly).toHaveLength(1);

    const facetedOnly = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [
          { ...query, keywords: null, job_title: null, industry_terms: ['Pharmaceutical Manufacturing'] },
        ],
      },
      category: 'people',
    });

    expect(facetedOnly).toHaveLength(1);
    expect(facetedOnly[0].searchParameters).toHaveProperty('industryIds');
  });

  it('should report an industry label it cannot resolve instead of sending it', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [{ ...query, industry_terms: ['pharma-ish thing'] }],
      },
      category: 'people',
    });

    expect(mapped.searchParameters).not.toHaveProperty('industryIds');
    expect(mapped.unresolvedFilters?.[0]).toContain('pharma-ish thing');
  });

  it('should send the leads-search exclude parameters for people', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [
          {
            ...query,
            exclude_locations: ['Thane'],
            exclude_companies: ['Acme Trading'],
          },
        ],
      },
      category: 'people',
    });

    expect(mapped.searchParameters).toMatchObject({
      excludeLocations: ['Thane'],
      excludeCurrentCompanies: ['Acme Trading'],
    });
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

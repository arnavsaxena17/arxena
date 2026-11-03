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

  it('should resolve industry labels and seniority to Harvest ids', () => {
    const [mapped] = mapLinkedinQuerySetToHarvestParameters({
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

    // 15 is the vendor's id for Pharmaceutical Manufacturing (verified against
    // linkedin_industry_code_v2_all_eng.json)
    expect(mapped.searchParameters).toMatchObject({
      industryIds: ['15'],
      seniorityLevelIds: ['220'],
      functionIds: ['25'],
    });
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

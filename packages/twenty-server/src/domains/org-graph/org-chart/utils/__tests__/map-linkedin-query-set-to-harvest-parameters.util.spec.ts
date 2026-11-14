import { isHarvestCompanyNameMatch } from 'src/domains/org-graph/org-chart/utils/harvest-company-name-match.util';
import {
  HARVEST_MAX_SEARCHES_PER_QUERY,
  mapLinkedinQuerySetToHarvestParameters,
} from 'src/domains/org-graph/org-chart/utils/map-linkedin-query-set-to-harvest-parameters.util';

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

  // Harvest ANDs every parameter, so one unmet constraint zeros the search.
  // The carriers are therefore varied: the full query, each carrier alone, and
  // a facet browse -- unioned on read.
  it('should spread one query across the carrier ladder plus a facet browse', () => {
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

    expect(mapped.map((one) => one.id.split('-').pop())).toEqual([
      'all',
      'titles',
      'keywords',
      'facet',
    ]);

    const [all, titles, keywords, facet] = mapped;

    expect(all.searchParameters).toMatchObject({
      search: 'textile OR fabric',
      currentJobTitles: ['Plant Manager', 'Factory Manager'],
    });
    expect(titles.searchParameters).not.toHaveProperty('search');
    expect(titles.searchParameters).toHaveProperty('currentJobTitles');
    expect(keywords.searchParameters).not.toHaveProperty('currentJobTitles');
    expect(keywords.searchParameters).toHaveProperty('search');
    expect(titles.label).toContain('titles only');
    expect(keywords.label).toContain('keywords only');

    // 15 = Pharmaceutical Manufacturing, 220 = director, 25 = sales
    expect(facet.searchParameters).toMatchObject({
      industryIds: ['15'],
      seniorityLevelIds: ['220'],
      functionIds: ['25'],
    });
    expect(facet.searchParameters).not.toHaveProperty('currentJobTitles');
    expect(facet.searchParameters).not.toHaveProperty('search');
  });

  it('should keep every variant inside the per-query cap', () => {
    expect(HARVEST_MAX_SEARCHES_PER_QUERY).toBe(4);
  });

  it('should produce fewer searches for a query with one carrier', () => {
    const mapped = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [{ ...query, keywords: null, industry_terms: null }],
      },
      category: 'people',
    });

    // titles alone, and 'all' collapses into it via the signature dedupe
    expect(mapped).toHaveLength(1);
    expect(mapped[0].searchParameters).toHaveProperty('currentJobTitles');
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

  it('should recover a retired LinkedIn industry label through the alias table', () => {
    const mapped = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [
          {
            ...query,
            industry_terms: ['Hospital & Health Care'],
            seniority: 'director',
          },
        ],
      },
      category: 'people',
    });

    const facet = mapped.find((one) => one.id.endsWith('-facet'));

    // 14 = Hospitals and Health Care; without the alias the facet would vanish
    expect(facet?.searchParameters).toMatchObject({ industryIds: ['14'] });
    expect(facet?.unresolvedFilters).toBeUndefined();
  });

  // An unmapped function root used to be indistinguishable from an unfiltered
  // search: the facet was simply missing, and the run looked healthy
  it('should report a function root Harvest cannot express', () => {
    const mapped = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [{ ...query, function: 'government' }],
      },
      category: 'people',
    });

    expect(mapped[0].searchParameters).not.toHaveProperty('functionIds');
    expect(mapped[0].unresolvedFilters?.[0]).toContain('government');
    expect(mapped[0].unresolvedFilters?.[0]).toContain('function');
  });

  // An exclusion that fails to resolve returns the rows the caller excluded,
  // which is the more dangerous direction of the same bug
  it('should report an excluded industry label it cannot resolve', () => {
    const mapped = mapLinkedinQuerySetToHarvestParameters({
      querySet: {
        search_query_set: [
          {
            ...query,
            industry_terms: ['Pharmaceutical Manufacturing'],
            seniority: 'director',
            exclude_industries: ['defence adjacent'],
          },
        ],
      },
      category: 'people',
    });

    const facet = mapped.find((one) => one.id.endsWith('-facet'));

    expect(facet?.searchParameters).toHaveProperty('industryIds', ['15']);
    expect(facet?.searchParameters).not.toHaveProperty('excludeIndustryIds');
    expect(facet?.unresolvedFilters?.[0]).toContain('defence adjacent');
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
    expect(
      isHarvestCompanyNameMatch('Trident Group', 'Trident Group India'),
    ).toBe(true);
    expect(isHarvestCompanyNameMatch('Arvind Ltd', 'Arvind Limited')).toBe(
      true,
    );
  });

  it('should reject a different firm', () => {
    expect(isHarvestCompanyNameMatch('Trident Group', 'Trident Hotels')).toBe(
      false,
    );
    expect(isHarvestCompanyNameMatch('Raymond James', 'Raymond')).toBe(false);
  });
});

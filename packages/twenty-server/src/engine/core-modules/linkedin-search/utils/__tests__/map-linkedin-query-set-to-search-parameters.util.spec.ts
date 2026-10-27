import {
  mapLinkedinQuerySetToSearchParameters,
  splitLinkedinFacetDisplay,
} from 'src/engine/core-modules/linkedin-search/utils/map-linkedin-query-set-to-search-parameters.util';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

const QUERY_SET: SearchQuerySet = {
  search_query_set: [
    {
      keywords: 'textile OR fabric',
      job_title: 'Plant Manager',
      company: ['Arvind'],
      location: ['Mumbai'],
      years_of_experience: null,
    },
  ],
};

describe('mapLinkedinQuerySetToSearchParameters', () => {
  it('should put the title in advanced_keywords for classic people', () => {
    const [query] = mapLinkedinQuerySetToSearchParameters({
      querySet: QUERY_SET,
      mode: 'classic',
      category: 'people',
    });

    expect(query.searchParameters).toMatchObject({
      keywords: 'textile OR fabric',
      location: ['mumbai'],
      company: ['arvind'],
      advanced_keywords: { title: 'Plant Manager' },
    });
  });

  it('should use include objects and role for Sales Navigator people', () => {
    const [query] = mapLinkedinQuerySetToSearchParameters({
      querySet: QUERY_SET,
      mode: 'sales_navigator',
      category: 'people',
    });

    expect(query.searchParameters).toMatchObject({
      location: { include: ['mumbai'] },
      company: { include: ['arvind'] },
      role: { include: ['Plant Manager'] },
    });
  });

  it('should use role keyword objects for Recruiter people', () => {
    const [query] = mapLinkedinQuerySetToSearchParameters({
      querySet: QUERY_SET,
      mode: 'recruiter',
      category: 'people',
    });

    expect(query.searchParameters).toMatchObject({
      role: [{ keywords: 'Plant Manager' }],
      company: [{ keywords: 'arvind' }],
    });
  });

  it('should keep only keywords and location for companies', () => {
    const [query] = mapLinkedinQuerySetToSearchParameters({
      querySet: QUERY_SET,
      mode: 'sales_navigator',
      category: 'companies',
    });

    expect(query.searchParameters).toEqual({
      keywords: 'textile OR fabric',
      location: { include: ['Mumbai'] },
    });
  });

  it('should drop duplicate and empty company searches', () => {
    const queries = mapLinkedinQuerySetToSearchParameters({
      querySet: {
        search_query_set: [
          ...QUERY_SET.search_query_set,
          { ...QUERY_SET.search_query_set[0], job_title: 'Director' },
          {
            keywords: null,
            job_title: 'CEO',
            company: null,
            location: null,
            years_of_experience: null,
          },
        ],
      },
      mode: 'classic',
      category: 'companies',
    });

    expect(queries).toHaveLength(1);
  });
});

describe('splitLinkedinFacetDisplay', () => {
  it('should move display entries out of the payload', () => {
    expect(
      splitLinkedinFacetDisplay({
        location: ['102713980'],
        location_display: [{ id: '102713980', title: 'Mumbai' }],
        industry: undefined,
      }),
    ).toEqual({
      searchParameters: { location: ['102713980'] },
      display: { location: [{ id: '102713980', title: 'Mumbai' }] },
    });
  });
});

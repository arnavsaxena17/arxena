import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { mapLinkedinSearchQueriesToGeneratedParameters } from './linkedin-query-generation-mapper.util';

describe('mapLinkedinSearchQueriesToGeneratedParameters', () => {
  const baseQuerySet: SearchQuerySet = {
    search_query_set: [
      {
        keywords: 'account executive OR sales manager',
        job_title: 'Account Executive',
        company: ['HubSpot', 'Salesforce'],
        location: ['San Francisco Bay Area'],
        years_of_experience: '5-8',
      },
    ],
  };

  it('should map to classic people strategies with normalized arrays', () => {
    const result = mapLinkedinSearchQueriesToGeneratedParameters(
      baseQuerySet,
      'classic',
      'Find mid-market AEs in SF',
    );

    expect(result.classicPeopleSearchStrategies).toBeDefined();
    expect(result.classicPeopleSearchStrategies?.length).toBe(1);

    const [strategy] = result.classicPeopleSearchStrategies ?? [];
    expect(strategy.parameters.keywords).toBe(
      'account executive OR sales manager',
    );
    expect(strategy.parameters.location).toEqual(['san francisco bay area']);
    expect(strategy.parameters.company).toEqual(['hubspot', 'salesforce']);
  });

  it('should map to sales navigator strategies using include objects', () => {
    const result = mapLinkedinSearchQueriesToGeneratedParameters(
      baseQuerySet,
      'sales_navigator',
      'Find mid-market AEs in SF',
    );

    expect(result.salesNavigatorPeopleSearchStrategies).toBeDefined();
    expect(result.salesNavigatorPeopleSearchStrategies?.length).toBe(1);

    const [strategy] = result.salesNavigatorPeopleSearchStrategies ?? [];
    expect(strategy.parameters.location?.include).toEqual([
      'san francisco bay area',
    ]);
    expect(strategy.parameters.company?.include).toEqual([
      'hubspot',
      'salesforce',
    ]);
  });

  it('should map to recruiter strategies with structured location and company filters', () => {
    const result = mapLinkedinSearchQueriesToGeneratedParameters(
      baseQuerySet,
      'recruiter',
      'Find mid-market AEs in SF',
    );

    expect(result.recruiterPeopleSearchStrategies).toBeDefined();
    expect(result.recruiterPeopleSearchStrategies?.length).toBe(1);

    const [strategy] = result.recruiterPeopleSearchStrategies ?? [];
    expect(strategy.parameters.location).toEqual([
      {
        id: 'san francisco bay area',
        priority: 'MUST_HAVE',
        scope: 'CURRENT',
      },
    ]);
    expect(strategy.parameters.company).toEqual([
      { keywords: 'hubspot' },
      { keywords: 'salesforce' },
    ]);
  });
});


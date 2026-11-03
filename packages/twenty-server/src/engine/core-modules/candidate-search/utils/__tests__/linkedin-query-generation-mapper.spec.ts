import { mapLinkedinSearchQueriesToGeneratedParameters } from 'src/engine/core-modules/candidate-search/utils/linkedin-query-generation-mapper.util';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

const querySet = (overrides: Record<string, unknown> = {}): SearchQuerySet => ({
  search_query_set: [
    {
      keywords: 'sales head',
      job_title: null,
      company: ['cipla'],
      location: ['mumbai'],
      years_of_experience: null,
      ...overrides,
    },
  ],
});

describe('mapLinkedinSearchQueriesToGeneratedParameters — carried requirement', () => {
  it('should send company_type as a Sales Navigator facet browse', () => {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet({ company_type: 'public_company' }),
      'sales_navigator',
    );

    const facet = generated.salesNavigatorPeopleSearchStrategies?.find((one) =>
      one.id.endsWith('-facets'),
    );

    expect(facet?.parameters).toMatchObject({
      company_type: ['public_company'],
    });
    // The facet browse is its own search: no keyword or title carrier
    expect(facet?.parameters).not.toHaveProperty('keywords');
    expect(facet?.parameters).not.toHaveProperty('role');
  });

  it('should send excluded companies in the company facet include/exclude pair', () => {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet({ exclude_companies: ['Cipla'] }),
      'sales_navigator',
    );

    expect(
      generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters,
    ).toMatchObject({
      company: { include: ['cipla'], exclude: ['cipla'] },
    });
  });

  it('should send excluded locations in the location facet pair', () => {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet({ exclude_locations: ['Thane'] }),
      'sales_navigator',
    );

    expect(
      generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters,
    ).toMatchObject({
      location: { include: ['mumbai'], exclude: ['thane'] },
    });
  });

  it('should not invent an exclude key when nothing is excluded', () => {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet(),
      'sales_navigator',
    );

    expect(
      generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters,
    ).toMatchObject({ company: { include: ['cipla'] } });
    expect(
      generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters.company,
    ).not.toHaveProperty('exclude');
  });

  it('should express a recruiter exclusion as DOESNT_HAVE', () => {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet({ exclude_companies: ['Cipla'] }),
      'recruiter',
    );

    expect(
      generated.recruiterPeopleSearchStrategies?.[0]?.parameters.company,
    ).toEqual([
      { keywords: 'cipla' },
      { keywords: 'cipla', priority: 'DOESNT_HAVE' },
    ]);
  });

  it('should leave classic alone, since it has no exclude or company-type facet', () => {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet({ exclude_companies: ['Cipla'], company_type: 'public_company' }),
      'classic',
    );

    const parameters =
      generated.classicPeopleSearchStrategies?.[0]?.parameters as Record<
        string,
        unknown
      >;

    expect(parameters).not.toHaveProperty('company_type');
    expect(parameters.company).toEqual(['cipla']);
  });
});

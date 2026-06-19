import { OrgchartLinkedInQueryRouterService } from 'src/engine/core-modules/candidate-search/services/orgchart-linkedin-query-router.service';

describe('OrgchartLinkedInQueryRouterService pre-resolved facets', () => {
  const service = new OrgchartLinkedInQueryRouterService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('builds classic people strategy from pre-resolved company and location ids', async () => {
    const { strategies } = await service.buildOrgchartLinkedInStrategies({
      rawQuery: 'Find people',
      cleanedQuery: 'Find people',
      requirement: 'Find people at Acme',
      searchType: 'classic',
      primaryCompanyName: 'Acme',
      country: '',
      functionRoot: '',
      isAllPeopleInCompanyMode: false,
      apiToken: 'token',
      linkedinCompanyIds: ['1441'],
      linkedinLocationIds: ['102713980'],
      linkedinCompanyDisplay: [{ id: '1441', title: 'Acme Corp' }],
      linkedinLocationDisplay: [{ id: '102713980', title: 'India' }],
    });

    expect(strategies.length).toBeGreaterThan(0);
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.company).toEqual(['1441']);
    expect(parameters.location).toEqual(['102713980']);
    expect(parameters.company_display).toEqual([
      { id: '1441', title: 'Acme Corp' },
    ]);
    expect(parameters.location_display).toEqual([
      { id: '102713980', title: 'India' },
    ]);
  });

  it('builds sales navigator include strategy from pre-resolved facet ids', async () => {
    const { strategies } = await service.buildOrgchartLinkedInStrategies({
      rawQuery: 'Find people',
      cleanedQuery: 'Find people',
      requirement: 'Find people at Acme',
      searchType: 'sales_navigator',
      primaryCompanyName: 'Acme',
      country: '',
      functionRoot: '',
      isAllPeopleInCompanyMode: false,
      apiToken: 'token',
      linkedinCompanyIds: ['1441'],
      linkedinLocationIds: ['102713980'],
    });

    expect(strategies.length).toBeGreaterThan(0);
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.company).toEqual({ include: ['1441'] });
    expect(parameters.location).toEqual({ include: ['102713980'] });
  });
});

import { OrgchartLinkedInQueryRouterService } from 'src/engine/core-modules/candidate-search/services/orgchart-linkedin-query-router.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';

describe('OrgchartLinkedInQueryRouterService pre-resolved facets', () => {
  const pythonQueryGenerationService = {
    generateSearchParameters: jest.fn(),
  } as unknown as jest.Mocked<PythonQueryGenerationService>;

  const service = new OrgchartLinkedInQueryRouterService(
    {} as never,
    pythonQueryGenerationService,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('includes function-root keywords on pre-resolved sales navigator strategy', async () => {
    pythonQueryGenerationService.generateSearchParameters.mockResolvedValue({
      salesNavigatorPeopleSearchStrategies: [
        {
          id: 'linkedin-query-sales-nav-1',
          label: 'Sales',
          description: 'Sales',
          strategyText: 'Sales',
          originalUserQuery: 'Find people at Acme',
          clarificationQuestions: null,
          clarificationAnswers: null,
          parameters: {
            keywords: 'sales OR business development',
          },
        },
      ],
    } as never);

    const { strategies } = await service.buildOrgchartLinkedInStrategies({
      rawQuery: 'Find people',
      cleanedQuery: 'Find people',
      requirement: 'Find people at Acme',
      searchType: 'sales_navigator',
      primaryCompanyName: 'Acme',
      country: '',
      functionRoot: 'sales',
      isAllPeopleInCompanyMode: false,
      apiToken: 'token',
      linkedinCompanyIds: ['1441'],
    });

    expect(pythonQueryGenerationService.generateSearchParameters).toHaveBeenCalledWith(
      {
        function_root: [{ name: 'sales', exclude: false }],
        company_names: ['Acme'],
      },
      'sales_navigator',
      'Find people at Acme',
    );
    expect(strategies.length).toBeGreaterThan(0);
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.company).toEqual({ include: ['1441'] });
    expect(parameters.keywords).toBe('sales OR business development');
  });

  it('uses pre-computed linkedinKeywords without calling Python', async () => {
    const { strategies } = await service.buildOrgchartLinkedInStrategies({
      rawQuery: 'Find people',
      cleanedQuery: 'Find people',
      requirement: 'Find people at Acme',
      searchType: 'sales_navigator',
      primaryCompanyName: 'Acme',
      country: '',
      functionRoot: 'sales',
      isAllPeopleInCompanyMode: false,
      apiToken: 'token',
      linkedinCompanyIds: ['1441'],
      linkedinKeywords: 'marketing OR brand',
    });

    expect(pythonQueryGenerationService.generateSearchParameters).not.toHaveBeenCalled();
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.keywords).toBe('marketing OR brand');
  });
});

import { OrgchartLinkedInQueryRouterService } from 'src/engine/core-modules/candidate-search/services/orgchart-linkedin-query-router.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';

describe('OrgchartLinkedInQueryRouterService pre-resolved facets', () => {
  const pythonQueryGenerationService = {
    generateSearchParameters: jest.fn(),
  } as unknown as jest.Mocked<PythonQueryGenerationService>;
  const titleTaxonomyRemoteService = {
    getManualBooleanQueries: jest.fn().mockResolvedValue(null),
  };

  const service = new OrgchartLinkedInQueryRouterService(
    {} as never,
    pythonQueryGenerationService,
    {} as never,
    {} as never,
    titleTaxonomyRemoteService as never,
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

  it('includes function-root title boolean on pre-resolved sales navigator role.include', async () => {
    titleTaxonomyRemoteService.getManualBooleanQueries.mockResolvedValue({
      items: [
        {
          kind: 'std_function_root',
          label: 'sales',
          std_grade: 'entry',
          boolean_query: 'entry should not win',
          keywords: 'entry should not win',
        },
        {
          kind: 'std_function_root',
          label: 'sales',
          std_grade: '',
          boolean_query: '(sales OR "business development")',
          keywords: '(sales OR "business development")',
        },
      ],
    });

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

    expect(titleTaxonomyRemoteService.getManualBooleanQueries).toHaveBeenCalledWith({
      kind: 'std_function_root',
      label: 'sales',
      stdGrade: '',
    });
    expect(pythonQueryGenerationService.generateSearchParameters).not.toHaveBeenCalled();
    expect(strategies.length).toBeGreaterThan(0);
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.company).toEqual({ include: ['1441'] });
    expect(parameters.role).toEqual({
      include: ['(sales OR "business development")'],
    });
    expect(parameters.keywords).toBeUndefined();
  });

  it('uses pre-computed linkedinJobTitle on role without calling Python', async () => {
    const { strategies } = await service.buildOrgchartLinkedInStrategies({
      rawQuery: 'Find people',
      cleanedQuery: 'Find people',
      requirement: 'Find people at Acme',
      searchType: 'sales_navigator',
      primaryCompanyName: 'Acme',
      country: '',
      functionRoot: 'technology',
      isAllPeopleInCompanyMode: false,
      apiToken: 'token',
      linkedinCompanyIds: ['1441'],
      linkedinJobTitle:
        '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
    });

    expect(pythonQueryGenerationService.generateSearchParameters).not.toHaveBeenCalled();
    expect(titleTaxonomyRemoteService.getManualBooleanQueries).not.toHaveBeenCalled();
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.role).toEqual({
      include: [
        '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
      ],
    });
    expect(parameters.keywords).toBeUndefined();
  });

  it('remaps legacy linkedinKeywords onto role for sales_navigator function root', async () => {
    titleTaxonomyRemoteService.getManualBooleanQueries.mockResolvedValue({
      items: [
        {
          kind: 'std_function_root',
          label: 'technology',
          std_grade: '',
          boolean_query:
            '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
          keywords:
            '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
        },
      ],
    });

    const { strategies } = await service.buildOrgchartLinkedInStrategies({
      rawQuery: 'Find people',
      cleanedQuery: 'Find people',
      requirement: 'Find people at Acme',
      searchType: 'sales_navigator',
      primaryCompanyName: 'Acme',
      country: '',
      functionRoot: 'technology',
      isAllPeopleInCompanyMode: false,
      apiToken: 'token',
      linkedinCompanyIds: ['1441'],
      linkedinKeywords: 'development OR technical OR software OR it OR technology OR data',
    });

    expect(pythonQueryGenerationService.generateSearchParameters).not.toHaveBeenCalled();
    const parameters = strategies[0]?.parameters as Record<string, unknown>;
    expect(parameters.role).toEqual({
      include: [
        '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
      ],
    });
    expect(parameters.keywords).toBeUndefined();
  });});

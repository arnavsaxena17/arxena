/**
 * Requirement text → unresolved params: multi-agent vs Python query generator.
 */
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../../utils/linkedin-query-generation-mapper.util';
import { CandidateSearchHandlerService } from '../candidate-search-handler.service';

const API_TOKEN = 'test-token';
const MUMBAI_CTO_QUERY =
  'Get me CTOs of tech companies engaged in HR products in Mumbai';

describe('CandidateSearchHandlerService.generateUnresolvedSearchParams (requirement)', () => {
  let workspaceQueryService: {
    getWorkspaceIdFromToken: jest.Mock;
    initializeLLMClients: jest.Mock;
  };
  let requirementAnalyzerService: { analyzeRequirement: jest.Mock };
  let searchIntentRouterService: { routeIntent: jest.Mock };
  let linkedinQueryGenerationService: { generateSearchQuerySet: jest.Mock };
  let pythonQueryGenerationService: { generateSearchParameters: jest.Mock };
  let service: CandidateSearchHandlerService;

  beforeEach(() => {
    workspaceQueryService = {
      getWorkspaceIdFromToken: jest.fn().mockResolvedValue('ws-1'),
      initializeLLMClients: jest
        .fn()
        .mockResolvedValue({ openAIclient: {} }),
    };
    requirementAnalyzerService = {
      analyzeRequirement: jest.fn().mockResolvedValue({
        primary_role_name: 'Chief Technology Officer',
        industry: 'Human resources technology',
        location: 'Mumbai',
        experience_range: null,
        age_range: null,
        salary_range: null,
        company_type: 'Technology product companies',
        requires_job_title_expansion: true,
        requires_company_targeting: true,
      }),
    };
    searchIntentRouterService = {
      routeIntent: jest.fn().mockResolvedValue({
        intent: 'open_market',
        primary_employer_name: null,
      }),
    };
    linkedinQueryGenerationService = {
      generateSearchQuerySet: jest.fn(),
    };
    pythonQueryGenerationService = {
      generateSearchParameters: jest.fn(),
    };
    service = new CandidateSearchHandlerService(
      {} as never,
      {} as never,
      {} as never,
      workspaceQueryService as never,
      {} as never,
      { getJDContentFromJobAttachments: jest.fn() } as never,
      {} as never,
      requirementAnalyzerService as never,
      searchIntentRouterService as never,
      linkedinQueryGenerationService as never,
      pythonQueryGenerationService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('queryGenerator python: calls Python service and not LinkedIn orchestrator', async () => {
    const qs: SearchQuerySet = {
      search_query_set: [
        {
          keywords: 'cto technology',
          job_title: 'CTO',
          company: [],
          location: ['Mumbai'],
          years_of_experience: null,
        },
      ],
    };
    pythonQueryGenerationService.generateSearchParameters.mockResolvedValue(
      mapLinkedinSearchQueriesToGeneratedParameters(
        qs,
        'classic',
        MUMBAI_CTO_QUERY,
      ),
    );

    const result = await service.generateUnresolvedSearchParams(
      MUMBAI_CTO_QUERY,
      MUMBAI_CTO_QUERY,
      'classic',
      'people',
      API_TOKEN,
      MUMBAI_CTO_QUERY,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      { queryGenerator: 'python' },
    );

    expect(searchIntentRouterService.routeIntent).toHaveBeenCalled();
    expect(requirementAnalyzerService.analyzeRequirement).toHaveBeenCalled();
    expect(pythonQueryGenerationService.generateSearchParameters).toHaveBeenCalled();
    expect(
      linkedinQueryGenerationService.generateSearchQuerySet,
    ).not.toHaveBeenCalled();
    const pyCall = pythonQueryGenerationService.generateSearchParameters.mock
      .calls[0];
    expect(pyCall[0]).toMatchObject({
      company_names: [],
      raw_job_titles: ['Chief Technology Officer'],
    });
    expect(
      result.classicPeopleSearchStrategies?.length ??
        (result.classicPeopleSearch ? 1 : 0),
    ).toBeGreaterThan(0);
    console.log(
      '[requirement-unresolved-test] python path strategies:',
      result.classicPeopleSearchStrategies?.length ?? 0,
    );
  });

  it('queryGenerator multi_agent: calls LinkedIn orchestrator, not Python generator', async () => {
    const qs: SearchQuerySet = {
      search_query_set: [
        {
          keywords: 'CTO HR tech Mumbai',
          job_title: null,
          company: [],
          location: null,
          years_of_experience: null,
        },
      ],
    };
    linkedinQueryGenerationService.generateSearchQuerySet.mockResolvedValue({
      final_query_set: qs,
    });

    const result = await service.generateUnresolvedSearchParams(
      MUMBAI_CTO_QUERY,
      MUMBAI_CTO_QUERY,
      'classic',
      'people',
      API_TOKEN,
      MUMBAI_CTO_QUERY,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      { queryGenerator: 'multi_agent' },
    );

    expect(
      linkedinQueryGenerationService.generateSearchQuerySet,
    ).toHaveBeenCalled();
    expect(
      pythonQueryGenerationService.generateSearchParameters,
    ).not.toHaveBeenCalled();
    expect(
      result.classicPeopleSearchStrategies?.length ??
        (result.classicPeopleSearch ? 1 : 0),
    ).toBeGreaterThan(0);
    console.log(
      '[requirement-unresolved-test] multi_agent path strategies:',
      result.classicPeopleSearchStrategies?.length ?? 0,
    );
  });
});

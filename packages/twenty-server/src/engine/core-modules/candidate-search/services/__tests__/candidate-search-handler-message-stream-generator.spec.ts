/**
 * Ensures message/stream unresolved generation dispatches Python vs multi-agent
 * without running the full Nest graph.
 */
import { CandidateSearchHandlerService } from '../candidate-search-handler.service';

const minimalParsedJd = {
  jobTitle: '',
  company: '',
  location: '',
  industry: '',
  requiredSkills: [],
  preferredSkills: [],
  experienceLevel: 'mid_level' as const,
  education: [],
  keywords: [],
  responsibilities: [],
  qualifications: [],
  benefits: [],
  employmentType: 'full_time' as const,
  remoteWork: false,
  salaryRange: null,
};

const createService = () =>
  new CandidateSearchHandlerService(
    {
      getAssistantThreadContext: jest.fn().mockResolvedValue({
        projectId: 'job-1',
        assistantParameters: {},
        messages: [],
      }),
    } as never,
    { getLinkedInAccountId: jest.fn().mockResolvedValue('acc-1') } as never,
    {} as never,
    {
      getWorkspaceIdFromToken: jest.fn().mockResolvedValue('ws'),
      initializeLLMClients: jest.fn().mockResolvedValue({ openAIclient: {} }),
    } as never,
    {} as never,
    { getJDContentFromJobAttachments: jest.fn() } as never,
    {} as never,
    {} as never,
    {
      routeIntent: jest
        .fn()
        .mockResolvedValue({ intent: 'open_market', primary_employer_name: null }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      buildAndSendResponse: jest.fn().mockReturnValue({
        success: true,
        type: 'search_parameters',
        chatMessage: 'ok',
      }),
    } as never,
    {
      extractStrategiesFromGeneratedParams: jest.fn().mockReturnValue([]),
      executeStrategySearches: jest
        .fn()
        .mockResolvedValue([{ strategy: { id: 'x' }, result: null }]),
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );

describe('CandidateSearchHandlerService message/stream generator dispatch', () => {
  it('python branch calls generateUnresolvedSearchParams and not LinkedIn orchestrator', async () => {
    const service = createService();
    const preUnresolved = {
      classicPeopleSearchStrategies: [{ id: 's1' }],
    };
    const generateUnresolvedSearchParams = jest
      .spyOn(service, 'generateUnresolvedSearchParams')
      .mockResolvedValue(preUnresolved as never);
    const generateUnresolvedSearchParametersFromLinkedinQueryGeneration = jest
      .spyOn(
        service,
        'generateUnresolvedSearchParametersFromLinkedinQueryGeneration',
      )
      .mockResolvedValue({} as never);
    const generateAndExecuteSearchParameters = jest
      .spyOn(
        service as unknown as {
          generateAndExecuteSearchParameters: () => Promise<{
            unresolvedSearchParams: typeof preUnresolved;
            resolvedParams: Record<string, unknown>;
            strategyResults: unknown[];
          }>;
        },
        'generateAndExecuteSearchParameters',
      )
      .mockResolvedValue({
        unresolvedSearchParams: preUnresolved,
        resolvedParams: {},
        strategyResults: [],
      });

    await service.handleSearchParametersAndResultsGenerationStream(
      'raw',
      'clean',
      'thread-1',
      minimalParsedJd,
      'classic',
      'people',
      'token',
      'user message',
      undefined,
      true,
      false,
      undefined,
      { linkedinQueryGenerator: 'python' },
    );

    expect(generateUnresolvedSearchParams).toHaveBeenCalled();
    expect(
      generateUnresolvedSearchParametersFromLinkedinQueryGeneration,
    ).not.toHaveBeenCalled();
    expect(generateAndExecuteSearchParameters).toHaveBeenCalled();
    console.log(
      '[message-stream-generator-spec] python branch: orchestrator not used',
    );
  });

  it('multi_agent branch calls LinkedIn orchestrator, not python-only unresolved', async () => {
    const service = createService();
    const preUnresolved = {
      classicPeopleSearchStrategies: [{ id: 's1' }],
    };
    const generateUnresolvedSearchParams = jest
      .spyOn(service, 'generateUnresolvedSearchParams')
      .mockResolvedValue({} as never);
    const generateUnresolvedSearchParametersFromLinkedinQueryGeneration = jest
      .spyOn(
        service,
        'generateUnresolvedSearchParametersFromLinkedinQueryGeneration',
      )
      .mockResolvedValue(preUnresolved as never);
    const generateAndExecuteSearchParameters = jest
      .spyOn(
        service as unknown as {
          generateAndExecuteSearchParameters: () => Promise<{
            unresolvedSearchParams: typeof preUnresolved;
            resolvedParams: Record<string, unknown>;
            strategyResults: unknown[];
          }>;
        },
        'generateAndExecuteSearchParameters',
      )
      .mockResolvedValue({
        unresolvedSearchParams: preUnresolved,
        resolvedParams: {},
        strategyResults: [],
      });

    await service.handleSearchParametersAndResultsGenerationStream(
      'raw',
      'clean',
      'thread-1',
      minimalParsedJd,
      'classic',
      'people',
      'token',
      'user message',
      undefined,
      true,
      false,
      undefined,
      { linkedinQueryGenerator: 'multi_agent' },
    );

    expect(
      generateUnresolvedSearchParametersFromLinkedinQueryGeneration,
    ).toHaveBeenCalled();
    expect(generateUnresolvedSearchParams).not.toHaveBeenCalled();
    expect(generateAndExecuteSearchParameters).toHaveBeenCalled();
    console.log(
      '[message-stream-generator-spec] multi_agent branch: python-only unresolved not used',
    );
  });
});

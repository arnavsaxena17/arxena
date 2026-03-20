jest.mock(
  'src/engine/core-modules/candidate-search/services/candidate-search-handler.service',
  () => ({
    CandidateSearchHandlerService: class CandidateSearchHandlerService {},
  }),
);

jest.mock(
  'src/engine/core-modules/linkedin-query-generation/services/iterative-linkedin-query-generation.service',
  () => ({
    IterativeLinkedinQueryGenerationService:
      class IterativeLinkedinQueryGenerationService {},
  }),
);

import { McpInProcessToolRunnerService } from '../mcp-in-process-tool-runner.service';

describe('McpInProcessToolRunnerService', () => {
  it('runs generate_iterative_linkedin_query_set in process', async () => {
    const candidateSearchHandlerService = {} as any;
    const iterativeLinkedinQueryGenerationService = {
      generateIterativeSearchQuerySet: jest.fn().mockResolvedValue({
        final_query_set: {
          search_query_set: [
            {
              keywords: 'revops OR sales operations',
              job_title: null,
              company: null,
              location: ['Mumbai'],
              years_of_experience: null,
            },
          ],
        },
        ranked_alternatives: [],
        iterations: [],
        verification_summary: {
          mode: 'offline',
          final_score: 0.8,
          termination_reason: 'good_enough',
          live_preview_used: false,
        },
      }),
    };
    const toolCallCache = {
      buildKey: jest.fn().mockReturnValue('cache-key'),
      getCachedToolResult: jest.fn().mockReturnValue(null),
      cacheToolResult: jest.fn(),
    };
    const assistantThreadService = {
      getThread: jest.fn().mockResolvedValue({
        assistantParameters: { iterativeQueryState: { progressLog: [] } },
      }),
      mergeAssistantParameters: jest.fn().mockResolvedValue({}),
      appendIterativeProgressLog: jest.fn().mockResolvedValue(undefined),
    };

    const service = new McpInProcessToolRunnerService(
      candidateSearchHandlerService,
      iterativeLinkedinQueryGenerationService as any,
      assistantThreadService as any,
      toolCallCache as any,
    );

    const result = await service.runStreamingToolInProcess(
      'generate_iterative_linkedin_query_set',
      {
        rawRequirement: 'Find revenue operations leaders in Mumbai',
        mode: 'offline',
        searchType: 'classic',
        assistantThreadId: 'thread-1',
      },
      'api-token',
      jest.fn().mockReturnValue(true),
    );

    expect(
      iterativeLinkedinQueryGenerationService.generateIterativeSearchQuerySet,
    ).toHaveBeenCalledWith('Find revenue operations leaders in Mumbai', {
      mode: 'offline',
      searchType: 'classic',
      queryIpLocation: undefined,
      maxIterations: 1,
      returnAlternatives: false,
      verbose: undefined,
      model: undefined,
      temperature: undefined,
      apiToken: 'api-token',
      onProgress: expect.any(Function),
    });
    expect(result).toContain('"final_query_set"');
    expect(toolCallCache.cacheToolResult).toHaveBeenCalled();
    expect(assistantThreadService.mergeAssistantParameters).toHaveBeenCalledWith(
      'api-token',
      'thread-1',
      expect.objectContaining({
        iterativeQueryState: expect.objectContaining({
          baseRequirement: 'Find revenue operations leaders in Mumbai',
          effectiveRequirement: 'Find revenue operations leaders in Mumbai',
        }),
      }),
    );
    expect(assistantThreadService.appendIterativeProgressLog).toHaveBeenCalled();
  });
});

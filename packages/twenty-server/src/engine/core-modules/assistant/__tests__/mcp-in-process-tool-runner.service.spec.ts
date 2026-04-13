jest.mock(
  'src/engine/core-modules/candidate-search/services/candidate-search-handler.service',
  () => ({
    CandidateSearchHandlerService: class CandidateSearchHandlerService {},
  }),
);

import { McpInProcessToolRunnerService } from '../mcp-in-process-tool-runner.service';

describe('McpInProcessToolRunnerService', () => {
  it('runs generate_search_parameters in process', async () => {
    const unresolved = {
      searchParameters: { foo: 'bar' },
      searchStrategies: [],
    };
    const candidateSearchHandlerService = {
      generateUnresolvedSearchParametersFromLinkedinQueryGeneration: jest
        .fn()
        .mockResolvedValue(unresolved),
    };
    const toolCallCache = {
      buildKey: jest.fn().mockReturnValue('cache-key'),
      getCachedToolResult: jest.fn().mockReturnValue(null),
      cacheToolResult: jest.fn(),
    };

    const service = new McpInProcessToolRunnerService(
      candidateSearchHandlerService as never,
      toolCallCache as never,
    );

    const result = await service.runStreamingToolInProcess(
      'generate_search_parameters',
      {
        prompt: 'Senior engineer in Berlin',
        searchType: 'classic',
        searchCategory: 'people',
      },
      'api-token',
      jest.fn().mockReturnValue(true),
    );

    expect(
      candidateSearchHandlerService.generateUnresolvedSearchParametersFromLinkedinQueryGeneration,
    ).toHaveBeenCalledWith(
      'Senior engineer in Berlin',
      'classic',
      expect.any(Function),
    );
    expect(result).toContain('"foo":"bar"');
    expect(toolCallCache.cacheToolResult).toHaveBeenCalled();
  });
});

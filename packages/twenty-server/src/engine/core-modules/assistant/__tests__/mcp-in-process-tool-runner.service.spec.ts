jest.mock(
  'src/domains/planning/candidate-search/services/candidate-search-handler.service',
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
      generateUnresolvedSearchParams: jest.fn().mockResolvedValue(unresolved),
    };
    const toolCallCache = {
      buildKey: jest.fn().mockReturnValue('cache-key'),
      getCachedToolResult: jest.fn().mockResolvedValue(null),
      cacheToolResult: jest.fn().mockResolvedValue(undefined),
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
      candidateSearchHandlerService.generateUnresolvedSearchParams,
    ).toHaveBeenCalledWith(
      'Senior engineer in Berlin',
      'Senior engineer in Berlin',
      'classic',
      'people',
      'api-token',
      'Senior engineer in Berlin',
      undefined,
      undefined,
      expect.any(Function),
      false,
    );
    expect(result).toContain('"foo":"bar"');
    expect(toolCallCache.cacheToolResult).toHaveBeenCalled();
  });
});

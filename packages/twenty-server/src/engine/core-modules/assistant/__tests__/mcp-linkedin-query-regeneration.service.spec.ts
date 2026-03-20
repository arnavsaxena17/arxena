jest.mock(
  'src/engine/core-modules/linkedin-query-generation/services/iterative-linkedin-query-generation.service',
  () => ({
    IterativeLinkedinQueryGenerationService:
      class IterativeLinkedinQueryGenerationService {},
  }),
);

import { McpLinkedinQueryRegenerationService } from '../mcp-linkedin-query-regeneration.service';

describe('McpLinkedinQueryRegenerationService', () => {
  it('uses the iterative linkedin query generator when steering requires regeneration', async () => {
    const assistantThreadService = {
      getThread: jest.fn().mockResolvedValue({
        id: 'thread-1',
        searchType: 'classic',
        messages: [
          {
            role: 'user',
            content: 'Find revenue operations leaders in Mumbai',
          },
        ],
        assistantParameters: {
          iterativeQueryState: {
            baseRequirement: 'Find revenue operations leaders in Mumbai',
            steeringHistory: [
              {
                message: 'Broaden into GTM operations and avoid title keyword overlap',
                createdAt: '2026-03-20T00:00:00.000Z',
              },
            ],
            needsRegeneration: true,
          },
        },
      }),
      mergeAssistantParameters: jest.fn().mockResolvedValue(undefined),
      setThreadSearchStrategy: jest.fn().mockResolvedValue(undefined),
      appendIterativeProgressLog: jest.fn().mockResolvedValue(undefined),
    };
    const iterativeLinkedinQueryGenerationService = {
      generateIterativeSearchQuerySet: jest.fn().mockResolvedValue({
        final_query_set: {
          search_query_set: [
            {
              keywords: 'revenue operations OR sales operations',
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

    const service = new McpLinkedinQueryRegenerationService(
      assistantThreadService as any,
      iterativeLinkedinQueryGenerationService as any,
    );

    const result = await service.maybeRegenerateLinkedinQuerySet(
      {} as any,
      'api-token',
      jest.fn().mockReturnValue(true),
      'thread-1',
      'search_linkedin_parameters',
      'classic',
    );

    expect(
      iterativeLinkedinQueryGenerationService.generateIterativeSearchQuerySet,
    ).toHaveBeenCalledWith(
      'Base requirement: Find revenue operations leaders in Mumbai\n\nUser steering updates:\n1. Broaden into GTM operations and avoid title keyword overlap',
      {
        apiToken: 'api-token',
        maxIterations: 1,
        mode: 'offline',
        searchType: 'classic',
        returnAlternatives: false,
        onProgress: expect.any(Function),
      },
    );
    expect(result).toContain('regenerated query set');
    expect(assistantThreadService.mergeAssistantParameters).toHaveBeenCalled();
    expect(assistantThreadService.setThreadSearchStrategy).toHaveBeenCalled();
  });
});

import { BrightDataLudicrousPlannerService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-planner.service';

const PLAN = {
  intentSummary: 'QSR chains in India',
  relevanceCriteria: 'A quick service restaurant chain',
  needsSemanticCheck: false,
  rubric: {
    titleIncludePatterns: [],
    titleExcludePatterns: [],
    industryIncludePatterns: [],
    countryCodes: ['IN'],
    companySizeFromBuckets: [],
  },
  shards: [
    {
      key: 'qsr_in',
      rationale: 'all',
      priority: 1,
      filter: {
        titles: [],
        excludeTitleWords: [],
        booleanTitleExpression: '',
        companyNames: [],
        skills: [],
        countryCodes: ['IN'],
        cities: [],
        industries: [],
        organizationTypes: [],
        fundingStages: [],
        sizeBuckets: [],
        foundedFrom: null,
        foundedTo: null,
        specialtiesAny: ['quick service restaurant'],
      },
    },
  ],
};

const buildService = (generateObject: jest.Mock) => {
  const registry = {
    getDefaultSpeedModel: () => ({ modelId: 'fast-model' }),
    getDefaultPerformanceModel: () => ({ modelId: 'smart-model' }),
    getRecommendedModelIds: () => new Set(['fast-model', 'other-model']),
    getModel: () => ({}),
    resolveModelForAgentInWorkspace: jest.fn(async ({ modelId }) => ({
      modelId,
      model: { id: modelId },
    })),
  };
  const service = new BrightDataLudicrousPlannerService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    registry as never,
    { generateObject } as never,
  );

  return { service, registry };
};

const input = {
  workspaceId: 'workspace-1',
  entity: 'company' as const,
  rawQuery: 'QSR chains in India',
};

describe('BrightDataLudicrousPlannerService model fallback', () => {
  it('should retry with the next model when the first one fails', async () => {
    const generateObject = jest
      .fn()
      .mockRejectedValueOnce(new Error('This operation was aborted'))
      .mockResolvedValueOnce({ object: PLAN });
    const { service } = buildService(generateObject);

    const result = await (
      service as unknown as {
        generateShards: (value: typeof input) => Promise<typeof PLAN>;
      }
    ).generateShards(input);

    expect(result.shards).toHaveLength(1);
    expect(generateObject.mock.calls.map((call) => call[0].modelId)).toEqual([
      'fast-model',
      'smart-model',
    ]);
  });

  it('should throw the last error when every model fails', async () => {
    const generateObject = jest
      .fn()
      .mockRejectedValue(new Error('No object generated'));
    const { service } = buildService(generateObject);

    await expect(
      (
        service as unknown as {
          generateShards: (value: typeof input) => Promise<unknown>;
        }
      ).generateShards(input),
    ).rejects.toThrow('No object generated');
    expect(generateObject).toHaveBeenCalledTimes(3);
  });
});

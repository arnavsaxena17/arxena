import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';

const plan = {
  projectId: 'project-1',
  workspaceId: 'workspace-1',
  entity: 'company',
  rawQuery: 'qsr restaurants in mumbai',
  intentSummary: 'QSR restaurants in Mumbai',
  relevanceCriteria: 'A restaurant or food service business',
  needsSemanticCheck: true,
  rubric: {
    titleIncludePatterns: [],
    titleExcludePatterns: [],
    industryIncludePatterns: [],
    countryCodes: ['IN'],
    companySizeFromBuckets: [],
  },
  shards: [],
  estimates: [],
  sampleDocuments: {
    restaurants: [
      {
        brightId: 'c-1',
        data: { name: 'Pancake House', industry: 'Restaurants' },
        relevant: true,
        shardKey: 'restaurants',
      },
    ],
    manufacturing: [
      {
        brightId: 'c-2',
        data: {
          name: 'Pancake Factory',
          industry: 'Food and Beverage Manufacturing',
        },
        relevant: false,
        shardKey: 'manufacturing',
      },
    ],
  },
  fields: ['name', 'industry'],
  totalFetchableRecords: 40,
  estimatedUniqueRecords: 40,
  estimatedAccurateRecords: 30,
  totalEstimatedCostUsd: 0.08,
  estimateCostUsd: 0.02,
  createdAt: '2026-10-30T00:00:00.000Z',
};

const summary = {
  projectId: 'project-1',
  entity: 'company',
  intentSummary: 'QSR restaurants in Mumbai',
  shards: [
    {
      key: 'restaurants',
      rationale: 'canonical label',
      matched: 30,
      coveragePercent: 100,
      fetchableRecords: 30,
      estimatedCostUsd: 0.06,
      samplePrecision: 1,
    },
    {
      key: 'manufacturing',
      rationale: 'producer label',
      matched: 10,
      coveragePercent: 100,
      fetchableRecords: 10,
      estimatedCostUsd: 0.02,
      samplePrecision: 0,
    },
  ],
  totalFetchableRecords: 40,
  estimatedUniqueRecords: 40,
  estimatedAccurateRecords: 30,
  estimatedCostUsd: 0.08,
  estimateCostUsd: 0.02,
  maxBudgetUsd: 10,
  budgetOptions: [],
  message: 'About 40 companies',
};

const buildTool = () => {
  const ludicrous = {
    estimate: jest.fn(async () => summary),
    getPlan: jest.fn(async () => plan),
    loadDataset: jest.fn(async () => undefined),
    executePlan: jest.fn(),
    searchNaturalLanguage: jest.fn(),
  };
  const upsertCompanies = {
    execute: jest.fn(async () => ({
      success: true,
      result: {
        writtenRowIds: ['row-1', 'row-2'],
        createdCount: 2,
        updatedCount: 0,
      },
    })),
  };
  const tool = new SearchBrightDataBusinessTool(
    {} as never,
    ludicrous as never,
    upsertCompanies as never,
    { execute: jest.fn() } as never,
  );

  return { tool, ludicrous, upsertCompanies };
};

describe('SearchBrightDataBusinessTool ludicrous estimate', () => {
  it('should write every sampled slice to the tab as a probe row', async () => {
    const { tool, upsertCompanies, ludicrous } = buildTool();

    const output = await tool.execute(
      { entity: 'company', query: 'qsr restaurants in mumbai' },
      { workspaceId: 'workspace-1', projectId: 'project-1' },
    );

    expect(ludicrous.estimate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        entity: 'company',
      }),
    );
    expect(ludicrous.getPlan).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      entity: 'company',
    });
    // Both slices are persisted, including the one the judge rejected: the
    // point of a probe is to inspect a hypothesis before funding it.
    expect(upsertCompanies.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        companies: [
          expect.objectContaining({
            name: 'Pancake House',
            otherFields: expect.objectContaining({
              probe: true,
              shardKey: 'restaurants',
              relevant: true,
            }),
          }),
          expect.objectContaining({
            name: 'Pancake Factory',
            otherFields: expect.objectContaining({
              probe: true,
              shardKey: 'manufacturing',
              relevant: false,
            }),
          }),
        ],
      }),
      expect.anything(),
    );
    expect(output.result).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        awaitingConfirmation: true,
        probeRowsWritten: 2,
        probeRowsTotal: 2,
      }),
    );
    expect(output.result).not.toHaveProperty('listId');
  });

  it('should still return the estimate when the probe write fails', async () => {
    const { tool, ludicrous } = buildTool();
    ludicrous.getPlan.mockRejectedValue(new Error('plan expired'));

    const output = await tool.execute(
      { entity: 'company', query: 'qsr restaurants in mumbai' },
      { workspaceId: 'workspace-1', projectId: 'project-1' },
    );

    expect(output.success).toBe(true);
    expect(output.result).toEqual(
      expect.objectContaining({ projectId: 'project-1', probeRowsWritten: 0 }),
    );
  });
});

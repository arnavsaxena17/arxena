import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';

const run = {
  projectId: 'project-1',
  entity: 'company',
  documents: [
    {
      brightId: 'id-1',
      data: { name: 'Company 1', website: 'https://c1.example.com' },
    },
  ],
  fetchedDocuments: [
    {
      brightId: 'id-1',
      data: { name: 'Company 1', website: 'https://c1.example.com' },
      relevant: true,
    },
  ],
  spentUsd: 0.002,
  budgetUsd: 1,
  shardReports: [],
};

const buildTool = () => {
  const upsertCompanies = {
    execute: jest.fn(async () => ({
      success: true,
      result: { writtenRowIds: ['row-1'], createdCount: 1, updatedCount: 0 },
    })),
  };
  const ludicrous = {
    loadDataset: jest.fn(async () => undefined),
    executePlan: jest.fn(async () => run),
    estimate: jest.fn(),
    getPlan: jest.fn(),
    searchNaturalLanguage: jest.fn(),
  };
  const tool = new SearchBrightDataBusinessTool(
    {} as never,
    ludicrous as never,
    upsertCompanies as never,
    { execute: jest.fn() } as never,
  );

  return { tool, upsertCompanies, ludicrous };
};

describe('SearchBrightDataBusinessTool project from context', () => {
  const fetch = {
    entity: 'company',
    query: 'qsr',
    execute: true,
    maxBudgetUsd: 1,
  };

  it('should fetch the project active plan and write its tab', async () => {
    const { tool, upsertCompanies, ludicrous } = buildTool();

    const output = await tool.execute(fetch, {
      workspaceId: 'workspace-1',
      projectId: 'project-1',
    });

    expect(ludicrous.loadDataset).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      entity: 'company',
    });
    expect(ludicrous.executePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        entity: 'company',
        maxBudgetUsd: 1,
      }),
    );
    expect(upsertCompanies.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
      expect.anything(),
    );
    expect(output.result).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        ephemeralWritten: 1,
        count: 1,
      }),
    );
  });

  it('should reuse already-paid rows instead of fetching again', async () => {
    const { tool, ludicrous } = buildTool();
    ludicrous.loadDataset.mockResolvedValue(run as never);

    const output = await tool.execute(fetch, {
      workspaceId: 'workspace-1',
      projectId: 'project-1',
    });

    expect(ludicrous.executePlan).not.toHaveBeenCalled();
    expect(output.result).toEqual(
      expect.objectContaining({ reused: true, spentUsd: 0 }),
    );
  });

  it('should refuse to search without a project', async () => {
    const { tool, upsertCompanies, ludicrous } = buildTool();

    const output = await tool.execute(fetch, { workspaceId: 'workspace-1' });

    expect(output.success).toBe(false);
    expect(output.error).toContain('projectId is required');
    expect(upsertCompanies.execute).not.toHaveBeenCalled();
    expect(ludicrous.executePlan).not.toHaveBeenCalled();
  });
});

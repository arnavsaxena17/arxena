import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';

const run = {
  listId: 'list-1',
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
  };
  const listMeta = { projectIds: [] as string[] };
  const outreachList = {
    ingest: jest.fn(async () => ({
      name: 'Bright Data companies: qsr',
      added: 1,
      duplicates: 0,
      total: 1,
    })),
    update: jest.fn(
      async (
        _workspaceId: string,
        _listId: string,
        change: (document: { meta: typeof listMeta }) => void,
      ) => change({ meta: listMeta }),
    ),
  };
  const tool = new SearchBrightDataBusinessTool(
    {} as never,
    ludicrous as never,
    upsertCompanies as never,
    { execute: jest.fn() } as never,
    outreachList as never,
  );

  return { tool, upsertCompanies, listMeta };
};

describe('SearchBrightDataBusinessTool project from context', () => {
  const fetch = {
    entity: 'company',
    query: 'qsr',
    listId: 'list-1',
    maxBudgetUsd: 1,
  };

  it('should write the browsing-context project when the model omits projectId', async () => {
    const { tool, upsertCompanies } = buildTool();

    const output = await tool.execute(fetch, {
      workspaceId: 'workspace-1',
      projectId: 'project-1',
    });

    expect(upsertCompanies.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
      expect.anything(),
    );
    expect(output.result).toEqual(
      expect.objectContaining({ ephemeralWritten: 1 }),
    );
  });

  it('should link the list to the project so the sourcing ledger counts it', async () => {
    const { tool, listMeta } = buildTool();

    await tool.execute(fetch, {
      workspaceId: 'workspace-1',
      projectId: 'project-1',
    });

    expect(listMeta.projectIds).toEqual(['project-1']);
  });

  it('should write nothing and link nothing without any project', async () => {
    const { tool, upsertCompanies, listMeta } = buildTool();

    await tool.execute(fetch, { workspaceId: 'workspace-1' });

    expect(upsertCompanies.execute).not.toHaveBeenCalled();
    expect(listMeta.projectIds).toEqual([]);
  });
});

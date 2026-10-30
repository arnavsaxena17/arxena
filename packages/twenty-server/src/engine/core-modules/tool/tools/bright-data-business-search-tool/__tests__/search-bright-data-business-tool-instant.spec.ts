import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';

const smita = {
  brightId: 'person-1',
  data: {
    name: 'Smita Jatia',
    url: 'https://www.linkedin.com/in/smita-jatia',
  },
};
const lookalike = {
  brightId: 'person-2',
  data: {
    name: 'Smita J',
    url: 'https://www.linkedin.com/in/smita-jatia-2',
  },
};

const buildTool = (documents: Array<Record<string, unknown>>) => {
  const businessSearch = {
    search: jest.fn(async (_input: Record<string, unknown>) => ({
      reqId: 'req-1',
      matched: 4_200,
      coveragePercent: 100,
      mode: 'instant',
      documents,
      costUsd: documents.length * 0.002,
    })),
  };
  const ludicrous = {
    loadDataset: jest.fn(async () => undefined),
    executePlan: jest.fn(),
    estimate: jest.fn(),
    getPlan: jest.fn(),
    searchNaturalLanguage: jest.fn(),
  };
  const upsertCompanies = {
    execute: jest.fn(async () => ({
      success: true,
      result: { writtenRowIds: ['row-1'], createdCount: 1, updatedCount: 0 },
    })),
  };
  const upsertPeople = {
    execute: jest.fn(async () => ({
      success: true,
      result: { writtenRowIds: ['row-1'], createdCount: 1, updatedCount: 0 },
    })),
  };
  const tool = new SearchBrightDataBusinessTool(
    businessSearch as never,
    ludicrous as never,
    upsertCompanies as never,
    upsertPeople as never,
  );

  return {
    tool,
    businessSearch,
    ludicrous,
    upsertPeople,
    upsertCompanies,
  };
};

const context = { workspaceId: 'workspace-1', projectId: 'project-1' };

describe('SearchBrightDataBusinessTool instant', () => {
  it('should run people instant instead of sending it to the ludicrous planner', async () => {
    const { tool, businessSearch, ludicrous } = buildTool([smita]);

    await tool.execute(
      { entity: 'people', mode: 'instant', query: 'Smita Jatia Westlife' },
      context,
    );

    expect(businessSearch.search).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'people', mode: 'instant' }),
    );
    expect(ludicrous.executePlan).not.toHaveBeenCalled();
    expect(ludicrous.estimate).not.toHaveBeenCalled();
  });

  it('should cap a probe at 25 rows and default it to 10', async () => {
    const { tool, businessSearch } = buildTool([smita]);

    await tool.execute(
      { entity: 'people', mode: 'instant', query: 'CFO fintech', limit: 100 },
      context,
    );
    await tool.execute(
      { entity: 'company', mode: 'instant', query: 'apparel India' },
      context,
    );

    expect(businessSearch.search.mock.calls.map(([call]) => call)).toEqual([
      expect.objectContaining({ limit: 25 }),
      expect.objectContaining({ limit: 10 }),
    ]);
  });

  it('should write probe rows to the tab, flagged probe', async () => {
    const { tool, businessSearch, upsertPeople } = buildTool([
      smita,
      lookalike,
    ]);

    const output = await tool.execute(
      { entity: 'people', mode: 'instant', query: 'Smita Jatia Westlife' },
      context,
    );

    expect(upsertPeople.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        people: [
          expect.objectContaining({
            name: 'Smita Jatia',
            otherFields: expect.objectContaining({ probe: true }),
          }),
          expect.objectContaining({
            name: 'Smita J',
            otherFields: expect.objectContaining({ probe: true }),
          }),
        ],
      }),
      context,
    );
    // The search itself still runs without a project; the write happens after
    expect(businessSearch.search).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined }),
    );
    expect(output.result).toEqual(
      expect.objectContaining({
        lookup: 'probe',
        count: 2,
        matched: 4_200,
        ephemeralWritten: 2,
        probe: true,
        previewRows: expect.arrayContaining([
          expect.objectContaining({ name: 'Smita Jatia' }),
        ]),
      }),
    );
    expect(output.result).not.toHaveProperty('listId');
  });

  it('should cut a profile URL lookup to the exact match and write it', async () => {
    const { tool, upsertPeople } = buildTool([lookalike, smita]);

    const output = await tool.execute(
      {
        entity: 'people',
        mode: 'instant',
        query: 'https://in.linkedin.com/in/Smita-Jatia/',
      },
      context,
    );

    expect(upsertPeople.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        people: [expect.objectContaining({ name: 'Smita Jatia' })],
      }),
      context,
    );
    expect(output.result).toEqual(
      expect.objectContaining({
        lookup: 'linkedinUrl',
        linkedinUrl: 'linkedin.com/in/smita-jatia',
        count: 1,
        ephemeralWritten: 1,
        probe: false,
      }),
    );
    expect(output.result).not.toHaveProperty('listId');
  });

  it('should match a company LinkedIn URL on the record URL, not the website', async () => {
    const { tool, upsertCompanies } = buildTool([
      {
        brightId: 'company-1',
        data: {
          name: 'ABFRL',
          website: 'https://www.abfrl.com',
          url: 'https://www.linkedin.com/company/abfrl',
        },
      },
    ]);

    const output = await tool.execute(
      {
        entity: 'company',
        mode: 'instant',
        query: 'https://www.linkedin.com/company/abfrl',
      },
      context,
    );

    expect(output.result).toEqual(
      expect.objectContaining({ lookup: 'linkedinUrl', count: 1 }),
    );
    expect(upsertCompanies.execute).toHaveBeenCalled();
  });
});

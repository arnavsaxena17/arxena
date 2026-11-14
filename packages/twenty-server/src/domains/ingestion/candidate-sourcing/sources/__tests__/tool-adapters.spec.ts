import { type SourceSpec } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  createHarvestAdapter,
  createIndexAdapter,
} from 'src/domains/ingestion/candidate-sourcing/sources/tool-adapters';

const tool = (result: Record<string, unknown>) =>
  jest.fn(async (_toolName: string, _args: Record<string, unknown>) => result);

const FACETS: SourceSpec = {
  kind: 'facets',
  filters: {
    keywords: 'treasury',
    jobTitle: 'CFO',
    companies: ['Tata Steel'],
    locations: ['Mumbai'],
  },
};

const BOOLEAN: SourceSpec = {
  kind: 'boolean',
  query: 'treasury OR finance',
  facets: { jobTitle: 'CFO OR "Finance Director"', locations: ['Mumbai'] },
};

describe('index adapter', () => {
  it('should say the spec in the tool arguments and page by offset', async () => {
    const runTool = tool({ fetched: 25, newUnique: 20, paging: { total: 80 } });
    const adapter = createIndexAdapter(runTool);

    const first = await adapter.search(FACETS, { pageSize: 25 });
    const second = await adapter.search(FACETS, {
      pageSize: 25,
      cursor: first.nextCursor,
    });

    expect(runTool).toHaveBeenNthCalledWith(1, 'search_people_index', {
      query: 'treasury Mumbai',
      jobTitle: 'CFO',
      companyName: 'Tata Steel',
      limit: 25,
      offset: 0,
    });
    expect(runTool.mock.calls[1][1]).toMatchObject({ offset: 25 });
    expect(first).toEqual({
      fetched: 25,
      newUnique: 20,
      costUsd: 0,
      counts: 80,
      nextCursor: '25',
    });
    expect(second.nextCursor).toBe('50');
  });

  it('should have no next page after a short page', async () => {
    const adapter = createIndexAdapter(tool({ fetched: 7, newUnique: 7 }));

    expect(await adapter.search(FACETS, { pageSize: 25 })).toEqual({
      fetched: 7,
      newUnique: 7,
      costUsd: 0,
    });
  });

  it('should reject a spec with more than one company', () => {
    const adapter = createIndexAdapter(tool({}));

    expect(adapter.rejects?.(FACETS)).toBeUndefined();
    expect(
      adapter.rejects?.({
        kind: 'facets',
        filters: { companies: ['Tata Steel', 'JSW'] },
      }),
    ).toBe('it filters on one company per search');
  });

  it('should fail loudly when the tool refuses or reports no count', async () => {
    await expect(
      createIndexAdapter(tool({ error: 'projectId is required.' })).search(
        FACETS,
        { pageSize: 25 },
      ),
    ).rejects.toThrow('projectId is required.');
    await expect(
      createIndexAdapter(tool({})).search(FACETS, { pageSize: 25 }),
    ).rejects.toThrow('did not report how many rows');
  });
});

describe('Harvest adapter', () => {
  it('should send a plain title list as a title filter and page by number', async () => {
    const runTool = tool({
      fetched: 25,
      newUnique: 18,
      costUsd: 0.1,
      paging: { nextPage: 2, totalElements: 412 },
    });
    const adapter = createHarvestAdapter(runTool);

    const first = await adapter.search(BOOLEAN, { pageSize: 25 });

    await adapter.search(BOOLEAN, { pageSize: 25, cursor: first.nextCursor });

    expect(runTool).toHaveBeenNthCalledWith(1, 'search_harvest_leads', {
      searchParameters: {
        search: 'treasury OR finance',
        currentJobTitles: ['CFO', 'Finance Director'],
        locations: ['Mumbai'],
      },
      page: 1,
      limit: 25,
    });
    expect(runTool.mock.calls[1][1]).toMatchObject({ page: 2 });
    expect(first).toEqual({
      fetched: 25,
      newUnique: 18,
      costUsd: 0.1,
      counts: 412,
      nextCursor: '2',
    });
  });

  it('should fold a factored title into the search text', async () => {
    const runTool = tool({ fetched: 0, newUnique: 0 });

    await createHarvestAdapter(runTool).search(
      {
        kind: 'boolean',
        query: 'treasury',
        facets: { jobTitle: '(CFO OR Controller) AND NOT interim' },
      },
      { pageSize: 25 },
    );

    expect(runTool.mock.calls[0][1]).toMatchObject({
      searchParameters: {
        search: '(treasury) AND ((CFO OR Controller) AND NOT interim)',
      },
    });
  });

  it('should price a page from the row count when the tool reports no cost', async () => {
    const result = await createHarvestAdapter(
      tool({ fetched: 25, newUnique: 25 }),
    ).search(BOOLEAN, { pageSize: 25 });

    expect(result.costUsd).toBe(0.1);
    expect(result.nextCursor).toBeUndefined();
  });

  it('should reject what Harvest cannot filter on', () => {
    const adapter = createHarvestAdapter(tool({}));

    expect(adapter.rejects?.(BOOLEAN)).toBeUndefined();
    expect(
      adapter.rejects?.({
        kind: 'boolean',
        query: 'cfo',
        facets: { companies: ['Tata Steel'] },
      }),
    ).toBe('it filters employers by LinkedIn company URL, not by name');
    expect(adapter.rejects?.({ kind: 'boolean', query: '', facets: {} })).toBe(
      'the query has nothing Harvest can filter on',
    );
  });
});

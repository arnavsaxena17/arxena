import {
  createFetchTool,
  createSearchTool,
} from 'src/engine/api/mcp/tools/search-fetch.tool';

describe('search and fetch MCP tools', () => {
  it('should return the bridged search results unwrapped', async () => {
    const runArxenaTool = jest.fn().mockResolvedValue({
      success: true,
      result: { results: [{ id: 'orgchart:1', title: 'Org chart: Acme', url: '' }] },
    });

    const result = await createSearchTool(runArxenaTool).execute({
      query: '  acme ',
    });

    expect(runArxenaTool).toHaveBeenCalledWith('search', { query: 'acme' });
    expect(result).toEqual({
      results: [{ id: 'orgchart:1', title: 'Org chart: Acme', url: '' }],
    });
  });

  it('should reject an empty search query', async () => {
    const runArxenaTool = jest.fn();

    await expect(
      createSearchTool(runArxenaTool).execute({ query: '   ' }),
    ).rejects.toThrow('query is required');
    expect(runArxenaTool).not.toHaveBeenCalled();
  });

  it('should throw when the bridge call fails', async () => {
    const runArxenaTool = jest
      .fn()
      .mockResolvedValue({ success: false, error: 'UNAUTHORIZED' });

    await expect(
      createFetchTool(runArxenaTool).execute({ id: 'project:1' }),
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('should throw when the bridged handler reports its own failure', async () => {
    const runArxenaTool = jest.fn().mockResolvedValue({
      success: true,
      result: { success: false, error: 'Invalid document id: x' },
    });

    await expect(
      createFetchTool(runArxenaTool).execute({ id: 'x' }),
    ).rejects.toThrow('Invalid document id: x');
  });
});

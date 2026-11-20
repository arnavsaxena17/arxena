import { SearchHelpCenterTool } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool';

const buildTool = (responseData: unknown) => {
  const post = jest.fn(async (_url: string, _body: unknown) => ({
    data: responseData,
  }));
  const secureHttpClientService = {
    getHttpClient: () => ({ post }),
  };
  const tool = new SearchHelpCenterTool(secureHttpClientService as never);

  return { tool, post };
};

describe('SearchHelpCenterTool', () => {
  it('should search the Arxena docs subdomain and drop translated locale pages', async () => {
    const { tool, post } = buildTool({
      results: [
        {
          page: 'l/de/user-guide/workflows/overview',
          metadata: { title: 'Workflows' },
          content: 'German copy',
        },
        {
          page: 'user-guide/workflows/overview',
          metadata: { title: 'Workflows' },
          content: 'Build automations',
        },
      ],
    });

    const output = await tool.execute(
      { query: 'workflows' },
      {
        workspaceId: 'workspace-id',
      },
    );

    expect(post.mock.calls[0][0]).toBe(
      'https://leaves.mintlify.com/api/search/arxena',
    );
    expect(output.result).toEqual([
      {
        title: 'Workflows',
        url: 'https://docs.arxena.com/user-guide/workflows/overview',
        content: 'Build automations',
      },
    ]);
  });

  it('should report an empty search instead of throwing when nothing matches', async () => {
    const { tool } = buildTool({ results: [] });

    const output = await tool.execute(
      { query: 'nothing here' },
      {
        workspaceId: 'workspace-id',
      },
    );

    expect(output).toMatchObject({ success: true, result: [] });
  });

  it('should return a failed output when the search request rejects', async () => {
    const post = jest.fn(async () => {
      throw new Error('socket hang up');
    });
    const tool = new SearchHelpCenterTool({
      getHttpClient: () => ({ post }),
    } as never);

    const output = await tool.execute(
      { query: 'workflows' },
      {
        workspaceId: 'workspace-id',
      },
    );

    expect(output.success).toBe(false);
    expect(output.error).toContain('socket hang up');
  });
});

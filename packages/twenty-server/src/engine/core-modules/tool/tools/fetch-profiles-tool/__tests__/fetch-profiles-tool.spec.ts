import { FetchProfilesTool } from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/fetch-profiles-tool';

describe('FetchProfilesTool progress', () => {
  it('should report start, progress and completion to the chat', async () => {
    const fetch = jest.fn(
      async (input: { onProgress?: (p: unknown) => void }) => {
        input.onProgress?.({ phase: 'Fetching', fetched: 3, total: 10 });

        return {
          requested: 10,
          fetched: { brightData: 3, harvest: 0 },
          failed: [],
          skipped: {
            noLinkedinUrl: 0,
            alreadyFetched: 0,
            filteredByOutcome: 0,
          },
          remaining: 7,
          timedOut: false,
          durationMs: 4000,
        };
      },
    );
    const tool = new FetchProfilesTool({ fetch } as never);
    const updates: Array<{ state: string; message: string }> = [];

    await tool.execute(
      { projectId: 'p', rowLimit: 10 },
      {
        workspaceId: 'w',
        onToolProgress: (data) => updates.push(data),
      },
    );

    expect(updates[0].state).toBe('running');
    expect(updates.some((update) => update.message.includes('3 of 10'))).toBe(
      true,
    );
    expect(updates[updates.length - 1]).toMatchObject({
      state: 'completed',
      message: expect.stringContaining('7 still waiting'),
    });
  });

  it('should fail, not succeed, when nothing was fetched and lookups failed', async () => {
    const fetch = jest.fn(async () => ({
      requested: 10,
      fetched: { brightData: 0, harvest: 0 },
      failed: [],
      skipped: { noLinkedinUrl: 0, alreadyFetched: 0, filteredByOutcome: 0 },
      resolvedLinkedinUrls: { businessSearch: 0, google: 0 },
      remaining: 10,
      lookupErrors: 4,
      timedOut: true,
      durationMs: 90000,
    }));
    const tool = new FetchProfilesTool({ fetch } as never);
    const updates: Array<{ state: string }> = [];
    const result = await tool.execute(
      { projectId: 'p', rowLimit: 10 },
      { workspaceId: 'w', onToolProgress: (data) => updates.push(data) },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('do not retry');
    expect(updates[updates.length - 1].state).toBe('error');
  });
});

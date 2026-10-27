import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';

const documents = Array.from({ length: 25_000 }, (_, index) => ({
  brightId: `id-${index}`,
  data: { name: `Company ${index}`, website: `https://c${index}.example.com` },
}));

const buildTool = (upsertResult: {
  success: boolean;
  error?: string;
  result?: Record<string, unknown>;
}) => {
  const upsertCompanies = { execute: jest.fn(async () => upsertResult) };
  const tool = new SearchBrightDataBusinessTool(
    {} as never,
    {} as never,
    upsertCompanies as never,
    { execute: jest.fn() } as never,
    {} as never,
  );

  return { tool, upsertCompanies };
};

type Persist = (
  input: Record<string, unknown>,
  search: Record<string, unknown>,
  context: Record<string, unknown>,
) => Promise<{
  written: number;
  total: number;
  writtenRowIds: string[];
  createdCount: number;
  updatedCount: number;
  error?: string;
}>;

describe('SearchBrightDataBusinessTool project tab write', () => {
  const input = { entity: 'company', query: 'qsr', projectId: 'project-1' };
  const context = { workspaceId: 'workspace-1' };

  it('should send at most 20,000 rows, which is what the upsert tool accepts', async () => {
    const { tool, upsertCompanies } = buildTool({
      success: true,
      result: {
        writtenRowIds: ['a'],
        createdCount: 1,
        updatedCount: 0,
      },
    } as never);

    const outcome = await (
      tool as unknown as { persistEphemeral: Persist }
    ).persistEphemeral(input, { documents }, context);
    const sent = (
      upsertCompanies.execute.mock.calls[0] as unknown as [
        { companies: unknown[] },
      ]
    )[0].companies;

    expect(sent).toHaveLength(20_000);
    expect(outcome).toEqual({
      written: 20_000,
      total: 25_000,
      writtenRowIds: ['a'],
      createdCount: 1,
      updatedCount: 0,
    });
  });

  it('should report a rejected write instead of counting it as written', async () => {
    const { tool } = buildTool({ success: false, error: 'Too many items' });

    const outcome = await (
      tool as unknown as { persistEphemeral: Persist }
    ).persistEphemeral(input, { documents }, context);

    expect(outcome.written).toBe(0);
    expect(outcome.writtenRowIds).toEqual([]);
    expect(outcome.error).toBe('Too many items');
  });
});

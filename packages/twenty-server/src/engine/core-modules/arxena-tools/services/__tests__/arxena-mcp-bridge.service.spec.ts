import { callArxenaTool as callArxenaToolImport } from 'src/engine/core-modules/arxena-tools/library/lib';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock('src/engine/core-modules/arxena-tools/library/lib', () => ({
  callArxenaTool: jest.fn(),
}));

const textResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
});

describe('ArxenaMcpBridgeService', () => {
  const callArxenaTool = callArxenaToolImport as jest.Mock;
  // Disable Apollo people search server-side; everything else stays on
  const twentyConfigService = {
    get: jest.fn((key: string) =>
      key === 'IS_SEARCH_APOLLO_PEOPLE_ENABLED' ? false : true,
    ),
  } as unknown as TwentyConfigService;

  const buildService = () => new ArxenaMcpBridgeService(twentyConfigService);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SERVER_BASE_URL = 'https://app.example.com';
  });

  it('should run catalog tools in-process through execute_tool', async () => {
    callArxenaTool.mockResolvedValue(textResult({ ok: true }));

    await buildService().callTool('token\n', 'member-1', 'get_org_chart', {
      companyId: 'c1',
    });

    expect(callArxenaTool).toHaveBeenCalledWith(
      expect.objectContaining({
        apiToken: 'token',
        baseUrl: 'https://app.example.com',
        workspaceMemberId: 'member-1',
      }),
      'execute_tool',
      { toolName: 'get_org_chart', arguments: { companyId: 'c1' } },
    );
  });

  it('should call search and fetch as top-level tools', async () => {
    callArxenaTool.mockResolvedValue(textResult({ results: [] }));

    await buildService().callTool('token', undefined, 'search', { query: 'a' });

    expect(callArxenaTool).toHaveBeenCalledWith(
      expect.not.objectContaining({ workspaceMemberId: expect.anything() }),
      'search',
      { query: 'a' },
    );
  });

  it('should pass the server-side disabled tools instead of refetching them', async () => {
    callArxenaTool.mockResolvedValue(textResult({}));

    await buildService().callTool('token', undefined, 'anything', {});

    const config = callArxenaTool.mock.calls[0][0];

    expect(config.disabledToolNames).toContain('search_apollo_people');
    expect(config.disabledToolNames).not.toContain('search_people_index');
  });

  it('should learn schemas for the catalog and cache them', async () => {
    callArxenaTool.mockResolvedValue(
      textResult({
        tools: [
          {
            name: 'get_org_chart',
            description: 'd',
            inputSchema: { type: 'object' },
          },
        ],
      }),
    );
    const service = buildService();

    const first = await service.listTools('token');
    const second = await service.listTools('token');

    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'get_org_chart' }),
      ]),
    );
    expect(second).toBe(first);
    expect(
      callArxenaTool.mock.calls.every((call) => call[1] === 'learn_tools'),
    ).toBe(true);
  });
});

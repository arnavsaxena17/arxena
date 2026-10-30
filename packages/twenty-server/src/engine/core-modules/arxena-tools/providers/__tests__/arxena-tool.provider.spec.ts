import { ArxenaToolProvider } from 'src/engine/core-modules/arxena-tools/providers/arxena-tool.provider';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';

const buildProvider = () => {
  const arxenaMcpBridgeService = {
    callTool: jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"ok":true}' }],
    }),
    listTools: jest.fn().mockResolvedValue([
      {
        name: 'linkedin_unipile_get_own_profile',
        inputSchema: {
          type: 'object',
          properties: { accountId: { type: 'string' } },
        },
      },
    ]),
  };
  const twentyConfigService = { get: jest.fn().mockReturnValue(true) };
  const accessTokenService = {
    generateAccessToken: jest.fn().mockResolvedValue({ token: 'user-token' }),
  };
  const apiKeyService = {
    generateApiKeyToken: jest
      .fn()
      .mockResolvedValue({ token: 'api-key-token' }),
  };

  const sourcingLedgerService = { append: jest.fn(async () => undefined) };
  const writeService = {
    write: jest.fn(async ({ rows }: { rows: unknown[]; projectId?: string }) => ({
      written: rows.length,
      total: rows.length,
      createdCount: rows.length,
      updatedCount: 0,
    })),
  };

  const provider = new ArxenaToolProvider(
    arxenaMcpBridgeService as never,
    twentyConfigService as never,
    accessTokenService as never,
    apiKeyService as never,
    sourcingLedgerService as never,
    { forContext: jest.fn(() => undefined) } as never,
    writeService as never,
  );

  return {
    provider,
    sourcingLedgerService,
    writeService,
    arxenaMcpBridgeService,
    accessTokenService,
    apiKeyService,
  };
};

const apiKeyContext = {
  workspaceId: 'workspace-id',
  projectId: 'project-1',
  authContext: { type: 'apiKey', apiKey: { id: 'api-key-id' } },
} as unknown as ToolProviderContext;

describe('ArxenaToolProvider token resolution', () => {
  it('should mint a token from the api key id for api key sessions', async () => {
    const { provider, arxenaMcpBridgeService, apiKeyService } = buildProvider();

    const output = await provider.executeStaticTool(
      'linkedin_unipile_get_own_profile',
      {},
      apiKeyContext,
    );

    expect(apiKeyService.generateApiKeyToken).toHaveBeenCalledWith(
      'workspace-id',
      'api-key-id',
    );
    expect(arxenaMcpBridgeService.callTool).toHaveBeenCalledWith(
      'api-key-token',
      undefined,
      'linkedin_unipile_get_own_profile',
      {},
      undefined,
    );
    expect(output.success).toBe(true);
  });

  it('should load real input schemas for api key sessions', async () => {
    const { provider } = buildProvider();

    const descriptors = await provider.generateDescriptors(apiKeyContext);
    const own = descriptors.find(
      (descriptor) => descriptor.name === 'linkedin_unipile_get_own_profile',
    ) as { inputSchema?: { properties?: Record<string, unknown> } };

    expect(own.inputSchema?.properties).toHaveProperty('accountId');
  });

  it('should use a user access token for user sessions', async () => {
    const { provider, accessTokenService, apiKeyService } = buildProvider();

    await provider.executeStaticTool('linkedin_unipile_get_own_profile', {}, {
      workspaceId: 'workspace-id',
      userId: 'user-id',
    } as ToolProviderContext);

    expect(accessTokenService.generateAccessToken).toHaveBeenCalled();
    expect(apiKeyService.generateApiKeyToken).not.toHaveBeenCalled();
  });

  it('should fail with UNAUTHORIZED when no identity is available', async () => {
    const { provider } = buildProvider();

    const output = await provider.executeStaticTool(
      'linkedin_unipile_get_own_profile',
      {},
      { workspaceId: 'workspace-id' } as ToolProviderContext,
    );

    expect(output.error).toBe('UNAUTHORIZED');
  });

  it('should pass the actor workspace member id, not the user workspace id', async () => {
    const { provider, arxenaMcpBridgeService } = buildProvider();
    const userContext = {
      workspaceId: 'workspace-id',
      userId: 'user-id',
      userWorkspaceId: 'user-workspace-id',
      actorContext: { workspaceMemberId: 'workspace-member-id' },
    } as unknown as ToolProviderContext;

    await provider.executeStaticTool(
      'linkedin_unipile_get_own_profile',
      {},
      userContext,
    );

    expect(arxenaMcpBridgeService.callTool).toHaveBeenCalledWith(
      'user-token',
      'workspace-member-id',
      'linkedin_unipile_get_own_profile',
      {},
      undefined,
    );
  });

  it('should pass no member id when the actor has none', async () => {
    const { provider, arxenaMcpBridgeService } = buildProvider();
    const userContext = {
      workspaceId: 'workspace-id',
      userId: 'user-id',
      userWorkspaceId: 'user-workspace-id',
      actorContext: { workspaceMemberId: null },
    } as unknown as ToolProviderContext;

    await provider.executeStaticTool(
      'linkedin_unipile_get_own_profile',
      {},
      userContext,
    );

    expect(arxenaMcpBridgeService.callTool).toHaveBeenCalledWith(
      'user-token',
      undefined,
      'linkedin_unipile_get_own_profile',
      {},
      undefined,
    );
  });
});

describe('ArxenaToolProvider tab routing', () => {
  const linkedinItems = Array.from({ length: 5 }, (_, index) => ({
    id: `member-${index}`,
    name: `Person ${index}`,
    headline: `CEO at Company ${index}`,
    location: 'Mumbai',
    public_profile_url: `https://www.linkedin.com/in/person-${index}`,
    current_positions: [{ role: 'CEO', company: `Company ${index}` }],
  }));

  it('should write LinkedIn people results to the tab and return counts', async () => {
    const { provider, arxenaMcpBridgeService, writeService } = buildProvider();

    arxenaMcpBridgeService.callTool.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            items: linkedinItems,
            cursor: 'full-cursor',
            paging: { total_count: 1805 },
            config: { params: { category: 'people', keywords: 'ceo' } },
          }),
        },
      ],
    });

    const output = await provider.executeStaticTool(
      'search_linkedin_people',
      { searchType: 'classic' },
      apiKeyContext,
    );
    const result = output.result as Record<string, unknown>;

    expect(writeService.write).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(5);
    expect(result.newUnique).toBe(5);
    expect(result.cursor).toBe('full-cursor');
    expect(JSON.stringify(output)).not.toContain('Person 1');
    expect(JSON.stringify(output).length).toBeLessThan(1500);
  });

  it('should write every page of one search to the same project tab', async () => {
    const { provider, arxenaMcpBridgeService, writeService } = buildProvider();
    const page = (cursor: string) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            items: linkedinItems,
            cursor,
            config: { params: { category: 'people', keywords: 'ceo' } },
          }),
        },
      ],
    });

    arxenaMcpBridgeService.callTool
      .mockResolvedValueOnce(page('a'))
      .mockResolvedValueOnce(page('b'));

    await provider.executeStaticTool(
      'search_linkedin_people',
      {},
      apiKeyContext,
    );
    await provider.executeStaticTool(
      'search_linkedin_continue',
      { cursor: 'a' },
      apiKeyContext,
    );

    const [first, second] = writeService.write.mock.calls;

    expect(first[0].projectId).toBe('project-1');
    expect(second[0].projectId).toBe('project-1');
  });

  it('should leave output untouched for tools that are not search sources', async () => {
    const { provider, arxenaMcpBridgeService, writeService } = buildProvider();

    arxenaMcpBridgeService.callTool.mockResolvedValueOnce({
      content: [
        { type: 'text', text: JSON.stringify({ items: linkedinItems }) },
      ],
    });

    const output = await provider.executeStaticTool(
      'linkedin_unipile_get_own_profile',
      {},
      apiKeyContext,
    );

    expect(writeService.write).not.toHaveBeenCalled();
    expect(JSON.stringify(output)).toContain('Person 1');
  });
});

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
    generateApiKeyToken: jest.fn().mockResolvedValue({ token: 'api-key-token' }),
  };

  const provider = new ArxenaToolProvider(
    arxenaMcpBridgeService as never,
    twentyConfigService as never,
    accessTokenService as never,
    apiKeyService as never,
  );

  return { provider, arxenaMcpBridgeService, accessTokenService, apiKeyService };
};

const apiKeyContext = {
  workspaceId: 'workspace-id',
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

    await provider.executeStaticTool(
      'linkedin_unipile_get_own_profile',
      {},
      { workspaceId: 'workspace-id', userId: 'user-id' } as ToolProviderContext,
    );

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
});

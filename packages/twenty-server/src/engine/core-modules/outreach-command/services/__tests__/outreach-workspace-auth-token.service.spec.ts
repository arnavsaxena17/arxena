import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

import { OutreachWorkspaceAuthTokenService } from '../outreach-workspace-auth-token.service';

describe('OutreachWorkspaceAuthTokenService', () => {
  const workspaceQueryService = {
    getApiKeys: jest.fn(),
  };
  const apiKeyService = {
    generateApiKeyToken: jest.fn(),
    ensureWorkspaceApiKey: jest.fn(),
    isActive: jest.fn(),
  };
  const jwtWrapperService = {
    signAsyncOrThrow: jest.fn(),
  };

  const service = new OutreachWorkspaceAuthTokenService(
    workspaceQueryService as never,
    apiKeyService as never,
    jwtWrapperService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    apiKeyService.isActive.mockReturnValue(true);
  });

  it('returns an existing API key token when present', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });

    await expect(service.resolveOrMint('ws-1')).resolves.toBe('tok');
    expect(apiKeyService.ensureWorkspaceApiKey).not.toHaveBeenCalled();
    expect(jwtWrapperService.signAsyncOrThrow).not.toHaveBeenCalled();
  });

  it('creates a workspace API key when none exists', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([]);
    apiKeyService.ensureWorkspaceApiKey.mockResolvedValue({ id: 'key-2' });
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'created-tok' });

    await expect(service.resolveOrMint('ws-1')).resolves.toBe('created-tok');
    expect(apiKeyService.ensureWorkspaceApiKey).toHaveBeenCalledWith('ws-1');
    expect(jwtWrapperService.signAsyncOrThrow).not.toHaveBeenCalled();
  });

  it('mints a workspace token when API key creation fails', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([]);
    apiKeyService.ensureWorkspaceApiKey.mockRejectedValue(
      new Error('Admin role missing'),
    );
    jwtWrapperService.signAsyncOrThrow.mockResolvedValue('system-tok');

    await expect(service.resolveOrMint('ws-1')).resolves.toBe('system-tok');
    expect(jwtWrapperService.signAsyncOrThrow).toHaveBeenCalledWith(
      {
        sub: 'ws-1',
        workspaceId: 'ws-1',
        type: JwtTokenTypeEnum.API_KEY,
      },
      { expiresIn: '2h' },
    );
  });
});

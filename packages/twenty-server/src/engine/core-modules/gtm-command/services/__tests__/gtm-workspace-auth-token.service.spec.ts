import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

import { GtmWorkspaceAuthTokenService } from '../gtm-workspace-auth-token.service';

describe('GtmWorkspaceAuthTokenService', () => {
  const workspaceQueryService = {
    getApiKeys: jest.fn(),
  };
  const apiKeyService = {
    generateApiKeyToken: jest.fn(),
  };
  const jwtWrapperService = {
    signAsyncOrThrow: jest.fn(),
  };

  const service = new GtmWorkspaceAuthTokenService(
    workspaceQueryService as never,
    apiKeyService as never,
    jwtWrapperService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an existing API key token when present', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });

    await expect(service.resolveOrMint('ws-1')).resolves.toBe('tok');
    expect(jwtWrapperService.signAsyncOrThrow).not.toHaveBeenCalled();
  });

  it('mints a workspace token when no API key exists', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([]);
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

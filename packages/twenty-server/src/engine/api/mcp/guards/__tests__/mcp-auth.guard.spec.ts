import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { McpAuthGuard } from 'src/engine/api/mcp/guards/mcp-auth.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

describe('McpAuthGuard', () => {
  let guard: McpAuthGuard;
  let jwtAuthGuard: jest.Mocked<JwtAuthGuard>;

  const mockSetHeader = jest.fn();
  const buildContext = (host = 'crm.example.com'): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ setHeader: mockSetHeader }),
        getRequest: () => ({
          protocol: 'https',
          get: (name: string) => (name === 'host' ? host : undefined),
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtAuthGuard = {
      canActivate: jest.fn(),
    } as unknown as jest.Mocked<JwtAuthGuard>;

    guard = new McpAuthGuard(jwtAuthGuard);
    mockSetHeader.mockClear();
  });

  it('should return true when JwtAuthGuard passes', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(true);

    const result = await guard.canActivate(buildContext());

    expect(result).toBe(true);
    expect(mockSetHeader).not.toHaveBeenCalled();
  });

  it('should set WWW-Authenticate using the request host and throw when auth fails', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(false);

    await expect(
      guard.canActivate(buildContext('acme.twenty.com')),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockSetHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer resource_metadata="https://acme.twenty.com/.well-known/oauth-protected-resource/mcp", scope="api profile"',
    );
  });

  describe('X-API-KEY header', () => {
    const buildRequestContext = (headers: Record<string, string>) => {
      const request = {
        headers,
        protocol: 'https',
        get: () => 'crm.example.com',
      };

      return {
        request,
        context: {
          switchToHttp: () => ({
            getResponse: () => ({ setHeader: mockSetHeader }),
            getRequest: () => request,
          }),
        } as unknown as ExecutionContext,
      };
    };

    it('should promote X-API-KEY to a Bearer authorization header', async () => {
      jwtAuthGuard.canActivate.mockResolvedValue(true);
      const { request, context } = buildRequestContext({
        'x-api-key': ' key-123 ',
      });

      await guard.canActivate(context);

      expect(request.headers).toMatchObject({
        authorization: 'Bearer key-123',
      });
    });

    it('should not overwrite an existing authorization header', async () => {
      jwtAuthGuard.canActivate.mockResolvedValue(true);
      const { request, context } = buildRequestContext({
        'x-api-key': 'key-123',
        authorization: 'Bearer existing',
      });

      await guard.canActivate(context);

      expect(request.headers.authorization).toBe('Bearer existing');
    });
  });
});

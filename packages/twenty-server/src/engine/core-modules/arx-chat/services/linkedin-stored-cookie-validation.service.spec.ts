import { HttpException } from '@nestjs/common';

import { LinkedinStoredCookieValidationService } from './linkedin-stored-cookie-validation.service';

describe('LinkedinStoredCookieValidationService', () => {
  const createService = () => {
    const environmentService = {
      get: jest.fn((key: string) => {
        if (key === 'LINKEDIN_UNIPILE_ON_DEMAND') {
          return true;
        }
        if (key === 'LINKEDIN_UNIPILE_VALIDATE_THEN_DISCONNECT') {
          return true;
        }
        return false;
      }),
    };

    const workspaceMemberProfileUnipileService = {
      getWorkspaceMemberLinkedinCookieTokens: jest.fn(),
      getKeepLinkedinConnected: jest.fn(),
      updateWorkspaceMemberLinkedinCookieTokens: jest.fn(),
    };

    const memberLinkedinUnipileConnectionService = {
      disconnectMemberLinkedinUnipileAccount: jest.fn(),
    };

    const linkedinUnipileMemberAccountResolverService = {
      resolveMemberLinkedinUnipileAccount: jest.fn(),
    };

    const service = new LinkedinStoredCookieValidationService(
      environmentService as never,
      workspaceMemberProfileUnipileService as never,
      memberLinkedinUnipileConnectionService as never,
      linkedinUnipileMemberAccountResolverService as never,
    );

    return {
      service,
      environmentService,
      workspaceMemberProfileUnipileService,
      memberLinkedinUnipileConnectionService,
      linkedinUnipileMemberAccountResolverService,
    };
  };

  it('returns NO_STORED_LI_AT when profile has no stored cookie', async () => {
    const { service, workspaceMemberProfileUnipileService } = createService();
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens.mockResolvedValue(
      {
        linkedinLiAtToken: null,
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      },
    );

    const result = await service.validateStoredCookiesForMember({
      workspace: { id: 'workspace-id' } as never,
      workspaceMemberId: 'member-id',
      authToken: 'auth-token',
    });

    expect(result).toMatchObject({
      connected: false,
      errorCode: 'NO_STORED_LI_AT',
      hasLiAt: false,
    });
  });

  it('disconnects after successful validation when keepLinkedinConnected is false', async () => {
    const {
      service,
      workspaceMemberProfileUnipileService,
      memberLinkedinUnipileConnectionService,
      linkedinUnipileMemberAccountResolverService,
    } = createService();

    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'li-at',
        linkedinLiAToken: 'li-a',
        linkedinUserAgent: 'UA',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'li-at',
        linkedinLiAToken: 'li-a',
        linkedinUserAgent: 'UA',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: '2026-06-18T00:01:00.000Z',
      });

    linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount.mockResolvedValue(
      {
        accountId: 'unipile-account-id',
        accountStatus: 'connected',
        isConnected: true,
        reconnectAttempted: true,
        reconnectSucceeded: true,
        reconnectMessage: null,
      },
    );
    workspaceMemberProfileUnipileService.getKeepLinkedinConnected.mockResolvedValue(
      false,
    );

    const result = await service.validateStoredCookiesForMember({
      workspace: { id: 'workspace-id' } as never,
      workspaceMemberId: 'member-id',
      authToken: 'auth-token',
    });

    expect(
      memberLinkedinUnipileConnectionService.disconnectMemberLinkedinUnipileAccount,
    ).toHaveBeenCalled();
    expect(result).toMatchObject({
      connected: true,
      disconnectedAfterValidation: true,
      keepConnected: false,
    });
  });

  it('throws when validate-then-disconnect is disabled', () => {
    const { service, environmentService } = createService();
    environmentService.get.mockReturnValue(false);

    expect(() => service.assertValidateThenDisconnectEnabled('extension')).toThrow(
      HttpException,
    );
  });

  it('allows admin validation when only validate-then-disconnect is enabled', () => {
    const { service, environmentService } = createService();
    environmentService.get.mockImplementation((key: string) => {
      if (key === 'LINKEDIN_UNIPILE_VALIDATE_THEN_DISCONNECT') {
        return true;
      }
      if (key === 'LINKEDIN_UNIPILE_ON_DEMAND') {
        return false;
      }
      return false;
    });

    expect(() => service.assertValidateThenDisconnectEnabled('admin')).not.toThrow();
    expect(() => service.assertValidateThenDisconnectEnabled('extension')).toThrow(
      HttpException,
    );
  });

  it('admin probe disconnects even when keepLinkedinConnected is true', async () => {
    const {
      service,
      workspaceMemberProfileUnipileService,
      memberLinkedinUnipileConnectionService,
      linkedinUnipileMemberAccountResolverService,
    } = createService();

    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'li-at',
        linkedinLiAToken: null,
        linkedinUserAgent: 'UA',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'li-at',
        linkedinLiAToken: null,
        linkedinUserAgent: 'UA',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: '2026-06-18T00:01:00.000Z',
      });

    linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount.mockResolvedValue(
      {
        accountId: 'unipile-account-id',
        accountStatus: 'connected',
        isConnected: true,
        reconnectAttempted: true,
        reconnectSucceeded: true,
        reconnectMessage: null,
      },
    );
    workspaceMemberProfileUnipileService.getKeepLinkedinConnected.mockResolvedValue(
      true,
    );

    const result = await service.validateStoredCookiesForMember({
      workspace: { id: 'workspace-id' } as never,
      workspaceMemberId: 'member-id',
      authToken: 'auth-token',
      audience: 'admin',
      forceDisconnectAfterValidation: true,
    });

    expect(
      memberLinkedinUnipileConnectionService.disconnectMemberLinkedinUnipileAccount,
    ).toHaveBeenCalled();
    expect(result).toMatchObject({
      connected: true,
      disconnectedAfterValidation: true,
      keepConnected: true,
    });
  });
});

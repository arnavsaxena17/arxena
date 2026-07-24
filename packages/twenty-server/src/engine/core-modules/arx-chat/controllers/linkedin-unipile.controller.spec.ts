import { HttpStatus } from '@nestjs/common';

import { LinkedinUnipileController } from './linkedin-unipile.controller';

describe('LinkedinUnipileController', () => {
  const createController = () => {
    const workspaceMemberProfileUnipileService = {
      getWorkspaceMemberProfileUnipileFields: jest.fn(),
      updateWorkspaceMemberLinkedinUrlFromExtensionIfValid: jest.fn(),
      getWorkspaceMemberLinkedinCookieTokens: jest.fn(),
      updateWorkspaceMemberLinkedinCookieTokens: jest.fn(),
      getKeepLinkedinConnected: jest.fn(),
      clearWorkspaceMemberUnipileAccountId: jest.fn(),
    };

    const linkedinUnipileRequestService = {
      disconnectAccountBestEffort: jest.fn(),
      inferLinkedinSearchTypeForAccount: jest.fn(),
    };

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

    const memberLinkedinUnipileConnectionService = {
      disconnectMemberLinkedinUnipileAccount: jest.fn(),
      disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged: jest.fn(),
    };

    const linkedinUnipileMemberAccountResolverService = {
      resolveMemberLinkedinUnipileAccount: jest.fn(),
    };

    const linkedinStoredCookieValidationService = {
      assertValidateThenDisconnectEnabled: jest.fn(),
      validateStoredCookiesForMember: jest.fn(),
    };

    const controller = new LinkedinUnipileController(
      {} as never,
      {} as never,
      {} as never,
      environmentService as never,
      {} as never,
      workspaceMemberProfileUnipileService as never,
      linkedinUnipileRequestService as never,
      memberLinkedinUnipileConnectionService as never,
      linkedinUnipileMemberAccountResolverService as never,
      linkedinStoredCookieValidationService as never,
    );

    return {
      controller,
      environmentService,
      workspaceMemberProfileUnipileService,
      linkedinUnipileRequestService,
      memberLinkedinUnipileConnectionService,
      linkedinStoredCookieValidationService,
    };
  };

  it('buildLinkedinSyncResponseFields includes inferred search type when connected', async () => {
    const { controller, linkedinUnipileRequestService } = createController();
    linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount.mockResolvedValue(
      {
        inferredSearchType: 'sales_navigator',
        salesNavigatorAvailable: true,
        recruiterAvailable: false,
      },
    );

    const result = await (
      controller as unknown as {
        buildLinkedinSyncResponseFields: (
          accountId: string,
          status: string,
          connected: boolean,
        ) => Promise<Record<string, unknown>>;
      }
    ).buildLinkedinSyncResponseFields('unipile-account-id', 'connected', true);

    expect(
      linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount,
    ).toHaveBeenCalledWith('unipile-account-id');
    expect(result).toMatchObject({
      accountId: 'unipile-account-id',
      status: 'connected',
      connected: true,
      inferredSearchType: 'sales_navigator',
      salesNavigatorAvailable: true,
      recruiterAvailable: false,
    });
  });

  it('buildLinkedinSyncResponseFields omits inferred search type when disconnected', async () => {
    const { controller, linkedinUnipileRequestService } = createController();

    const result = await (
      controller as unknown as {
        buildLinkedinSyncResponseFields: (
          accountId: string,
          status: string,
          connected: boolean,
        ) => Promise<Record<string, unknown>>;
      }
    ).buildLinkedinSyncResponseFields('unipile-account-id', 'not_connected', false);

    expect(
      linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount,
    ).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      accountId: 'unipile-account-id',
      connected: false,
    });
    expect(result.inferredSearchType).toBeUndefined();
  });

  it('rejects persist-cookies when browser LinkedIn slug mismatches member profile', async () => {
    const { controller, workspaceMemberProfileUnipileService } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: 'https://www.linkedin.com/in/member-a',
      },
    );

    await expect(
      controller.persistExtensionCookies(
        {
          li_at: 'token',
          linkedin_profile_url: 'https://www.linkedin.com/in/member-b',
        },
        { id: 'workspace-id' } as never,
        {
          workspaceMemberId: 'member-id',
          headers: { authorization: 'Bearer auth-token' },
        } as never,
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
  });

  it('persists cookies and reports cookiesChanged when persist-cookies succeeds', async () => {
    const { controller, workspaceMemberProfileUnipileService } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: null,
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'next-li-at',
        linkedinLiAToken: 'next-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    const result = await controller.persistExtensionCookies(
      {
        li_at: 'next-li-at',
        li_a: 'next-li-a',
        linkedin_profile_url: 'https://www.linkedin.com/in/member-a',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens,
    ).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      cookies: {
        hasLiAt: true,
        hasLiA: true,
        cookiesChanged: true,
      },
    });
  });

  it('persists li_at and clears li_a when extension sends empty li_a (no recruiter cookie)', async () => {
    const { controller, workspaceMemberProfileUnipileService } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: null,
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'next-li-at',
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    const result = await controller.persistExtensionCookies(
      {
        li_at: 'next-li-at',
        li_a: '',
        linkedin_profile_url: 'https://www.linkedin.com/in/member-a',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens,
    ).toHaveBeenCalledWith(
      'auth-token',
      'member-id',
      { linkedinLiAtToken: 'next-li-at', linkedinLiAToken: null },
      { touchLastSyncedAt: true },
    );
    expect(result).toMatchObject({
      success: true,
      cookies: {
        hasLiAt: true,
        hasLiA: false,
        cookiesChanged: true,
      },
    });
  });

  it('clears stale li_a when extension sends empty li_a alongside li_at', async () => {
    const { controller, workspaceMemberProfileUnipileService } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'old-li-at',
        linkedinLiAToken: 'stale-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'next-li-at',
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    const result = await controller.persistExtensionCookies(
      {
        li_at: 'next-li-at',
        li_a: '',
        linkedin_profile_url: 'https://www.linkedin.com/in/member-a',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens,
    ).toHaveBeenCalledWith(
      'auth-token',
      'member-id',
      {
        linkedinLiAtToken: 'next-li-at',
        linkedinLiAToken: null,
      },
      { touchLastSyncedAt: true },
    );
    expect(result).toMatchObject({
      success: true,
      cookies: {
        hasLiAt: true,
        hasLiA: false,
        cookiesChanged: true,
      },
    });
  });

  it('disconnects stored LinkedIn Unipile account when li_a is first acquired and li_at is unchanged', async () => {
    const {
      controller,
      workspaceMemberProfileUnipileService,
      memberLinkedinUnipileConnectionService,
    } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
        linkedinUnipileAccountId: 'stored-unipile-account',
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'same-li-at',
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'same-li-at',
        linkedinLiAToken: 'new-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    await controller.persistExtensionCookies(
      {
        li_at: 'same-li-at',
        li_a: 'new-li-a',
        linkedin_profile_url: 'https://www.linkedin.com/in/member-a',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      memberLinkedinUnipileConnectionService.disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged,
    ).toHaveBeenCalledWith({
      workspaceMemberId: 'member-id',
      workspaceId: 'workspace-id',
      authToken: 'auth-token',
      storedAccountId: 'stored-unipile-account',
    });
  });

  it('does not disconnect when stored li_a already exists', async () => {
    const {
      controller,
      workspaceMemberProfileUnipileService,
      memberLinkedinUnipileConnectionService,
    } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
        linkedinUnipileAccountId: 'stored-unipile-account',
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'same-li-at',
        linkedinLiAToken: 'old-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'same-li-at',
        linkedinLiAToken: 'new-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    await controller.persistExtensionCookies(
      {
        li_at: 'same-li-at',
        li_a: 'new-li-a',
        linkedin_profile_url: 'https://www.linkedin.com/in/member-a',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      memberLinkedinUnipileConnectionService.disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged,
    ).not.toHaveBeenCalled();
  });

  it('does not disconnect when li_a changes alongside li_at', async () => {
    const {
      controller,
      workspaceMemberProfileUnipileService,
      memberLinkedinUnipileConnectionService,
    } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
        linkedinUnipileAccountId: 'stored-unipile-account',
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'old-li-at',
        linkedinLiAToken: 'old-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'new-li-at',
        linkedinLiAToken: 'new-li-a',
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    await controller.persistExtensionCookies(
      {
        li_at: 'new-li-at',
        li_a: 'new-li-a',
        linkedin_profile_url: 'https://www.linkedin.com/in/member-a',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      memberLinkedinUnipileConnectionService.disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged,
    ).not.toHaveBeenCalled();
  });

  it('persists extension client_ip and client_country when server sees localhost', async () => {
    const { controller, workspaceMemberProfileUnipileService } = createController();
    workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields.mockResolvedValue(
      {
        linkedinUrl: null,
      },
    );
    workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      .mockResolvedValueOnce({
        linkedinLiAtToken: null,
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      })
      .mockResolvedValueOnce({
        linkedinLiAtToken: 'next-li-at',
        linkedinLiAToken: null,
        linkedinUserAgent: 'UA',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
        linkedinCookiesLastSyncedAt: '2026-06-18T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      });

    await controller.persistExtensionCookies(
      {
        li_at: 'next-li-at',
        user_agent: 'UA',
        client_ip: '203.0.113.10',
        client_country: 'US',
      },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
        socket: { remoteAddress: '::1' },
      } as never,
    );

    expect(
      workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens,
    ).toHaveBeenCalledWith(
      'auth-token',
      'member-id',
      {
        linkedinLiAtToken: 'next-li-at',
        linkedinUserAgent: 'UA',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
      },
      { touchLastSyncedAt: true },
    );
  });

  it('validate-session schedules idle disconnect when keepLinkedinConnected is false', async () => {
    const { controller, linkedinStoredCookieValidationService } = createController();

    linkedinStoredCookieValidationService.validateStoredCookiesForMember.mockResolvedValue(
      {
        attempted: true,
        connected: true,
        disconnectedAfterValidation: true,
        keepConnected: false,
        hasLiAt: true,
        hasLiA: false,
        lastSyncedAt: '2026-06-18T00:00:00.000Z',
        lastValidatedAt: '2026-06-18T00:01:00.000Z',
        message: 'LinkedIn connection succeeded; idle disconnect scheduled after validation',
        errorCode: null,
        reconnectAttempted: true,
        reconnectSucceeded: true,
        accountId: 'unipile-account-id',
        accountStatus: 'connected',
      },
    );

    const result = await controller.validateLinkedinSession(
      { user_agent: 'UA' },
      { id: 'workspace-id' } as never,
      {
        workspaceMemberId: 'member-id',
        headers: { authorization: 'Bearer auth-token' },
      } as never,
    );

    expect(
      linkedinStoredCookieValidationService.validateStoredCookiesForMember,
    ).toHaveBeenCalledWith({
      workspace: { id: 'workspace-id' },
      workspaceMemberId: 'member-id',
      authToken: 'auth-token',
      userAgent: 'UA',
      clientIp: undefined,
      clientCountry: undefined,
      audience: 'extension',
      logContext: 'extension validate-session',
    });
    expect(result).toMatchObject({
      validate: {
        attempted: true,
        connected: true,
        keepConnected: false,
        disconnectedAfterValidation: true,
      },
      linkedin: {
        connected: true,
        accountId: 'unipile-account-id',
        status: 'validated_disconnect_scheduled',
      },
    });
  });

  it('validate-session returns 404 when the feature flag is disabled', async () => {
    const { controller, linkedinStoredCookieValidationService } = createController();
    const { HttpException } = await import('@nestjs/common');
    linkedinStoredCookieValidationService.validateStoredCookiesForMember.mockRejectedValue(
      new HttpException(
        'LinkedIn validate-then-disconnect is disabled',
        HttpStatus.NOT_FOUND,
      ),
    );

    await expect(
      controller.validateLinkedinSession(
        {},
        { id: 'workspace-id' } as never,
        {
          workspaceMemberId: 'member-id',
          headers: { authorization: 'Bearer auth-token' },
        } as never,
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });
});

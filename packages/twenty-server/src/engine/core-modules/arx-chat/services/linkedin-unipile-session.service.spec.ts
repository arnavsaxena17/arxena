import { LinkedinUnipileSessionService } from './linkedin-unipile-session.service';

jest.mock('../utils/resolve-linkedin-country-from-ip.util', () => ({
  resolveLinkedinCountryFromIp: jest.fn().mockResolvedValue('US'),
}));

describe('LinkedinUnipileSessionService', () => {
  const workspaceMemberId = 'member-1';
  const workspaceId = 'workspace-1';
  const apiToken = 'auth-token';
  const accountId = 'unipile-account-1';
  const existingAccountId = 'existing-account-8suTfmj';

  const createService = (options?: {
    onDemand?: boolean;
    keepConnected?: boolean;
    resolverResult?: {
      accountId: string | null;
      accountCreatedThisSession?: boolean;
      resolution?:
        | 'stored_profile'
        | 'usable_existing'
        | 'identity_match'
        | 'cookie_reconnect'
        | 'none';
    };
  }) => {
    const onDemand = options?.onDemand ?? true;
    const keepConnected = options?.keepConnected ?? false;
    const resolverResult = options?.resolverResult ?? {
      accountId,
      accountCreatedThisSession: true,
      resolution: 'cookie_reconnect' as const,
    };

    const environmentService = {
      get: jest.fn((key: string) => {
        if (key === 'LINKEDIN_UNIPILE_ON_DEMAND') {
          return onDemand;
        }
        return false;
      }),
    };

    const workspaceQueryService = {
      getWorkspaceIdFromToken: jest.fn().mockResolvedValue(workspaceId),
      getWorkspaceMemberIdFromToken: jest.fn().mockResolvedValue(workspaceMemberId),
    };

    const workspaceMemberProfileUnipileService = {
      getKeepLinkedinConnected: jest.fn().mockResolvedValue(keepConnected),
      getWorkspaceMemberUnipileAccountId: jest.fn().mockResolvedValue(null),
      getWorkspaceMemberLinkedinCookieTokens: jest.fn().mockResolvedValue({
        linkedinLiAtToken: 'li-at-token',
        linkedinLiAToken: 'li-a-token',
        linkedinUserAgent: 'Mozilla/5.0',
        linkedinIp: '203.0.113.10',
        linkedinCountry: 'US',
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
      }),
    };

    const linkedinUnipileRequestService = {
      inferLinkedinSearchTypeForAccount: jest.fn().mockResolvedValue({
        inferredSearchType: 'sales_navigator',
        salesNavigatorAvailable: true,
        recruiterAvailable: false,
      }),
    };

    const memberLinkedinUnipileConnectionService = {
      clearStaleStoredLinkedinAccountIdIfNeeded: jest.fn(),
    };

    const linkedinUnipileMemberAccountResolverService = {
      resolveMemberLinkedinUnipileAccount: jest.fn().mockResolvedValue({
        accountId: resolverResult.accountId,
        accountStatus: 'connected',
        isConnected: Boolean(resolverResult.accountId),
        resolution: resolverResult.resolution ?? 'cookie_reconnect',
        reconnectAttempted: resolverResult.resolution === 'cookie_reconnect',
        reconnectSucceeded: resolverResult.resolution === 'cookie_reconnect',
        reconnectMessage: null,
        accountCreatedThisSession:
          resolverResult.accountCreatedThisSession ?? false,
        staleProfileAccountCleared: false,
      }),
    };

    const linkedinUnipileTeardownSchedulerService = {
      scheduleIdleDisconnect: jest.fn(),
      cancelPendingDisconnect: jest.fn(),
    };

    const service = new LinkedinUnipileSessionService(
      environmentService as never,
      workspaceQueryService as never,
      workspaceMemberProfileUnipileService as never,
      linkedinUnipileRequestService as never,
      memberLinkedinUnipileConnectionService as never,
      linkedinUnipileTeardownSchedulerService as never,
      linkedinUnipileMemberAccountResolverService as never,
    );

    return {
      service,
      workspaceMemberProfileUnipileService,
      linkedinUnipileRequestService,
      linkedinUnipileMemberAccountResolverService,
      linkedinUnipileTeardownSchedulerService,
    };
  };

  it('withLinkedinSession delegates account resolution to LinkedinUnipileMemberAccountResolverService', async () => {
    const {
      service,
      linkedinUnipileMemberAccountResolverService,
    } = createService({
      resolverResult: {
        accountId,
        accountCreatedThisSession: true,
        resolution: 'cookie_reconnect',
      },
    });

    await service.withLinkedinSession(apiToken, undefined, async (session) => session);

    expect(
      linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        workspaceMemberId,
        authToken: apiToken,
        reconnectSourceToken: 'li-at-token',
        premiumToken: 'li-a-token',
        userAgent: 'Mozilla/5.0',
        ip: '203.0.113.10',
        country: 'US',
        reconnectLogContext: 'on-demand session',
      }),
    );
  });

  it('withLinkedinSession connects from cookies, infers search type, and schedules idle disconnect', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      linkedinUnipileTeardownSchedulerService,
    } = createService();

    const result = await service.withLinkedinSession(
      apiToken,
      undefined,
      async (session) => session,
    );

    expect(
      linkedinUnipileTeardownSchedulerService.cancelPendingDisconnect,
    ).toHaveBeenCalledWith(workspaceMemberId);
    expect(
      linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount,
    ).toHaveBeenCalledWith(accountId);
    expect(result).toMatchObject({
      accountId,
      accountIdSource: 'on_demand_cookie_reconnect',
      salesNavigatorAvailable: true,
    });
    expect(
      linkedinUnipileTeardownSchedulerService.scheduleIdleDisconnect,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        workspaceMemberId,
      }),
    );
  });

  it('withLinkedinSession reuses existing Unipile account without POST /accounts', async () => {
    const { service, linkedinUnipileMemberAccountResolverService } = createService({
      resolverResult: {
        accountId: existingAccountId,
        accountCreatedThisSession: false,
        resolution: 'usable_existing',
      },
    });

    const result = await service.withLinkedinSession(
      apiToken,
      undefined,
      async (session) => session,
    );

    expect(result.accountId).toBe(existingAccountId);
    expect(result.accountIdSource).toBe('workspace_member_profile');
    expect(
      linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount,
    ).toHaveBeenCalled();
  });

  it('withLinkedinSession skips idle disconnect scheduling when keepLinkedinConnected is true', async () => {
    const { service, linkedinUnipileTeardownSchedulerService } = createService({
      keepConnected: true,
    });

    await service.withLinkedinSession(apiToken, undefined, async (session) => session.accountId);

    expect(
      linkedinUnipileTeardownSchedulerService.scheduleIdleDisconnect,
    ).not.toHaveBeenCalled();
    expect(
      linkedinUnipileTeardownSchedulerService.cancelPendingDisconnect,
    ).not.toHaveBeenCalled();
  });

  it('withLinkedinSession does not schedule idle disconnect for explicit account id', async () => {
    const { service, linkedinUnipileTeardownSchedulerService } = createService();

    await service.withLinkedinSession(apiToken, accountId, async (session) => session.accountId);

    expect(
      linkedinUnipileTeardownSchedulerService.scheduleIdleDisconnect,
    ).not.toHaveBeenCalled();
  });

  it('withLinkedinSession schedules idle disconnect for reused existing account', async () => {
    const { service, linkedinUnipileTeardownSchedulerService } = createService({
      resolverResult: {
        accountId: existingAccountId,
        accountCreatedThisSession: false,
        resolution: 'usable_existing',
      },
    });

    await service.withLinkedinSession(apiToken, undefined, async (session) => session.accountId);

    expect(
      linkedinUnipileTeardownSchedulerService.scheduleIdleDisconnect,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: existingAccountId,
        workspaceMemberId,
      }),
    );
  });
});

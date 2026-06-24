import { HttpException, HttpStatus } from '@nestjs/common';

import { LinkedinUnipileMemberAccountResolverService } from './linkedin-unipile-member-account-resolver.service';

describe('LinkedinUnipileMemberAccountResolverService', () => {
  const workspaceMemberId = 'member-1';
  const workspaceId = 'workspace-1';
  const authToken = 'auth-token';
  const accountId = 'unipile-account-1';
  const staleAccountId = 'stale-profile-account';
  const disconnectedIdentityId = 'disconnected-identity-account';

  const createService = (options?: {
    storedAccountId?: string | null;
    identityMatch?: { id: string; status: string } | null;
    staleProfileAccountCleared?: boolean;
  }) => {
    const storedAccountId = options?.storedAccountId ?? null;
    const identityMatch = options?.identityMatch ?? null;

    const workspaceMemberProfileUnipileService = {
      getWorkspaceMemberUnipileAccountId: jest
        .fn()
        .mockResolvedValue(storedAccountId),
      getWorkspaceMemberProfileUnipileFields: jest.fn().mockResolvedValue({
        linkedinUrl: 'https://www.linkedin.com/in/test-user',
        linkedinUnipileAccountId: storedAccountId,
      }),
      applyUnipileAccountToWorkspaceMemberProfile: jest.fn(),
      updateWorkspaceMemberUnipileAccountId: jest.fn(),
      clearWorkspaceMemberLinkedinCookieTokens: jest.fn(),
    };

    const linkedinUnipileRequestService = {
      fetchAccountByIdIfExists: jest.fn().mockImplementation(async (id: string) => {
        if (id === staleAccountId) {
          return null;
        }
        if (id === disconnectedIdentityId) {
          return { id: disconnectedIdentityId, status: 'disconnected' };
        }
        return { id, status: 'connected' };
      }),
      mapAccountStatus: jest.fn().mockImplementation((account: { id?: string }) =>
        account.id === disconnectedIdentityId ? 'disconnected' : 'connected',
      ),
      listAllLinkedinAccountsFromUnipileApi: jest
        .fn()
        .mockResolvedValue({ accounts: [] }),
      makeUnipileRequest: jest.fn().mockResolvedValue({
        data: { id: accountId },
      }),
    };

    const memberLinkedinUnipileConnectionService = {
      withMemberLinkedinConnectLock: jest.fn(
        async (_memberId: string, run: () => Promise<unknown>) => run(),
      ),
      findUsableLinkedinAccountForMember: jest.fn().mockResolvedValue(undefined),
      findLinkedinAccountSameIdentityForMember: jest
        .fn()
        .mockResolvedValue(identityMatch),
      clearStaleStoredLinkedinAccountIdIfNeeded: jest
        .fn()
        .mockResolvedValue(options?.staleProfileAccountCleared ?? true),
      cleanupUnusableStoredLinkedinAccountIfNeeded: jest.fn(),
      syncMemberLinkedinAccountAfterConnect: jest
        .fn()
        .mockImplementation(async (_m: string, _t: string, id: string) => id),
    };

    const service = new LinkedinUnipileMemberAccountResolverService(
      workspaceMemberProfileUnipileService as never,
      linkedinUnipileRequestService as never,
      memberLinkedinUnipileConnectionService as never,
    );

    return {
      service,
      linkedinUnipileRequestService,
      memberLinkedinUnipileConnectionService,
      workspaceMemberProfileUnipileService,
    };
  };

  it('omits reconnect_account when stale profile account id was cleared', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      memberLinkedinUnipileConnectionService,
    } = createService({
      storedAccountId: staleAccountId,
      identityMatch: {
        id: disconnectedIdentityId,
        status: 'disconnected',
      },
      staleProfileAccountCleared: true,
    });

    const result = await service.resolveMemberLinkedinUnipileAccount({
      workspaceId,
      workspaceMemberId,
      authToken,
      reconnectSourceToken: 'li-at-token',
      reconnectLogContext: 'test',
    });

    expect(
      memberLinkedinUnipileConnectionService.clearStaleStoredLinkedinAccountIdIfNeeded,
    ).toHaveBeenCalledWith(
      workspaceMemberId,
      authToken,
      staleAccountId,
      workspaceId,
    );
    expect(linkedinUnipileRequestService.makeUnipileRequest).toHaveBeenCalledWith(
      '/api/v1/accounts',
      'POST',
      expect.not.objectContaining({
        reconnect_account: expect.anything(),
      }),
      { returnStatus: true },
    );
    expect(result).toMatchObject({
      accountId,
      resolution: 'cookie_reconnect',
      staleProfileAccountCleared: true,
    });
  });

  it('reuses stored connected account without POST /accounts', async () => {
    const activeAccountId = 'active-account';
    const { service, linkedinUnipileRequestService } = createService({
      storedAccountId: activeAccountId,
    });

    linkedinUnipileRequestService.fetchAccountByIdIfExists.mockResolvedValue({
      id: activeAccountId,
      status: 'connected',
    });

    const result = await service.resolveMemberLinkedinUnipileAccount({
      workspaceId,
      workspaceMemberId,
      authToken,
      reconnectSourceToken: 'li-at-token',
    });

    expect(linkedinUnipileRequestService.makeUnipileRequest).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      accountId: activeAccountId,
      resolution: 'stored_profile',
      reconnectAttempted: false,
    });
  });

  it('clears stored LinkedIn cookies when reconnect POST /accounts returns invalid credentials', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
    } = createService();

    linkedinUnipileRequestService.makeUnipileRequest.mockRejectedValue(
      new HttpException(
        'The provided credentials are invalid.',
        HttpStatus.UNAUTHORIZED,
      ),
    );

    const result = await service.resolveMemberLinkedinUnipileAccount({
      workspaceId,
      workspaceMemberId,
      authToken,
      reconnectSourceToken: 'li-at-token',
      reconnectLogContext: 'test',
    });

    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinCookieTokens,
    ).toHaveBeenCalledWith(authToken, workspaceMemberId);
    expect(result).toMatchObject({
      accountId: null,
      reconnectAttempted: true,
      reconnectSucceeded: false,
      reconnectMessage: 'The provided credentials are invalid.',
    });
  });
});

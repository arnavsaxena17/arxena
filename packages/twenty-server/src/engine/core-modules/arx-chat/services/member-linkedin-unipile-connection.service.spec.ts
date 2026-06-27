import { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';

describe('MemberLinkedinUnipileConnectionService', () => {
  const workspaceMemberId = 'member-1';
  const authToken = 'auth-token';
  const staleAccountId = 'stale-unipile-account';

  const createService = (options?: {
    fetchAccountResult?: Record<string, unknown> | null;
    mappedStatus?: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required';
  }) => {
    const linkedinUnipileRequestService = {
      fetchAccountByIdIfExists: jest
        .fn()
        .mockResolvedValue(options?.fetchAccountResult ?? null),
      mapAccountStatus: jest
        .fn()
        .mockReturnValue(options?.mappedStatus ?? 'connected'),
      listAllLinkedinAccountsFromUnipileApi: jest
        .fn()
        .mockResolvedValue({ accounts: [] }),
      disconnectAccountBestEffort: jest.fn(),
      clearLinkedinUnipileAccountFromCaches: jest.fn(),
    };

    const workspaceQueryService = {
      deleteUnipileMemberAccountMapping: jest.fn(),
    };

    const workspaceMemberProfileUnipileService = {
      getWorkspaceMemberProfileUnipileFields: jest.fn().mockResolvedValue({
        linkedinUrl: 'https://www.linkedin.com/in/test',
        linkedinUnipileAccountId: staleAccountId,
        whatsappUnipileAccountId: null,
        phoneNumber: null,
      }),
      getWorkspaceMemberUnipileAccountId: jest.fn().mockResolvedValue(staleAccountId),
      clearWorkspaceMemberUnipileAccountId: jest.fn(),
      clearWorkspaceMemberLinkedinUnipileData: jest.fn(),
    };

    const service = new MemberLinkedinUnipileConnectionService(
      linkedinUnipileRequestService as never,
      {} as never,
      workspaceMemberProfileUnipileService as never,
      workspaceQueryService as never,
    );

    return {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
      workspaceQueryService,
    };
  };

  it('clearStaleStoredLinkedinAccountIdIfNeeded clears profile when Unipile returns 404', async () => {
    const { service, linkedinUnipileRequestService, workspaceMemberProfileUnipileService } =
      createService();

    const cleared = await service.clearStaleStoredLinkedinAccountIdIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
    );

    expect(cleared).toBe(true);
    expect(
      linkedinUnipileRequestService.fetchAccountByIdIfExists,
    ).toHaveBeenCalledWith(staleAccountId, { bypassSnapshot: true });
    expect(
      linkedinUnipileRequestService.clearLinkedinUnipileAccountFromCaches,
    ).toHaveBeenCalledWith(staleAccountId);
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('cleanupStoredLinkedinAccountAfterNotFoundApiError clears profile and caches without disconnecting', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
    } = createService();

    await service.cleanupStoredLinkedinAccountAfterNotFoundApiError({
      accountId: staleAccountId,
      workspaceMemberId,
      authToken,
      context: 'LinkedIn profile/me',
    });

    expect(
      linkedinUnipileRequestService.disconnectAccountBestEffort,
    ).not.toHaveBeenCalled();
    expect(
      linkedinUnipileRequestService.clearLinkedinUnipileAccountFromCaches,
    ).toHaveBeenCalledWith(staleAccountId);
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('cleanupUnusableStoredLinkedinAccountIfNeeded disconnects disconnected accounts', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
      workspaceQueryService,
    } = createService({
      fetchAccountResult: { id: staleAccountId, status: 'disconnected' },
      mappedStatus: 'disconnected',
    });

    const cleared = await service.cleanupUnusableStoredLinkedinAccountIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
      'test disconnected cleanup',
      'workspace-1',
    );

    expect(cleared).toBe(true);
    expect(
      linkedinUnipileRequestService.disconnectAccountBestEffort,
    ).toHaveBeenCalledWith(staleAccountId, 'test disconnected cleanup');
    expect(
      workspaceQueryService.deleteUnipileMemberAccountMapping,
    ).toHaveBeenCalledWith(workspaceMemberId, 'LINKEDIN');
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('clearStaleStoredLinkedinAccountIdIfNeeded is a no-op when account is connected', async () => {
    const { service, workspaceMemberProfileUnipileService } = createService({
      fetchAccountResult: { id: staleAccountId },
      mappedStatus: 'connected',
    });

    const cleared = await service.clearStaleStoredLinkedinAccountIdIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
    );

    expect(cleared).toBe(false);
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).not.toHaveBeenCalled();
  });

  it('cleanupUnusableStoredLinkedinAccountIfNeeded skips in-flight connecting accounts', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
    } = createService({
      fetchAccountResult: {
        id: staleAccountId,
        sources: [{ status: 'CONNECTING' }],
      },
      mappedStatus: 'pending',
    });

    const cleared = await service.cleanupUnusableStoredLinkedinAccountIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
      'test connecting cleanup',
      'workspace-1',
    );

    expect(cleared).toBe(false);
    expect(
      linkedinUnipileRequestService.disconnectAccountBestEffort,
    ).not.toHaveBeenCalled();
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).not.toHaveBeenCalled();
  });

  it('getValidatedWorkspaceMemberProfileFields returns profile without stale account id', async () => {
    const { service } = createService();

    const profile = await service.getValidatedWorkspaceMemberProfileFields(
      workspaceMemberId,
      authToken,
    );

    expect(profile?.linkedinUnipileAccountId).toBeNull();
  });

  it('disconnectMemberLinkedinUnipileAccount deletes from Unipile and clears stored profile id', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
      workspaceQueryService,
    } = createService();

    await service.disconnectMemberLinkedinUnipileAccount({
      accountId: staleAccountId,
      context: 'test disconnect',
      workspaceMemberId,
      workspaceId: 'workspace-1',
      authToken,
    });

    expect(
      linkedinUnipileRequestService.disconnectAccountBestEffort,
    ).toHaveBeenCalledWith(staleAccountId, 'test disconnect');
    expect(
      workspaceQueryService.deleteUnipileMemberAccountMapping,
    ).toHaveBeenCalledWith(workspaceMemberId, 'LINKEDIN');
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged tears down stored account', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberProfileUnipileService,
      workspaceQueryService,
    } = createService();

    const disconnected =
      await service.disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged(
        {
          workspaceMemberId,
          workspaceId: 'workspace-1',
          authToken,
          storedAccountId: staleAccountId,
        },
      );

    expect(disconnected).toBe(true);
    expect(
      linkedinUnipileRequestService.disconnectAccountBestEffort,
    ).toHaveBeenCalledWith(
      staleAccountId,
      'LinkedIn li_a cookie newly acquired while li_at unchanged',
    );
    expect(
      linkedinUnipileRequestService.clearLinkedinUnipileAccountFromCaches,
    ).toHaveBeenCalledWith(staleAccountId);
    expect(
      workspaceQueryService.deleteUnipileMemberAccountMapping,
    ).toHaveBeenCalledWith(workspaceMemberId, 'LINKEDIN');
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged is a no-op without stored account id', async () => {
    const { service, linkedinUnipileRequestService } = createService();

    const disconnected =
      await service.disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged(
        {
          workspaceMemberId,
          workspaceId: 'workspace-1',
          authToken,
          storedAccountId: null,
        },
      );

    expect(disconnected).toBe(false);
    expect(
      linkedinUnipileRequestService.disconnectAccountBestEffort,
    ).not.toHaveBeenCalled();
  });
});

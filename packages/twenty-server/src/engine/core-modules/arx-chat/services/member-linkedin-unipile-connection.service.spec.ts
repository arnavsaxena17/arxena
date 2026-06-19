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
    const { service, workspaceMemberProfileUnipileService } = createService();

    const cleared = await service.clearStaleStoredLinkedinAccountIdIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
    );

    expect(cleared).toBe(true);
    expect(
      workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken, 'linkedin');
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
      workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken, 'linkedin');
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
      workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId,
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
      workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken, 'linkedin');
  });
});

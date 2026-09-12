import { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';

describe('MemberLinkedinUnipileConnectionService', () => {
  const workspaceMemberId = 'member-1';
  const authToken = 'auth-token';
  const staleAccountId = 'stale-unipile-account';

  const createService = (options?: {
    fetchAccountResult?: Record<string, unknown> | null;
    mappedStatus?: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required';
  }) => {
    const fetchAccountResult = options?.fetchAccountResult ?? null;
    const linkedinUnipileRequestService = {
      fetchAccountByIdIfExists: jest.fn().mockResolvedValue(fetchAccountResult),
      lookupAccountById: jest.fn().mockResolvedValue(
        fetchAccountResult
          ? { status: 'found', account: fetchAccountResult }
          : { status: 'not_found' },
      ),
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

    const workspaceMemberUnipileService = {
      getWorkspaceMemberUnipileFields: jest.fn().mockResolvedValue({
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
      workspaceMemberUnipileService as never,
      workspaceQueryService as never,
    );

    return {
      service,
      linkedinUnipileRequestService,
      workspaceMemberUnipileService,
      workspaceQueryService,
    };
  };

  it('clearStaleStoredLinkedinAccountIdIfNeeded clears profile when Unipile returns 404', async () => {
    const { service, linkedinUnipileRequestService, workspaceMemberUnipileService } =
      createService();

    const cleared = await service.clearStaleStoredLinkedinAccountIdIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
    );

    expect(cleared).toBe(true);
    expect(
      linkedinUnipileRequestService.lookupAccountById,
    ).toHaveBeenCalledWith(staleAccountId, { bypassSnapshot: true });
    expect(
      linkedinUnipileRequestService.clearLinkedinUnipileAccountFromCaches,
    ).toHaveBeenCalledWith(staleAccountId);
    expect(
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('cleanupStoredLinkedinAccountAfterNotFoundApiError clears profile and caches without disconnecting', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberUnipileService,
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
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('cleanupUnusableStoredLinkedinAccountIfNeeded disconnects disconnected accounts', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberUnipileService,
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
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('clearStaleStoredLinkedinAccountIdIfNeeded is a no-op when account is connected', async () => {
    const { service, workspaceMemberUnipileService } = createService({
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
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).not.toHaveBeenCalled();
  });

  it('cleanupUnusableStoredLinkedinAccountIfNeeded skips in-flight connecting accounts', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberUnipileService,
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
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).not.toHaveBeenCalled();
  });

  it('clearStaleStoredLinkedinAccountIdIfNeeded keeps the profile when Unipile lookup is unavailable', async () => {
    const { service, linkedinUnipileRequestService, workspaceMemberUnipileService } =
      createService();
    linkedinUnipileRequestService.lookupAccountById.mockResolvedValue({
      status: 'unavailable',
      reason: '503 Service Unavailable',
    });

    const cleared = await service.clearStaleStoredLinkedinAccountIdIfNeeded(
      workspaceMemberId,
      authToken,
      staleAccountId,
    );

    expect(cleared).toBe(false);
    expect(
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).not.toHaveBeenCalled();
  });

  it('getValidatedWorkspaceMemberUnipileFields returns profile without stale account id', async () => {
    const { service } = createService();

    const profile = await service.getValidatedWorkspaceMemberUnipileFields(
      workspaceMemberId,
      authToken,
    );

    expect(profile?.linkedinUnipileAccountId).toBeNull();
  });

  it('disconnectMemberLinkedinUnipileAccount deletes from Unipile and clears stored profile id', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberUnipileService,
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
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
    ).toHaveBeenCalledWith(workspaceMemberId, authToken);
  });

  it('disconnectStoredLinkedinAccountWhenLiAChangedWhileLiAtUnchanged tears down stored account', async () => {
    const {
      service,
      linkedinUnipileRequestService,
      workspaceMemberUnipileService,
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
      workspaceMemberUnipileService.clearWorkspaceMemberLinkedinUnipileData,
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

  describe('isWhatsappConnectedForProfile backfill', () => {
    const workspace = { id: 'workspace-1' } as never;
    const matchedAccountId = 'pWhQlMmoTfWsCSI_6oWkfA';
    const profilePhone = '+918411937769';
    const unipilePhone = '918411937769';

    const createWhatsappService = () => {
      const whatsappUnipileRequestService = {
        fetchAccountByIdIfExists: jest.fn().mockResolvedValue({
          id: matchedAccountId,
          connection_params: { im: { phone_number: unipilePhone } },
          sources: [{ status: 'OK' }],
        }),
        getAllAccounts: jest.fn().mockResolvedValue({
          accounts: [
            {
              id: matchedAccountId,
              connection_params: { im: { phone_number: unipilePhone } },
              sources: [{ status: 'OK' }],
            },
          ],
        }),
        mapAccountStatus: jest.fn().mockReturnValue('connected'),
      };

      const workspaceMemberUnipileService = {
        applyUnipileAccountToWorkspaceMember: jest.fn(),
        updateWorkspaceMemberUnipileAccountId: jest.fn(),
      };

      const service = new MemberLinkedinUnipileConnectionService(
        {} as never,
        whatsappUnipileRequestService as never,
        workspaceMemberUnipileService as never,
        {} as never,
      );

      return {
        service,
        whatsappUnipileRequestService,
        workspaceMemberUnipileService,
      };
    };

    it('persists whatsappUnipileAccountId when phone matches a connected account and stored id is missing', async () => {
      const {
        service,
        workspaceMemberUnipileService,
        whatsappUnipileRequestService,
      } = createWhatsappService();

      const profile = {
        phoneNumber: profilePhone,
        linkedinUrl: null,
        whatsappUnipileAccountId: null,
        linkedinUnipileAccountId: null,
      };

      const connected = await service.isWhatsappConnectedForProfile(
        profile,
        workspace,
        { workspaceMemberId, authToken },
      );

      expect(connected).toBe(true);
      expect(
        workspaceMemberUnipileService.applyUnipileAccountToWorkspaceMember,
      ).toHaveBeenCalledWith(
        workspaceMemberId,
        authToken,
        'whatsapp',
        matchedAccountId,
        expect.objectContaining({ id: matchedAccountId }),
      );
      expect(profile.whatsappUnipileAccountId).toBe(matchedAccountId);
      expect(whatsappUnipileRequestService.getAllAccounts).toHaveBeenCalled();
    });

    it('does not persist when Unipile status is not connected', async () => {
      const {
        service,
        workspaceMemberUnipileService,
        whatsappUnipileRequestService,
      } = createWhatsappService();
      whatsappUnipileRequestService.mapAccountStatus.mockReturnValue(
        'connecting',
      );

      const profile = {
        phoneNumber: profilePhone,
        linkedinUrl: null,
        whatsappUnipileAccountId: null,
        linkedinUnipileAccountId: null,
      };

      const connected = await service.isWhatsappConnectedForProfile(
        profile,
        workspace,
        { workspaceMemberId, authToken },
      );

      expect(connected).toBe(false);
      expect(
        workspaceMemberUnipileService.applyUnipileAccountToWorkspaceMember,
      ).not.toHaveBeenCalled();
    });

    it('does not persist when already stored correctly', async () => {
      const {
        service,
        workspaceMemberUnipileService,
        whatsappUnipileRequestService,
      } = createWhatsappService();

      const profile = {
        phoneNumber: profilePhone,
        linkedinUrl: null,
        whatsappUnipileAccountId: matchedAccountId,
        linkedinUnipileAccountId: null,
      };

      const connected = await service.isWhatsappConnectedForProfile(
        profile,
        workspace,
        { workspaceMemberId, authToken },
      );

      expect(connected).toBe(true);
      expect(
        workspaceMemberUnipileService.applyUnipileAccountToWorkspaceMember,
      ).not.toHaveBeenCalled();
      expect(
        whatsappUnipileRequestService.getAllAccounts,
      ).not.toHaveBeenCalled();
    });
  });
});

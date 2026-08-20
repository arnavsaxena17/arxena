import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import type { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import type { LinkedinSenderFullProfileCacheEntry } from 'src/engine/core-modules/arx-chat/types/linkedin-sender-profile-cache.types';

describe('LinkedinUnipileRequestService sender profile persistence', () => {
  const cleanupContext = {
    accountId: 'account-1',
    workspaceMemberId: 'member-1',
    workspaceId: 'workspace-1',
    authToken: 'token-1',
    context: 'test',
  };

  const buildService = (overrides?: {
    storedProfile?: Record<string, unknown> | null;
    getWorkspaceMemberLinkedinProfile?: jest.Mock;
    saveWorkspaceMemberLinkedinProfile?: jest.Mock;
    makeUnipileRequest?: jest.Mock;
  }) => {
    const workspaceMemberProfileUnipileService = {
      getWorkspaceMemberLinkedinProfile:
        overrides?.getWorkspaceMemberLinkedinProfile ??
        jest.fn().mockResolvedValue(overrides?.storedProfile ?? null),
      saveWorkspaceMemberLinkedinProfile:
        overrides?.saveWorkspaceMemberLinkedinProfile ??
        jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<WorkspaceMemberProfileUnipileService>;

    const workspaceQueryService = {
      getWorkspaceKeys: jest.fn(),
    };

    const service = new LinkedinUnipileRequestService(
      workspaceQueryService as never,
      undefined,
      workspaceMemberProfileUnipileService as never,
    );

    if (overrides?.makeUnipileRequest) {
      jest
        .spyOn(service, 'makeUnipileRequest')
        .mockImplementation(overrides.makeUnipileRequest);
    }

    return { service, workspaceMemberProfileUnipileService };
  };

  it('returns stored sender profile without Unipile profile fetch', async () => {
    console.log('sender stored profile hit test: start');
    const storedEntry: LinkedinSenderFullProfileCacheEntry = {
      me: { public_identifier: 'saikrshna' },
      fullProfile: { headline: 'CHRO' },
      publicIdentifier: 'saikrshna',
      fetchedAt: new Date().toISOString(),
    };

    const makeUnipileRequest = jest.fn();
    const { service } = buildService({
      storedProfile: storedEntry,
      makeUnipileRequest,
    });

    const result = await service.fetchLinkedinSenderFullProfile('account-1', {
      cleanupContext,
    });

    expect(result?.fromCache).toBe(true);
    expect(result?.entry.publicIdentifier).toBe('saikrshna');
    expect(makeUnipileRequest).not.toHaveBeenCalled();
    console.log('sender stored profile hit test: success', result);
  });

  it('fetches and stores sender profile when workspace member profile is empty', async () => {
    console.log('sender stored profile miss test: start');
    const makeUnipileRequest = jest
      .fn()
      .mockResolvedValueOnce({
        public_identifier: 'saikrshna',
        first_name: 'Sai',
        last_name: 'Varma',
      })
      .mockResolvedValueOnce({
        headline: 'CHRO @ RYT Advisory',
        summary: 'HR leader',
      });

    const saveWorkspaceMemberLinkedinProfile = jest
      .fn()
      .mockResolvedValue(undefined);

    const { service } = buildService({
      saveWorkspaceMemberLinkedinProfile,
      makeUnipileRequest,
    });

    const result = await service.fetchLinkedinSenderFullProfile('account-1', {
      cleanupContext,
    });

    expect(result?.fromCache).toBe(false);
    expect(makeUnipileRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/users/saikrshna'),
      'GET',
      undefined,
      expect.any(Object),
    );
    expect(saveWorkspaceMemberLinkedinProfile).toHaveBeenCalledWith(
      'member-1',
      'token-1',
      expect.objectContaining({ publicIdentifier: 'saikrshna' }),
    );
    console.log('sender stored profile miss test: success', result);
  });

  it('bypasses stored profile when refresh=true', async () => {
    console.log('sender stored profile refresh test: start');
    const storedEntry: LinkedinSenderFullProfileCacheEntry = {
      me: { public_identifier: 'saikrshna' },
      fullProfile: { headline: 'Old headline' },
      publicIdentifier: 'saikrshna',
      fetchedAt: new Date().toISOString(),
    };

    const makeUnipileRequest = jest
      .fn()
      .mockResolvedValueOnce({
        public_identifier: 'saikrshna',
      })
      .mockResolvedValueOnce({ headline: 'Updated headline' });

    const { service } = buildService({
      storedProfile: storedEntry,
      makeUnipileRequest,
    });

    const result = await service.fetchLinkedinSenderFullProfile('account-1', {
      cleanupContext,
      refresh: true,
    });

    expect(result?.fromCache).toBe(false);
    expect(makeUnipileRequest).toHaveBeenCalled();
    console.log('sender stored profile refresh test: success', result);
  });
});

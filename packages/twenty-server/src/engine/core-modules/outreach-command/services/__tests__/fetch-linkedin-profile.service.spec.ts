import { FetchLinkedinProfileService } from '../fetch-linkedin-profile.service';

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('FetchLinkedinProfileService', () => {
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };
  const linkedinUnipileRequestService = {
    fetchLinkedinUserProfile: jest.fn(),
  };
  const linkedinProviderIdStore = {
    saveProviderId: jest.fn().mockResolvedValue(undefined),
  };
  const featureFlagService = {
    isFeatureEnabled: jest.fn().mockResolvedValue(false),
  };

  const service = new FetchLinkedinProfileService(
    globalWorkspaceOrmManager as never,
    linkedinUnipileRequestService as never,
    linkedinProviderIdStore as never,
    featureFlagService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    linkedinProviderIdStore.saveProviderId.mockResolvedValue(undefined);
    featureFlagService.isFeatureEnabled.mockResolvedValue(false);
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: 'jane-doe',
      workspaceMemberId: 'member-1',
    });
  });

  it('saves Unipile provider_id onto linkedinProfileId, not the public URL', async () => {
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      provider_id: VALID_PROVIDER_ID,
      public_identifier: 'jane-doe',
      first_name: 'Jane',
      last_name: 'Doe',
      profile_url: 'https://www.linkedin.com/in/jane-doe',
      connections_count: 885,
      follower_count: 1269,
      shared_connections_count: 1,
      network_distance: 'SECOND_DEGREE',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { candidateId: 'cand-1', linkedinProfileId: 'jane-doe' },
      }),
    ).resolves.toMatchObject({
      success: true,
      linkedinProfileId: VALID_PROVIDER_ID,
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
      connectionsCount: 885,
      followersCount: 1269,
      sharedConnectionsCount: 1,
      networkDistance: 'SECOND_DEGREE',
      people: [
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
          linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
          linkedinProfileId: VALID_PROVIDER_ID,
          connectionsCount: 885,
          followersCount: 1269,
          sharedConnectionsCount: 1,
          networkDistance: 'SECOND_DEGREE',
        }),
      ],
    });
    expect(linkedinProviderIdStore.saveProviderId).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      identifier: 'jane-doe',
      providerId: VALID_PROVIDER_ID,
    });
  });

  it('does not persist a public slug when Unipile omits provider_id', async () => {
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      public_identifier: 'jane-doe',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { candidateId: 'cand-1', linkedinProfileId: 'jane-doe' },
      }),
    ).resolves.toMatchObject({
      linkedinProfileId: 'jane-doe',
    });
    expect(linkedinProviderIdStore.saveProviderId).not.toHaveBeenCalled();
  });

  it('stamps profile facts onto outreachProspectEnrichment', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const findOne = jest
      .fn()
      .mockResolvedValue({ outreachProspectEnrichment: null });
    let workspaceContextCalls = 0;

    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => {
        workspaceContextCalls += 1;

        if (workspaceContextCalls === 1) {
          return {
            accountId: 'acc-1',
            identifier: 'jane-doe',
            workspaceMemberId: 'member-1',
          };
        }

        return callback();
      },
    );
    globalWorkspaceOrmManager.getRepository.mockResolvedValue({
      findOne,
      update,
    });
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      provider_id: VALID_PROVIDER_ID,
      first_name: 'Jane',
      last_name: 'Doe',
      headline: 'CFO at Acme',
      experience: [
        {
          company: 'Acme',
          position: 'CFO',
          end: '',
        },
      ],
    });

    const result = await service.execute({
      workspaceId: 'ws-1',
      input: { candidateId: 'cand-1', linkedinProfileId: 'jane-doe' },
    });

    expect(update).toHaveBeenCalledWith('cand-1', {
      outreachProspectEnrichment: {
        first_name: 'Jane',
        company_short: 'Acme',
        hooks: [
          { text: 'CFO at Acme', source: 'profile' },
          { text: 'CFO @ Acme', source: 'profile' },
        ],
      },
    });
    expect(result.outreachProspectEnrichment).toEqual({
      first_name: 'Jane',
      company_short: 'Acme',
      hooks: [
        { text: 'CFO at Acme', source: 'profile' },
        { text: 'CFO @ Acme', source: 'profile' },
      ],
    });
  });

  it('keeps a qualify stamp when the profile is fetched again', async () => {
    const qualifyStamp = { go: true, score: 4, hooks: [] };
    const update = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue({
      outreachProspectEnrichment: qualifyStamp,
    });
    let workspaceContextCalls = 0;

    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => {
        workspaceContextCalls += 1;

        if (workspaceContextCalls === 1) {
          return {
            accountId: 'acc-1',
            identifier: 'jane-doe',
            workspaceMemberId: 'member-1',
          };
        }

        return callback();
      },
    );
    globalWorkspaceOrmManager.getRepository.mockResolvedValue({
      findOne,
      update,
    });
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      provider_id: VALID_PROVIDER_ID,
      first_name: 'Jane',
    });

    const result = await service.execute({
      workspaceId: 'ws-1',
      input: { candidateId: 'cand-1', linkedinProfileId: 'jane-doe' },
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.outreachProspectEnrichment).toEqual(qualifyStamp);
  });
});

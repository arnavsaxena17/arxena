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

  const service = new FetchLinkedinProfileService(
    globalWorkspaceOrmManager as never,
    linkedinUnipileRequestService as never,
    linkedinProviderIdStore as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    linkedinProviderIdStore.saveProviderId.mockResolvedValue(undefined);
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
      people: [
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
          linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
          linkedinProfileId: VALID_PROVIDER_ID,
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
});

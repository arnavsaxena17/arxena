import { FeatureFlagKey } from 'twenty-shared/types';

import { VisitLinkedinProfileService } from '../visit-linkedin-profile.service';

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('VisitLinkedinProfileService', () => {
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

  const service = new VisitLinkedinProfileService(
    globalWorkspaceOrmManager as never,
    linkedinUnipileRequestService as never,
    linkedinProviderIdStore as never,
    featureFlagService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    featureFlagService.isFeatureEnabled.mockResolvedValue(false);
    linkedinProviderIdStore.saveProviderId.mockResolvedValue(undefined);
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: 'jane-doe',
      workspaceMemberId: 'member-1',
    });
  });

  it('visits with notify=true and empty linkedinSections', async () => {
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      provider_id: VALID_PROVIDER_ID,
      public_identifier: 'jane-doe',
      first_name: 'Jane',
      last_name: 'Doe',
      headline: 'VP Talent',
      profile_url: 'https://www.linkedin.com/in/jane-doe',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { candidateId: 'cand-1', linkedinProfileId: 'jane-doe' },
      }),
    ).resolves.toMatchObject({
      success: true,
      visited: true,
      linkedinProfileId: VALID_PROVIDER_ID,
      firstName: 'Jane',
      lastName: 'Doe',
      headline: 'VP Talent',
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
      error: '',
    });

    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).toHaveBeenCalledWith('acc-1', 'jane-doe', {
      notify: true,
      linkedinSections: [],
    });
    expect(linkedinProviderIdStore.saveProviderId).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      identifier: 'jane-doe',
      providerId: VALID_PROVIDER_ID,
    });
  });

  it('returns error when Unipile account is missing', async () => {
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: '',
      identifier: 'jane-doe',
      workspaceMemberId: '',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { linkedinProfileId: 'jane-doe' },
      }),
    ).resolves.toMatchObject({
      success: false,
      visited: false,
      error: 'No LinkedIn Unipile account on workspace member profile',
    });
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).not.toHaveBeenCalled();
  });

  it('returns error when identifier is missing', async () => {
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: '',
      workspaceMemberId: 'member-1',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {},
      }),
    ).resolves.toMatchObject({
      success: false,
      visited: false,
      error: 'linkedinUrl or linkedinProfileId is required',
    });
  });

  it('returns mock visit when outreach mock Unipile flag is enabled', async () => {
    featureFlagService.isFeatureEnabled.mockImplementation(
      async (key: FeatureFlagKey) =>
        key === FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { linkedinProfileId: 'mock-person' },
      }),
    ).resolves.toMatchObject({
      success: true,
      visited: true,
      linkedinProfileId: 'mock-person',
      error: '',
    });
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).not.toHaveBeenCalled();
  });
});

import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { AcceptLinkedinReceivedInvitationTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/accept-linkedin-received-invitation-tool';

describe('AcceptLinkedinReceivedInvitationTool', () => {
  let tool: AcceptLinkedinReceivedInvitationTool;
  let fetchLinkedinInvitationsReceived: jest.Mock;
  let handleLinkedinInvitationReceived: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    fetchLinkedinInvitationsReceived = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'invite-1',
          inviter: {
            inviter_id: 'ACoAAAJane',
            inviter_public_identifier: 'jane-doe',
          },
          specifics: {
            provider: 'LINKEDIN',
            shared_secret: 'secret-1',
          },
        },
      ],
    });
    handleLinkedinInvitationReceived = jest.fn().mockResolvedValue({
      object: 'UserInvitationHandled',
      status: 'ACCEPTED',
    });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptLinkedinReceivedInvitationTool,
        {
          provide: LinkedinUnipileRequestService,
          useValue: {
            fetchLinkedinInvitationsReceived,
            handleLinkedinInvitationReceived,
          },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(AcceptLinkedinReceivedInvitationTool);
  });

  it('returns error when no prospect identifiers are provided', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: '',
        linkedinPublicIdentifier: '',
        providerId: '',
        linkedinUrl: '',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('linkedinProfileId');
  });

  it('accepts a matching received invitation via Unipile', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinPublicIdentifier: 'Jane-Doe',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(handleLinkedinInvitationReceived).toHaveBeenCalledWith(
      'acc-1',
      'invite-1',
      'secret-1',
      'accept',
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        matched: true,
        accepted: true,
        invitationId: 'invite-1',
        status: 'ACCEPTED',
      }),
    );
  });

  it('returns matched=false when invitation is not found', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        providerId: 'ACoOther',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(handleLinkedinInvitationReceived).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        matched: false,
        accepted: false,
      }),
    );
  });

  it('returns mock accepted result when mock Unipile is enabled', async () => {
    isFeatureEnabled.mockImplementation(
      async (key: FeatureFlagKey) =>
        key === FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
    );

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(fetchLinkedinInvitationsReceived).not.toHaveBeenCalled();
    expect(handleLinkedinInvitationReceived).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        mock: true,
        matched: true,
        accepted: true,
      }),
    );
  });
});

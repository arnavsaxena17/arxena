import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { SendLinkedinConnectionRequestTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-connection-request-tool';
import { OUTREACH_MOCK_UNIPILE_CONNECTION_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import { createLinkedinUnipileMessagingServiceForTools } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';

jest.mock(
  'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util',
  () => {
    const actual = jest.requireActual(
      'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util',
    );

    return {
      ...actual,
      createLinkedinUnipileMessagingServiceForTools: jest.fn(),
    };
  },
);

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('SendLinkedinConnectionRequestTool', () => {
  let tool: SendLinkedinConnectionRequestTool;
  let findCandidate: jest.Mock;
  let resolveForSend: jest.Mock;
  let sendInvitation: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    findCandidate = jest.fn().mockResolvedValue({
      id: 'cand-1',
      outreachSequenceStage: 'QUEUED',
    });
    resolveForSend = jest.fn().mockResolvedValue(VALID_PROVIDER_ID);
    sendInvitation = jest.fn().mockResolvedValue({ id: 'invite-1' });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    (
      createLinkedinUnipileMessagingServiceForTools as jest.Mock
    ).mockReturnValue({
      resolveProviderId: jest.fn(),
      sendInvitation,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendLinkedinConnectionRequestTool,
        {
          provide: LinkedinProviderIdStoreService,
          useValue: { findCandidate, resolveForSend },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(SendLinkedinConnectionRequestTool);
  });

  it('does not send when outreachSequenceStage is already CONNECTION_SENT', async () => {
    findCandidate.mockResolvedValue({
      id: 'cand-1',
      outreachSequenceStage: 'CONNECTION_SENT',
    });

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        message: 'Hi',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result).toEqual({
      success: false,
      message: 'Failed to send LinkedIn connection request',
      error: 'A connection request has already been sent to this recipient.',
    });
    expect(sendInvitation).not.toHaveBeenCalled();
    expect(resolveForSend).not.toHaveBeenCalled();
  });

  it('sends when the candidate is still QUEUED', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        message: 'Hi',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(sendInvitation).toHaveBeenCalledWith(
      'acc-1',
      'jane-doe',
      'Hi',
      VALID_PROVIDER_ID,
    );
  });

  it('returns mock success without calling Unipile when workspace flag is on', async () => {
    isFeatureEnabled.mockResolvedValue(true);

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        message: 'Hi',
      },
      { workspaceId: 'ws-1' },
    );

    expect(isFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
      'ws-1',
    );
    expect(result).toEqual({
      success: true,
      message: 'LinkedIn connection request sent successfully',
      result: {
        mock: true,
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        message: 'Hi',
        response: { id: OUTREACH_MOCK_UNIPILE_CONNECTION_RESPONSE_ID },
      },
    });
    expect(sendInvitation).not.toHaveBeenCalled();
    expect(resolveForSend).not.toHaveBeenCalled();
    expect(createLinkedinUnipileMessagingServiceForTools).not.toHaveBeenCalled();
  });
});

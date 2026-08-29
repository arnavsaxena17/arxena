import { Test, type TestingModule } from '@nestjs/testing';

import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { SendLinkedinConnectionRequestTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-connection-request-tool';
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

  beforeEach(async () => {
    jest.clearAllMocks();

    findCandidate = jest.fn().mockResolvedValue({
      id: 'cand-1',
      outreachSequenceStage: 'QUEUED',
    });
    resolveForSend = jest.fn().mockResolvedValue(VALID_PROVIDER_ID);
    sendInvitation = jest.fn().mockResolvedValue({ id: 'invite-1' });

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
});

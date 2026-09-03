import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { SendLinkedinMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-message-tool';
import { OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import { createLinkedinUnipileMessagingServiceForTools } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { loadUnipileChatAttachments } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/load-unipile-chat-attachments.util';

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

jest.mock(
  'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/load-unipile-chat-attachments.util',
  () => ({
    loadUnipileChatAttachments: jest.fn().mockResolvedValue([]),
  }),
);

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('SendLinkedinMessageTool', () => {
  let tool: SendLinkedinMessageTool;
  let resolveForSend: jest.Mock;
  let sendMessage: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    resolveForSend = jest.fn().mockResolvedValue(VALID_PROVIDER_ID);
    sendMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    (
      createLinkedinUnipileMessagingServiceForTools as jest.Mock
    ).mockReturnValue({
      resolveProviderId: jest.fn(),
      sendMessage,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendLinkedinMessageTool,
        {
          provide: FileService,
          useValue: {},
        },
        {
          provide: LinkedinProviderIdStoreService,
          useValue: { resolveForSend },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(SendLinkedinMessageTool);
  });

  it('sends via Unipile when workspace mock flag is off', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        body: 'Hello',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(sendMessage).toHaveBeenCalled();
    expect(loadUnipileChatAttachments).toHaveBeenCalled();
  });

  it('returns mock success without calling Unipile when workspace flag is on', async () => {
    isFeatureEnabled.mockResolvedValue(true);

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        body: 'Hello',
      },
      { workspaceId: 'ws-1' },
    );

    expect(isFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
      'ws-1',
    );
    expect(result).toEqual({
      success: true,
      message: 'LinkedIn message sent successfully',
      result: {
        mock: true,
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        body: 'Hello',
        attachmentCount: 0,
        response: { id: OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID },
      },
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(resolveForSend).not.toHaveBeenCalled();
    expect(loadUnipileChatAttachments).not.toHaveBeenCalled();
    expect(createLinkedinUnipileMessagingServiceForTools).not.toHaveBeenCalled();
  });

  it('still requires unipileAccountId when mock flag is on', async () => {
    isFeatureEnabled.mockResolvedValue(true);

    const result = await tool.execute(
      {
        unipileAccountId: '',
        linkedinProfileId: 'jane-doe',
        body: 'Hello',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unipile account ID is required');
  });
});

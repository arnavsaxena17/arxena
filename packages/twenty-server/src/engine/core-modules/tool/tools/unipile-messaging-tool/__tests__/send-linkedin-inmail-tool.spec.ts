import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { SendLinkedinInmailTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-inmail-tool';
import { OUTREACH_MOCK_UNIPILE_INMAIL_RESPONSE_ID_PREFIX } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import { createLinkedinUnipileMessagingServiceForTools } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';

jest.mock(
  'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util',
  () => ({
    createLinkedinUnipileMessagingServiceForTools: jest.fn(),
    getUnipileToolErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
  }),
);

const VALID_CLASSIC_ID = 'ACoAAabcdefghij1234567890';
const VALID_SN_ID = 'ACwAAabcdefghij1234567890';

describe('SendLinkedinInmailTool', () => {
  let tool: SendLinkedinInmailTool;
  let resolveForSend: jest.Mock;
  let readStoredSalesNavigatorProviderId: jest.Mock;
  let saveSalesNavigatorProviderId: jest.Mock;
  let fetchLinkedinUserProfile: jest.Mock;
  let sendMessage: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    resolveForSend = jest.fn().mockResolvedValue(VALID_CLASSIC_ID);
    readStoredSalesNavigatorProviderId = jest.fn().mockResolvedValue('');
    saveSalesNavigatorProviderId = jest.fn().mockResolvedValue(undefined);
    fetchLinkedinUserProfile = jest.fn().mockResolvedValue({
      provider_id: VALID_SN_ID,
    });
    sendMessage = jest.fn().mockResolvedValue({
      object: 'ChatStarted',
      chat_id: 'chat-1',
      message_id: 'msg-1',
    });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    (
      createLinkedinUnipileMessagingServiceForTools as jest.Mock
    ).mockReturnValue({
      resolveProviderId: jest.fn(),
      sendMessage,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendLinkedinInmailTool,
        {
          provide: LinkedinProviderIdStoreService,
          useValue: {
            resolveForSend,
            readStoredSalesNavigatorProviderId,
            saveSalesNavigatorProviderId,
          },
        },
        {
          provide: LinkedinUnipileRequestService,
          useValue: { fetchLinkedinUserProfile },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(SendLinkedinInmailTool);
  });

  it('sends Sales Navigator InMail when mock flag is off', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        subject: 'Hello',
        body: 'InMail body',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(fetchLinkedinUserProfile).toHaveBeenCalledWith(
      'acc-1',
      VALID_CLASSIC_ID,
      {
        linkedinApi: 'sales_navigator',
        linkedinSections: [],
        notify: false,
      },
    );
    expect(sendMessage).toHaveBeenCalledWith(
      'acc-1',
      [VALID_SN_ID],
      'InMail body',
      undefined,
      undefined,
      undefined,
      'Hello',
      true,
      'sales_navigator',
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        linkedinProfileId: VALID_CLASSIC_ID,
        salesNavigatorProviderId: VALID_SN_ID,
      }),
    );
  });

  it('returns mock success without calling Unipile when workspace flag is on', async () => {
    isFeatureEnabled.mockResolvedValue(true);

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        subject: 'Hello',
        body: 'InMail body',
      },
      { workspaceId: 'ws-1' },
    );

    expect(isFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
      'ws-1',
    );
    expect(result.success).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(fetchLinkedinUserProfile).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        mock: true,
        response: expect.objectContaining({
          chat_id: expect.stringMatching(
            new RegExp(`^${OUTREACH_MOCK_UNIPILE_INMAIL_RESPONSE_ID_PREFIX}-`),
          ),
        }),
      }),
    );
  });
});

import { IncomingWhatsappMessages } from '../whatsapp-api/incoming-messages';
import { UnipileMessageWebhook } from '../../types/unipile-webhook.types';

const WORKSPACE_ID = '3ad8a5aa-614e-4c67-8b13-00970cd0a1fe';
const SCHEMA = 'workspace_3hf24vrzah6wgy539grubayv2';
const ACCOUNT_ID = 'QmUsTj5RTdKwLOo_otpTKQ';
const SENDER_PROVIDER_ID = 'ACoAABcv6F4BbI3EKA0ilSXukRqQxjzxrsVgOAo';
const PERSON_ID = 'a043961d-4ef4-4d45-92bf-870d762fa37c';
const CHAT_ID = 'eRGUQWRAW4WighgX_SwkXQ';

const buildPayload = (overrides: Partial<UnipileMessageWebhook> = {}) =>
  ({
    event: 'message_received',
    account_id: ACCOUNT_ID,
    account_type: 'LINKEDIN',
    account_info: {
      type: 'LINKEDIN',
      feature: 'classic',
      user_id: 'ACoAAASPIE0BK-8-8t-L2_zzNa8zFJP1ypx3V4s',
    },
    chat_id: CHAT_ID,
    message: 'Let us connect next week on Monday',
    message_id: 'fslZmjNAXIOVu41mgBPGKg',
    is_sender: false,
    sender: {
      attendee_id: 'UN_IgrjOU--ik2zO-u5rOg',
      attendee_provider_id: SENDER_PROVIDER_ID,
      attendee_name: 'Gautam Jatia',
      attendee_profile_url: `https://www.linkedin.com/in/${SENDER_PROVIDER_ID}`,
      attendee_public_identifier: null,
    },
    attendees: [],
    ...overrides,
  }) as unknown as UnipileMessageWebhook;

const buildService = () => {
  const executeWorkspaceRawQuery = jest.fn();

  const workspaceQueryService = {
    findWorkspaceIdByLinkedinUnipileAccountId: jest
      .fn()
      .mockResolvedValue(WORKSPACE_ID),
    getDataSourceSchema: jest.fn().mockReturnValue(SCHEMA),
    checkIfTableExists: jest.fn().mockResolvedValue(true),
    getWorkspaceKeys: jest.fn().mockResolvedValue({
      linkedin_profile_id: 'ACoAAASPIE0BK-8-8t-L2_zzNa8zFJP1ypx3V4s',
    }),
    executeWorkspaceRawQuery,
    getApiKeys: jest.fn().mockResolvedValue([]),
    apiKeyService: { generateApiKeyToken: jest.fn() },
  };

  const service = new IncomingWhatsappMessages(
    workspaceQueryService as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  );

  return { service, executeWorkspaceRawQuery };
};

describe('getApiKeyToUseFromLinkedinMessageReceived LinkedIn sender resolution', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Regression: LinkedIn outreach chat rows are written with personId and an
  // empty phoneFrom/phoneTo, so a phone-column match dropped every inbound
  // reply and the candidate never saw the response.
  it('finds the person by linkedinProfileId when the stored URL is a vanity slug', async () => {
    const { service, executeWorkspaceRawQuery } = buildService();

    executeWorkspaceRawQuery
      .mockResolvedValueOnce([{ id: PERSON_ID }])
      .mockResolvedValueOnce([
        {
          id: 'chat-row',
          personId: PERSON_ID,
          externalChatId: null,
          phoneFrom: '',
          phoneTo: '',
          message: 'Hello, I was circling back',
          externalMessageId: null,
        },
      ]);

    await service.getApiKeyToUseFromLinkedinMessageReceived(buildPayload());

    const personQuery = executeWorkspaceRawQuery.mock.calls[0][0] as string;

    expect(personQuery).toContain(`"linkedinProfileId" = '${SENDER_PROVIDER_ID}'`);
    expect(personQuery).not.toContain('gautam-jatia');

    const recentMessageQuery = executeWorkspaceRawQuery.mock
      .calls[1][0] as string;

    expect(recentMessageQuery).toContain(`"personId" = '${PERSON_ID}'`);
    expect(recentMessageQuery).toContain(`"externalChatId" = '${CHAT_ID}'`);
  });

  it('does not resolve the conversation through the empty phone columns', async () => {
    const { service, executeWorkspaceRawQuery } = buildService();

    executeWorkspaceRawQuery
      .mockResolvedValueOnce([{ id: PERSON_ID }])
      .mockResolvedValueOnce([
        { id: 'chat-row', personId: PERSON_ID, message: 'prior turn' },
      ]);

    await service.getApiKeyToUseFromLinkedinMessageReceived(buildPayload());

    const recentMessageQuery = executeWorkspaceRawQuery.mock
      .calls[1][0] as string;

    // The phone columns stay in the OR for WhatsApp parity but must not be the
    // only way in.
    expect(recentMessageQuery).toContain('"personId"');
  });

  it('stops early when no person matches, without treating it as an API key failure', async () => {
    const { service, executeWorkspaceRawQuery } = buildService();

    executeWorkspaceRawQuery.mockResolvedValueOnce([]);

    await expect(
      service.getApiKeyToUseFromLinkedinMessageReceived(buildPayload()),
    ).resolves.toBeNull();

    expect(executeWorkspaceRawQuery).toHaveBeenCalledTimes(1);
  });
});

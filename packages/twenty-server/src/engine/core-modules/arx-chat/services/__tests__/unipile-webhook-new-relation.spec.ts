import { IncomingWhatsappMessages } from '../whatsapp-api/incoming-messages';
import { UnipileWebhookService } from '../unipile-webhook.service';
import { type UnipileNewRelationWebhook } from '../../types/unipile-webhook.types';

describe('UnipileWebhookService.processNewRelationWebhook', () => {
  const payload: UnipileNewRelationWebhook = {
    event: 'new_relation',
    account_id: 'BD4e0PSwT6eA5PMo_1KB0w',
    account_type: 'LINKEDIN',
    webhook_name: '',
    user_full_name: 'Haneen Al-Saleh',
    user_provider_id: 'ACoAABeSIkcBt5l1f6zReQIymNO1mMgGt6Cpt3c',
    user_public_identifier: 'haneen-al-saleh',
    user_profile_url: 'https://www.linkedin.com/in/haneen-al-saleh/',
  };

  const createService = ({
    workspaceId = '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
    workspaceKeys = {},
    apiToken = 'tok',
  }: {
    workspaceId?: string | null;
    workspaceKeys?: Record<string, string>;
    apiToken?: string | null;
  } = {}) => {
    const applyEventByLinkedinUrl = jest.fn().mockResolvedValue(undefined);
    const workspaceQueryService = {
      findWorkspaceIdByLinkedinUnipileAccountId: jest
        .fn()
        .mockResolvedValue(workspaceId),
      getWorkspaceKeys: jest.fn().mockResolvedValue(workspaceKeys),
      apiKeyService: {
        findActiveByWorkspaceId: jest
          .fn()
          .mockResolvedValue(apiToken ? [{ id: 'key-1' }] : []),
        generateApiKeyToken: jest
          .fn()
          .mockResolvedValue(apiToken ? { token: apiToken } : null),
      },
    };
    const service = new UnipileWebhookService(
      workspaceQueryService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { applyEventByLinkedinUrl } as any,
      undefined,
      undefined,
      undefined,
    );

    return {
      service,
      applyEventByLinkedinUrl,
      workspaceQueryService,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps account_id to the workspace and applies connection_accepted without linkedin_url', async () => {
    const receiveIncoming = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        IncomingWhatsappMessages.prototype,
        'receiveIncomingMessageFromLinkedinUnipile',
      )
      .mockImplementation(receiveIncoming);

    const { service, applyEventByLinkedinUrl, workspaceQueryService } =
      createService();

    await service.processNewRelationWebhook(payload);

    expect(
      workspaceQueryService.findWorkspaceIdByLinkedinUnipileAccountId,
    ).toHaveBeenCalledWith('BD4e0PSwT6eA5PMo_1KB0w');
    expect(applyEventByLinkedinUrl).toHaveBeenCalledWith({
      linkedinUrl: 'https://linkedin.com/in/haneen-al-saleh/',
      event: 'connection_accepted',
      apiToken: 'tok',
      messagingChannel: 'LINKEDIN_CONNECT',
    });
    expect(receiveIncoming).toHaveBeenCalledTimes(1);
    expect(receiveIncoming.mock.calls[0][0]).toMatchObject({
      account_id: 'BD4e0PSwT6eA5PMo_1KB0w',
      message: "Yes, I'm keen",
      sender: {
        attendee_profile_url: 'https://linkedin.com/in/haneen-al-saleh/',
      },
    });
  });

  it('skips when the Unipile account_id is not mapped to a workspace', async () => {
    const receiveIncoming = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        IncomingWhatsappMessages.prototype,
        'receiveIncomingMessageFromLinkedinUnipile',
      )
      .mockImplementation(receiveIncoming);

    const { service, applyEventByLinkedinUrl } = createService({
      workspaceId: null,
    });

    await service.processNewRelationWebhook(payload);

    expect(applyEventByLinkedinUrl).not.toHaveBeenCalled();
    expect(receiveIncoming).not.toHaveBeenCalled();
  });
});

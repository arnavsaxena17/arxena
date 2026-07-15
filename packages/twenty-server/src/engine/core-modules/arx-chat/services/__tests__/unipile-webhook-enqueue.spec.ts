import { UnipileWebhookService } from '../unipile-webhook.service';

describe('UnipileWebhookService.enqueueWebhook', () => {
  const createService = (queueService?: {
    add: jest.Mock;
  }) => {
    const service = new UnipileWebhookService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      queueService as any,
    );

    return service;
  };

  it('queues webhook payloads on the Unipile webhook queue', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const service = createService({ add });
    const payload = {
      account_id: 'acct-1',
      account_type: 'LINKEDIN',
      event: 'message_received',
      chat_id: 'chat-1',
      message_id: 'msg-1',
      timestamp: new Date().toISOString(),
      webhook_name: 'test',
      message: 'hello',
      sender: {
        attendee_id: 'a1',
        attendee_name: 'A',
        attendee_provider_id: 'a1',
        attendee_profile_url: 'https://linkedin.com/in/a',
      },
      attendees: [],
    } as any;

    await service.enqueueWebhook('webhook', payload);

    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toBe('UnipileWebhookProcessor');
    expect(add.mock.calls[0][1]).toMatchObject({
      kind: 'webhook',
      payload,
    });
    expect(add.mock.calls[0][2]).toMatchObject({
      id: 'unipile-webhook-message_received-msg-1',
      retryLimit: 3,
    });
    console.log('enqueueWebhook queued message webhook successfully');
  });

  it('falls back to synchronous processing when queue is unavailable', async () => {
    const service = createService(undefined);
    const processWebhook = jest
      .spyOn(service, 'processWebhook')
      .mockResolvedValue(undefined);

    await service.enqueueWebhook('webhook', {
      AccountStatus: {
        account_id: 'acct-1',
        account_type: 'LINKEDIN',
        message: 'OK',
      },
    } as any);

    expect(processWebhook).toHaveBeenCalledTimes(1);
    console.log('enqueueWebhook fell back to sync processing successfully');
  });
});

import { FetchLinkedinMessagesService } from '../fetch-linkedin-messages.service';

describe('FetchLinkedinMessagesService', () => {
  const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };
  const linkedinUnipileRequestService = {
    fetchLinkedinUserProfile: jest.fn(),
    makeUnipileRequest: jest.fn(),
  };

  const gtmOutreachMessagePersistService = {
    mergeFetchedLinkedinMessages: jest.fn().mockResolvedValue(null),
  };

  const service = new FetchLinkedinMessagesService(
    globalWorkspaceOrmManager as never,
    linkedinUnipileRequestService as never,
    gtmOutreachMessagePersistService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses ACoAA identifiers without fetching a profile', async () => {
    await expect(
      service.resolveAttendeeId('acc-1', VALID_PROVIDER_ID),
    ).resolves.toBe(VALID_PROVIDER_ID);
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).not.toHaveBeenCalled();
  });

  it('resolves a public identifier via Unipile provider_id', async () => {
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      provider_id: VALID_PROVIDER_ID,
      public_identifier: 'jane-doe',
    });

    await expect(service.resolveAttendeeId('acc-1', 'jane-doe')).resolves.toBe(
      VALID_PROVIDER_ID,
    );
  });

  it('lists chats and messages by attendee', async () => {
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: VALID_PROVIDER_ID,
    });
    linkedinUnipileRequestService.makeUnipileRequest.mockImplementation(
      async (endpoint: string) => {
        if (endpoint.includes('/chats?')) {
          return { items: [{ id: 'chat-1' }] };
        }
        if (endpoint.includes('/sync')) {
          return { status: 'SYNC_DONE' };
        }
        if (endpoint.includes('/messages?')) {
          return {
            items: [
              {
                id: 'msg-1',
                text: 'Hello',
                timestamp: '2026-08-01T00:00:00.000Z',
                is_sender: 0,
                sender: { attendee_provider_id: VALID_PROVIDER_ID },
              },
            ],
            cursor: null,
          };
        }
        return {};
      },
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { linkedinProfileId: VALID_PROVIDER_ID },
      }),
    ).resolves.toMatchObject({
      success: true,
      chatId: 'chat-1',
      attendeeId: VALID_PROVIDER_ID,
      total: 1,
      messages: [{ id: 'msg-1', text: 'Hello', isSender: false }],
    });
  });

  it('rethrows LinkedIn account rate limit errors', async () => {
    const { AccountRateLimitDeferredError } = await import(
      'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error'
    );

    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: VALID_PROVIDER_ID,
    });
    linkedinUnipileRequestService.makeUnipileRequest.mockRejectedValue(
      new AccountRateLimitDeferredError({
        waitMs: 81_711_000,
        accountId: 'acc-1',
        method: 'endpoint',
      }),
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { linkedinProfileId: VALID_PROVIDER_ID },
      }),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);
  });

});

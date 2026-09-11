import { FeatureFlagKey } from 'twenty-shared/types';

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
    readLinkedinTranscriptMessages: jest.fn().mockResolvedValue({
      candidateId: null,
      chatId: '',
      messages: [],
    }),
  };
  const linkedinProviderIdStore = {
    saveProviderId: jest.fn().mockResolvedValue(undefined),
    readStoredProviderId: jest.fn().mockResolvedValue(''),
  };
  const featureFlagService = {
    isFeatureEnabled: jest.fn().mockResolvedValue(false),
  };

  const service = new FetchLinkedinMessagesService(
    globalWorkspaceOrmManager as never,
    linkedinUnipileRequestService as never,
    gtmOutreachMessagePersistService as never,
    linkedinProviderIdStore as never,
    featureFlagService as never,
  );

  const requestedEndpoints = () =>
    linkedinUnipileRequestService.makeUnipileRequest.mock.calls.map(
      ([endpoint]: [string]) => endpoint,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    featureFlagService.isFeatureEnabled.mockResolvedValue(false);
    gtmOutreachMessagePersistService.readLinkedinTranscriptMessages.mockResolvedValue(
      {
        candidateId: null,
        chatId: '',
        messages: [],
      },
    );
    linkedinUnipileRequestService.makeUnipileRequest.mockImplementation(
      async (endpoint: string) => {
        if (endpoint.includes('/sync')) {
          return { status: 'SYNC_DONE' };
        }
        if (endpoint.includes('/chats?')) {
          return {
            items: [
              {
                id: 'chat-1',
                attendee_provider_id: VALID_PROVIDER_ID,
              },
            ],
          };
        }
        if (endpoint.includes('/chats/') && endpoint.includes('/messages?')) {
          return {
            items: [
              {
                id: 'msg-1',
                text: 'Hello',
                timestamp: '2026-08-01T00:00:00.000Z',
                is_sender: 0,
                sender_id: VALID_PROVIDER_ID,
              },
            ],
            cursor: null,
          };
        }
        return {};
      },
    );
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

  it('resolves Sales Navigator attendee via classic then SN profile', async () => {
    const snProviderId = 'ACwAAabcdefghij1234567890';
    linkedinUnipileRequestService.fetchLinkedinUserProfile
      .mockResolvedValueOnce({
        provider_id: VALID_PROVIDER_ID,
        public_identifier: 'jane-doe',
      })
      .mockResolvedValueOnce({
        provider_id: snProviderId,
        public_identifier: 'jane-doe',
      });

    await expect(
      service.resolveAttendeeId('acc-1', 'jane-doe', {
        linkedinApi: 'sales_navigator',
      }),
    ).resolves.toBe(snProviderId);
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).toHaveBeenNthCalledWith(1, 'acc-1', 'jane-doe', {
      linkedinSections: [],
      notify: false,
    });
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).toHaveBeenNthCalledWith(2, 'acc-1', VALID_PROVIDER_ID, {
      linkedinApi: 'sales_navigator',
      linkedinSections: [],
      notify: false,
    });
  });

  it('uses ACwAA Sales Navigator ids without refetching', async () => {
    const snProviderId = 'ACwAAabcdefghij1234567890';

    await expect(
      service.resolveAttendeeId('acc-1', snProviderId, {
        linkedinApi: 'sales_navigator',
      }),
    ).resolves.toBe(snProviderId);
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).not.toHaveBeenCalled();
  });

  it('fetches SN chats when linkedinApi is sales_navigator', async () => {
    const snProviderId = 'ACwAAabcdefghij1234567890';
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: 'jane-doe',
    });
    linkedinUnipileRequestService.fetchLinkedinUserProfile
      .mockResolvedValueOnce({
        provider_id: VALID_PROVIDER_ID,
        public_identifier: 'jane-doe',
      })
      .mockResolvedValueOnce({
        provider_id: snProviderId,
        public_identifier: 'jane-doe',
      });
    linkedinUnipileRequestService.makeUnipileRequest.mockImplementation(
      async (endpoint: string) => {
        if (endpoint.includes('/sync')) {
          return { status: 'SYNC_DONE' };
        }
        if (endpoint.includes('/chats?')) {
          return {
            items: [
              {
                id: 'sn-chat-1',
                attendee_provider_id: snProviderId,
              },
            ],
          };
        }
        if (endpoint.includes('/chats/') && endpoint.includes('/messages?')) {
          return {
            items: [
              {
                id: 'msg-sn',
                text: 'SN hello',
                timestamp: '2026-08-01T00:00:00.000Z',
                is_sender: 0,
                sender_id: snProviderId,
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
        input: {
          linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
          linkedinApi: 'sales_navigator',
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      chatId: 'sn-chat-1',
      attendeeId: snProviderId,
      total: 1,
      messages: [{ id: 'msg-sn', text: 'SN hello' }],
    });

    const endpoints = requestedEndpoints();
    expect(endpoints[0]).toContain(snProviderId);
    expect(endpoints[0]).toContain('/sync?');
  });

  it('syncs attendee history, lists chats, then loads messages from the chat', async () => {
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: VALID_PROVIDER_ID,
    });

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
    expect(linkedinProviderIdStore.saveProviderId).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      candidateId: undefined,
      identifier: VALID_PROVIDER_ID,
      providerId: VALID_PROVIDER_ID,
    });

    const endpoints = requestedEndpoints();

    expect(endpoints[0]).toBe(
      `/api/v1/chat_attendees/${VALID_PROVIDER_ID}/sync?account_id=acc-1`,
    );
    expect(endpoints[1]).toBe(
      `/api/v1/chat_attendees/${VALID_PROVIDER_ID}/chats?account_id=acc-1&limit=250`,
    );
    expect(endpoints[2]).toBe('/api/v1/chats/chat-1/messages?limit=50');
    expect(
      endpoints.some(
        (endpoint) =>
          endpoint.includes('/chat_attendees/') &&
          endpoint.includes('/messages'),
      ),
    ).toBe(false);
  });

  it('resolves a public URL via cached profile then fetches chat messages', async () => {
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: 'jane-doe',
    });
    linkedinUnipileRequestService.fetchLinkedinUserProfile.mockResolvedValue({
      provider_id: VALID_PROVIDER_ID,
      public_identifier: 'jane-doe',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { linkedinUrl: 'https://www.linkedin.com/in/jane-doe' },
      }),
    ).resolves.toMatchObject({
      success: true,
      chatId: 'chat-1',
      attendeeId: VALID_PROVIDER_ID,
      total: 1,
    });
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).toHaveBeenCalledWith('acc-1', 'jane-doe', {
      linkedinSections: [],
      notify: false,
    });
    expect(requestedEndpoints()[2]).toBe(
      '/api/v1/chats/chat-1/messages?limit=50',
    );
  });

  it('returns no messages when the attendee has no chat', async () => {
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue({
      accountId: 'acc-1',
      identifier: VALID_PROVIDER_ID,
    });
    linkedinUnipileRequestService.makeUnipileRequest.mockImplementation(
      async (endpoint: string) => {
        if (endpoint.includes('/sync')) {
          return { status: 'SYNC_DONE' };
        }
        if (endpoint.includes('/chats?')) {
          return { items: [], cursor: null };
        }
        return { items: [{ id: 'should-not-load' }] };
      },
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { linkedinProfileId: VALID_PROVIDER_ID },
      }),
    ).resolves.toMatchObject({
      success: true,
      chatId: '',
      attendeeId: VALID_PROVIDER_ID,
      total: 0,
      messages: [],
    });
    expect(
      requestedEndpoints().some((endpoint) => endpoint.includes('/messages')),
    ).toBe(false);
  });

  it('reads chatMessage transcript when IS_OUTREACH_MOCK_UNIPILE_ENABLED', async () => {
    featureFlagService.isFeatureEnabled.mockImplementation(
      async (key: FeatureFlagKey) =>
        key === FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
    );
    gtmOutreachMessagePersistService.readLinkedinTranscriptMessages.mockResolvedValue(
      {
        candidateId: 'cand-1',
        chatId: 'stored-chat-1',
        messages: [
          {
            id: 'msg-local-1',
            text: 'Hi Divyesh',
            timestamp: '2026-09-01T00:00:00.000Z',
            senderId: '',
            isSender: true,
          },
        ],
      },
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          linkedinUrl: 'https://linkedin.com/in/divyesh-shah-b1b97698',
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      chatId: 'stored-chat-1',
      attendeeId: 'divyesh-shah-b1b97698',
      total: 1,
      messages: [{ id: 'msg-local-1', text: 'Hi Divyesh', isSender: true }],
    });
    expect(
      gtmOutreachMessagePersistService.readLinkedinTranscriptMessages,
    ).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      candidateId: undefined,
      linkedinProfileId: 'divyesh-shah-b1b97698',
      limit: 50,
    });
    expect(
      linkedinUnipileRequestService.makeUnipileRequest,
    ).not.toHaveBeenCalled();
  });

  it('rethrows LinkedIn account rate limit errors', async () => {
    const { AccountRateLimitDeferredError } =
      await import('src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error');

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

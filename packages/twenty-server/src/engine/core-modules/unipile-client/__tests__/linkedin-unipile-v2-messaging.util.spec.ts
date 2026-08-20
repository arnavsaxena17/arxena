import {
  UNIPILE_LINKEDIN_INBOX_ID,
  buildLinkedinStartChatInboxOptions,
  extractUnipileChatId,
  sendLinkedinV2OutboundMessage,
} from '../linkedin-unipile-v2-messaging.util';
import { UnipileV2Client } from '../unipile-v2.client';

describe('linkedin-unipile-v2-messaging.util', () => {
  it('extracts chat id from items envelope', () => {
    expect(extractUnipileChatId({ items: [{ id: 'chat_9' }] })).toBe('chat_9');
    expect(extractUnipileChatId({ data: [{ chat_id: 'chat_8' }] })).toBe(
      'chat_8',
    );
    expect(extractUnipileChatId({})).toBeUndefined();
  });

  it('builds product inbox options with required SN and Recruiter fields', () => {
    expect(UNIPILE_LINKEDIN_INBOX_ID.classic).toBe('CLASSIC_PRIMARY');
    expect(UNIPILE_LINKEDIN_INBOX_ID.sales_navigator).toBe(
      'SALES_NAVIGATOR_PRIMARY',
    );
    expect(UNIPILE_LINKEDIN_INBOX_ID.recruiter).toBe('RECRUITER_PRIMARY');
    expect(
      buildLinkedinStartChatInboxOptions({
        product: 'classic',
        isInMail: true,
      }),
    ).toEqual({ linkedin: { classic: { inmail: true } } });
    expect(
      buildLinkedinStartChatInboxOptions({
        product: 'sales_navigator',
        subject: 'Hello',
      }),
    ).toEqual({
      linkedin: { sales_navigator: { subject: 'Hello' } },
    });
    expect(
      buildLinkedinStartChatInboxOptions({
        product: 'recruiter',
        subject: 'Role',
        signature: 'Alex Recruiter',
      }),
    ).toEqual({
      linkedin: {
        recruiter: { subject: 'Role', signature: 'Alex Recruiter' },
      },
    });
  });

  it('replies in thread when getUserChat returns an id', async () => {
    const client = {
      getUserChat: jest.fn().mockResolvedValue({ items: [{ id: 'chat_existing' }] }),
      sendChatMessage: jest.fn().mockResolvedValue({ id: 'msg_1' }),
      startChatFromInbox: jest.fn(),
      getUser: jest.fn(),
    };

    await sendLinkedinV2OutboundMessage({
      client: client as never,
      accountId: 'acc_1',
      usersIds: ['ACoAA123'],
      text: 'follow up',
    });

    expect(client.sendChatMessage).toHaveBeenCalledWith({
      accountId: 'acc_1',
      chatId: 'chat_existing',
      text: 'follow up',
      attachments: undefined,
    });
    expect(client.startChatFromInbox).not.toHaveBeenCalled();
    expect(client.getUser).not.toHaveBeenCalled();
  });

  it('starts Recruiter inbox chat with subject and signature when no chat exists', async () => {
    const client = {
      getUserChat: jest.fn().mockResolvedValue({ items: [] }),
      sendChatMessage: jest.fn(),
      startChatFromInbox: jest.fn().mockResolvedValue({ id: 'chat_new' }),
      getUser: jest.fn().mockResolvedValue({
        recruiter: { contract_id: 'c1' },
        first_name: 'Alex',
        last_name: 'Recruiter',
      }),
    };

    await sendLinkedinV2OutboundMessage({
      client: client as never,
      accountId: 'acc_1',
      usersIds: ['ACoAA123'],
      text: 'Hello',
      subject: 'Open role',
    });

    expect(client.sendChatMessage).not.toHaveBeenCalled();
    expect(client.startChatFromInbox).toHaveBeenCalledWith({
      accountId: 'acc_1',
      inboxId: 'RECRUITER_PRIMARY',
      usersIds: ['ACoAA123'],
      text: 'Hello',
      attachments: undefined,
      name: 'Open role',
      options: {
        linkedin: {
          recruiter: {
            subject: 'Open role',
            signature: 'Alex Recruiter',
          },
        },
      },
    });
  });
});

describe('UnipileV2Client LinkedIn messaging attachments', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends attachment content rather than data', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ({ id: 'msg_1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new UnipileV2Client('https://api.unipile.com', 'key');
    await client.sendChatMessage({
      accountId: 'acc_1',
      chatId: 'chat_1',
      text: 'file',
      attachments: [
        {
          filename: 'cv.pdf',
          content_type: 'application/pdf',
          data: 'YmFzZTY0',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.unipile.com/v2/acc_1/chats/chat_1/messages/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.attachments[0]).toEqual({
      filename: 'cv.pdf',
      content_type: 'application/pdf',
      content: 'YmFzZTY0',
    });
    expect(body.attachments[0].data).toBeUndefined();
  });

  it('passes notify and with_sections on getUser', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ({ display_name: 'Ada Lovelace' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new UnipileV2Client('https://api.unipile.com', 'key');
    const profile = (await client.getUser('acc_1', 'me', {
      linkedin_sections: '*',
      notify: 'true',
    })) as Record<string, unknown>;

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.unipile.com/v2/acc_1/users/me?notify=true&with_sections=linkedin_*',
    );
    expect(profile.name).toBe('Ada Lovelace');
    expect(profile.first_name).toBe('Ada Lovelace');
  });

  it('does not send Classic people limit and uses cursor', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ({ data: [{ id: '1' }], next_cursor: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new UnipileV2Client('https://api.unipile.com', 'key');
    await client.searchLinkedIn({
      accountId: 'acc_1',
      api: 'classic',
      category: 'people',
      body: { keywords: 'pm' },
      cursor: 'cur_1',
      limit: 50,
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.unipile.com/v2/acc_1/linkedin/search/people?cursor=cur_1',
    );
  });
});

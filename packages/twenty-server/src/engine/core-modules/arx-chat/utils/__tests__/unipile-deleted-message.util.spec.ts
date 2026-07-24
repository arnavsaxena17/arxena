import type { SaveDeletedMessagePayload } from '../../types/deleted-message.types';
import {
    buildDeletedMessageContentCacheEntry,
    buildDeletedMessageEntry,
    isWhatsAppGroupChat,
    normalizeDeletedMessagesStore,
    resolveConversationType,
} from '../unipile-deleted-message.util';

const individualPayload: SaveDeletedMessagePayload = {
  message_id: 'msg-individual-1',
  message: 'What is tyre pressure in Honda?',
  sender: {
    attendee_id: 'sender-1',
    attendee_name: 'Ashok J Banka-Raghunayak',
    attendee_provider_id: '919869407293',
    attendee_profile_url: '',
    attendee_public_identifier: '919869407293@s.whatsapp.net',
    attendee_specifics: {
      phone_number: '+919869407293',
    },
  },
  timestamp: '2026-06-19T02:44:14.000Z',
  account_type: 'WHATSAPP',
  chat_id: 'chat-individual',
  account_id: 'account-1',
  provider_chat_id: '919869407293@s.whatsapp.net',
  attendees: [{}, {}, {}] as SaveDeletedMessagePayload['attendees'],
};

const groupPayload: SaveDeletedMessagePayload = {
  ...individualPayload,
  message_id: 'msg-group-1',
  message: 'Please share the JD',
  provider_chat_id: '120363123456789012@g.us',
  subject: 'Hiring - Product Team',
  is_group: true,
  attendees: [{}, {}, {}, {}, {}] as SaveDeletedMessagePayload['attendees'],
};

describe('unipile-deleted-message.util', () => {
  it('detects individual and group WhatsApp conversations', () => {
    console.log('Testing conversation type detection');
    expect(resolveConversationType(individualPayload)).toBe('individual');
    expect(resolveConversationType(groupPayload)).toBe('group');
    expect(isWhatsAppGroupChat(groupPayload)).toBe(true);
    expect(isWhatsAppGroupChat(individualPayload)).toBe(false);
  });

  it('builds cache entries with conversation metadata', () => {
    console.log('Testing deleted message cache entry build');
    const cacheEntry = buildDeletedMessageContentCacheEntry(groupPayload);

    expect(cacheEntry.conversation_type).toBe('group');
    expect(cacheEntry.group_id).toBe('120363123456789012');
    expect(cacheEntry.group_name).toBe('Hiring - Product Team');
    expect(cacheEntry.message).toBe('Please share the JD');
  });

  it('recovers deleted message text from cache when webhook body is empty', () => {
    console.log('Testing deleted message text recovery from cache');
    const cacheEntry = buildDeletedMessageContentCacheEntry(individualPayload);
    const deletedEntry = buildDeletedMessageEntry(
      {
        ...individualPayload,
        message: '',
      },
      '2026-06-19T02:46:28.009Z',
      cacheEntry,
    );

    expect(deletedEntry.original_message).toBe(
      'What is tyre pressure in Honda?',
    );
    expect(deletedEntry.conversation_type).toBe('individual');
    expect(deletedEntry.counterparty_phone).toBe('919869407293');
  });

  it('normalizes legacy flat deleted message arrays into buckets', () => {
    console.log('Testing legacy deleted messages migration');
    const store = normalizeDeletedMessagesStore([
      {
        deleted_at: '2026-06-19T02:46:28.009Z',
        message_id: 'legacy-1',
        original_message: 'legacy message',
        sender_name: 'Legacy Sender',
        sender_phone: '+919869407293',
        sent_at: '2026-06-19T02:44:14.000Z',
        account_type: 'WHATSAPP',
        chat_id: 'chat-1',
        account_id: 'account-1',
        had_attachments: false,
        attachments: [],
      },
    ]);

    expect(store.individual).toHaveLength(1);
    expect(store.groups).toHaveLength(0);
    expect(store.individual[0].conversation_type).toBe('individual');
  });
});

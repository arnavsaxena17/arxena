import type { UnipileWebhookAttachment, UnipileWebhookAttendee } from './unipile-webhook.types';

export type DeletedMessageConversationType = 'individual' | 'group';

export type DeletedMessageAttachmentEntry = {
  attachment_id: string | undefined;
  attachment_type: string;
  attachment_url: string | null;
  attachment_size: number | null;
};

export type DeletedMessageEntry = {
  deleted_at: string;
  message_id: string;
  original_message: string;
  sender_name: string;
  sender_phone: string;
  sent_at: string;
  account_type: string;
  chat_id: string | undefined;
  account_id: string | undefined;
  provider_chat_id: string | null;
  conversation_type: DeletedMessageConversationType;
  counterparty_phone: string | null;
  counterparty_name: string | null;
  group_id: string | null;
  group_name: string | null;
  had_attachments: boolean;
  attachments: DeletedMessageAttachmentEntry[];
};

export type DeletedMessagesStore = {
  individual: DeletedMessageEntry[];
  groups: DeletedMessageEntry[];
};

export type DeletedMessageContentCacheEntry = {
  message_id: string;
  message: string;
  sender_name: string;
  sender_phone: string;
  sent_at: string;
  account_type: string;
  chat_id: string | undefined;
  account_id: string | undefined;
  provider_chat_id: string | null;
  conversation_type: DeletedMessageConversationType;
  counterparty_phone: string | null;
  counterparty_name: string | null;
  group_id: string | null;
  group_name: string | null;
  cached_at: string;
};

export type SaveDeletedMessagePayload = {
  message_id: string;
  message?: string | null;
  sender: UnipileWebhookAttendee;
  timestamp: string;
  account_type: string;
  chat_id?: string;
  account_id?: string;
  provider_chat_id?: string;
  subject?: string | null;
  is_group?: boolean;
  attendees?: UnipileWebhookAttendee[];
  attachments?: UnipileWebhookAttachment | UnipileWebhookAttachment[];
};

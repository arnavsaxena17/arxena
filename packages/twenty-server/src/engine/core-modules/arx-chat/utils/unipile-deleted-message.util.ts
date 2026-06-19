import type {
    DeletedMessageContentCacheEntry,
    DeletedMessageConversationType,
    DeletedMessageEntry,
    DeletedMessagesStore,
    SaveDeletedMessagePayload,
} from '../types/deleted-message.types';
import type { UnipileWebhookAttachment, UnipileWebhookAttendee } from '../types/unipile-webhook.types';

const WHATSAPP_GROUP_SUFFIX = '@g.us';
const WHATSAPP_INDIVIDUAL_SUFFIX = '@s.whatsapp.net';

export const createEmptyDeletedMessagesStore = (): DeletedMessagesStore => ({
  individual: [],
  groups: [],
});

const normalizePhone = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'Unknown') {
    return null;
  }

  return trimmed.replace(/^\+/, '');
};

export const extractSenderPhone = (sender: UnipileWebhookAttendee): string => {
  return (
    sender.attendee_specifics?.phone_number ||
    sender.attendee_public_identifier?.split('@')[0] ||
    sender.attendee_provider_id ||
    'Unknown'
  );
};

export const isWhatsAppGroupChat = (
  payload: Pick<
    SaveDeletedMessagePayload,
    'account_type' | 'is_group' | 'provider_chat_id' | 'attendees'
  >,
): boolean => {
  if (payload.account_type !== 'WHATSAPP') {
    return false;
  }

  if (payload.is_group === true) {
    return true;
  }

  if (payload.provider_chat_id?.endsWith(WHATSAPP_GROUP_SUFFIX)) {
    return true;
  }

  return (payload.attendees?.length ?? 0) > 4;
};

export const resolveConversationType = (
  payload: Pick<
    SaveDeletedMessagePayload,
    'account_type' | 'is_group' | 'provider_chat_id' | 'attendees'
  >,
): DeletedMessageConversationType => {
  return isWhatsAppGroupChat(payload) ? 'group' : 'individual';
};

const resolveGroupId = (providerChatId: string | undefined): string | null => {
  if (!providerChatId?.endsWith(WHATSAPP_GROUP_SUFFIX)) {
    return null;
  }

  return providerChatId.replace(WHATSAPP_GROUP_SUFFIX, '');
};

const resolveCounterpartyPhone = (
  providerChatId: string | undefined,
): string | null => {
  if (!providerChatId?.endsWith(WHATSAPP_INDIVIDUAL_SUFFIX)) {
    return null;
  }

  return normalizePhone(providerChatId.replace(WHATSAPP_INDIVIDUAL_SUFFIX, ''));
};

const normalizeAttachments = (
  attachments: UnipileWebhookAttachment | UnipileWebhookAttachment[] | undefined,
): DeletedMessageEntry['attachments'] => {
  const attachmentsArray = attachments
    ? Array.isArray(attachments)
      ? attachments
      : [attachments]
    : [];

  return attachmentsArray.map((attachment) => ({
    attachment_id: attachment.attachment_id || attachment.id,
    attachment_type: attachment.attachment_type || attachment.type || 'unknown',
    attachment_url: attachment.attachment_url || attachment.url || null,
    attachment_size: attachment.attachment_size || attachment.size || null,
  }));
};

export const buildDeletedMessageContentCacheEntry = (
  payload: SaveDeletedMessagePayload,
): DeletedMessageContentCacheEntry => {
  const conversationType = resolveConversationType(payload);
  const senderPhone = extractSenderPhone(payload.sender);
  const providerChatId = payload.provider_chat_id ?? null;

  return {
    message_id: payload.message_id,
    message: payload.message ?? '',
    sender_name: payload.sender.attendee_name || 'Unknown',
    sender_phone: senderPhone,
    sent_at: payload.timestamp,
    account_type: payload.account_type,
    chat_id: payload.chat_id,
    account_id: payload.account_id,
    provider_chat_id: providerChatId,
    conversation_type: conversationType,
    counterparty_phone:
      conversationType === 'individual'
        ? resolveCounterpartyPhone(providerChatId ?? undefined)
        : null,
    counterparty_name: null,
    group_id:
      conversationType === 'group'
        ? resolveGroupId(providerChatId ?? undefined)
        : null,
    group_name:
      conversationType === 'group' ? payload.subject?.trim() || null : null,
    cached_at: new Date().toISOString(),
  };
};

export const buildDeletedMessageEntry = (
  payload: SaveDeletedMessagePayload,
  deletedAt: string,
  cachedEntry?: DeletedMessageContentCacheEntry | null,
): DeletedMessageEntry => {
  const conversationType =
    cachedEntry?.conversation_type ?? resolveConversationType(payload);
  const attachments = normalizeAttachments(payload.attachments);
  const senderPhone =
    cachedEntry?.sender_phone ?? extractSenderPhone(payload.sender);
  const providerChatId =
    cachedEntry?.provider_chat_id ?? payload.provider_chat_id ?? null;
  const originalMessage =
    payload.message?.trim() ||
    cachedEntry?.message?.trim() ||
    '';

  return {
    deleted_at: deletedAt,
    message_id: payload.message_id,
    original_message: originalMessage,
    sender_name:
      cachedEntry?.sender_name ?? payload.sender.attendee_name ?? 'Unknown',
    sender_phone: senderPhone,
    sent_at: cachedEntry?.sent_at ?? payload.timestamp,
    account_type: payload.account_type,
    chat_id: cachedEntry?.chat_id ?? payload.chat_id,
    account_id: cachedEntry?.account_id ?? payload.account_id,
    provider_chat_id: providerChatId,
    conversation_type: conversationType,
    counterparty_phone:
      conversationType === 'individual'
        ? cachedEntry?.counterparty_phone ??
          resolveCounterpartyPhone(providerChatId ?? undefined)
        : null,
    counterparty_name: cachedEntry?.counterparty_name ?? null,
    group_id:
      conversationType === 'group'
        ? cachedEntry?.group_id ??
          resolveGroupId(providerChatId ?? undefined)
        : null,
    group_name:
      conversationType === 'group'
        ? cachedEntry?.group_name ??
          (payload.subject?.trim() ? payload.subject.trim() : null)
        : null,
    had_attachments: attachments.length > 0,
    attachments,
  };
};

export const normalizeDeletedMessagesStore = (
  raw: unknown,
): DeletedMessagesStore => {
  if (!raw) {
    return createEmptyDeletedMessagesStore();
  }

  if (Array.isArray(raw)) {
    const store = createEmptyDeletedMessagesStore();

    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const legacyEntry = entry as DeletedMessageEntry & {
        conversation_type?: DeletedMessageConversationType;
      };
      const conversationType =
        legacyEntry.conversation_type === 'group' ? 'groups' : 'individual';

      store[conversationType].push({
        ...legacyEntry,
        conversation_type:
          legacyEntry.conversation_type === 'group' ? 'group' : 'individual',
        provider_chat_id: legacyEntry.provider_chat_id ?? null,
        counterparty_phone: legacyEntry.counterparty_phone ?? null,
        counterparty_name: legacyEntry.counterparty_name ?? null,
        group_id: legacyEntry.group_id ?? null,
        group_name: legacyEntry.group_name ?? null,
      });
    }

    return store;
  }

  if (typeof raw === 'object') {
    const store = raw as Partial<DeletedMessagesStore>;

    return {
      individual: Array.isArray(store.individual) ? store.individual : [],
      groups: Array.isArray(store.groups) ? store.groups : [],
    };
  }

  return createEmptyDeletedMessagesStore();
};

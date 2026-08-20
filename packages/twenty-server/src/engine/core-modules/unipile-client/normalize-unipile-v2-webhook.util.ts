import type {
  UnipileAccountStatusWebhook,
  UnipileMessageWebhook,
  UnipileNewRelationWebhook,
  UnipileWebhookAttendee,
  UnipileWebhookPayload,
} from 'src/engine/core-modules/arx-chat/types/unipile-webhook.types';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const pickNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const userDisplayName = (user: Record<string, unknown>): string | undefined => {
  const first = pickNonEmptyString(user.first_name) ?? '';
  const last = pickNonEmptyString(user.last_name) ?? '';
  const combined = `${first} ${last}`.trim();
  return pickNonEmptyString(
    user.display_name,
    user.name,
    user.user_full_name,
    combined || undefined,
  );
};

const linkedinProfileUrl = (
  profileUrl: string | undefined,
  publicIdentifier: string | undefined,
): string | undefined => {
  if (profileUrl) {
    return profileUrl;
  }
  if (!publicIdentifier) {
    return undefined;
  }
  if (publicIdentifier.includes('linkedin.com')) {
    return publicIdentifier.startsWith('http')
      ? publicIdentifier
      : `https://${publicIdentifier}`;
  }
  return `https://www.linkedin.com/in/${publicIdentifier}`;
};

const V2_ACCOUNT_EVENT_TO_STATUS: Record<string, UnipileAccountStatusWebhook['AccountStatus']['message']> = {
  'account.add': 'CREATION_SUCCESS',
  'account.reconnect': 'RECONNECTED',
  'account.remove': 'DELETED',
  'account.status.running': 'OK',
  'account.status.disconnected': 'CREDENTIALS',
  'account.status.errored': 'ERROR',
};

const V2_MESSAGE_EVENT_TO_V1: Record<string, UnipileMessageWebhook['event']> = {
  'message.new': 'message_received',
  'message.update': 'message_edited',
  'message.delete': 'message_deleted',
  'message.receipt.read': 'message_read',
  'message.delivery': 'message_delivered',
  'message.reaction.new': 'message_reaction',
};

const toAccountType = (
  value: unknown,
): UnipileAccountStatusWebhook['AccountStatus']['account_type'] => {
  const normalized = String(value ?? '').toUpperCase();
  if (
    normalized === 'LINKEDIN' ||
    normalized === 'WHATSAPP' ||
    normalized === 'INSTAGRAM' ||
    normalized === 'MESSENGER' ||
    normalized === 'TELEGRAM' ||
    normalized === 'X_TWITTER'
  ) {
    return normalized;
  }
  if (normalized === 'LINKEDIN'.toLowerCase() || value === 'linkedin') {
    return 'LINKEDIN';
  }
  if (value === 'whatsapp') {
    return 'WHATSAPP';
  }
  return (normalized || 'LINKEDIN') as UnipileAccountStatusWebhook['AccountStatus']['account_type'];
};

const toAttendee = (value: unknown): UnipileWebhookAttendee => {
  const record = asRecord(value) ?? {};
  const user = asRecord(record.user) ?? record;
  return {
    attendee_id: String(user.id ?? record.attendee_id ?? record.sender_id ?? ''),
    attendee_name: String(
      user.display_name ?? record.attendee_name ?? user.name ?? '',
    ),
    attendee_provider_id: String(
      user.id ??
        record.attendee_provider_id ??
        record.sender_id ??
        record.user_id ??
        '',
    ),
    attendee_profile_url: String(
      user.profile_url ?? record.attendee_profile_url ?? '',
    ),
    attendee_public_identifier:
      typeof user.public_identifier === 'string'
        ? user.public_identifier
        : typeof record.attendee_public_identifier === 'string'
          ? record.attendee_public_identifier
          : undefined,
    attendee_specifics: asRecord(user.specifics) ?? asRecord(record.attendee_specifics),
  };
};

export const isUnipileV2WebhookEvent = (payload: unknown): boolean => {
  const record = asRecord(payload);
  if (!record) {
    return false;
  }
  const type = typeof record.type === 'string' ? record.type : '';
  return type.includes('.') || type.startsWith('account') || type.startsWith('message') || type.startsWith('relation');
};

export const normalizeUnipileWebhookPayload = (
  payload: unknown,
): UnipileWebhookPayload | UnipileNewRelationWebhook => {
  const record = asRecord(payload);
  if (!record) {
    return payload as UnipileWebhookPayload;
  }

  if ('AccountStatus' in record || 'event' in record) {
    return payload as UnipileWebhookPayload;
  }

  const type = typeof record.type === 'string' ? record.type : '';
  const accountId = String(
    record.account_id ?? asRecord(record.account)?.id ?? '',
  );
  const accountType = toAccountType(
    record.account_type ??
      record.provider ??
      asRecord(record.account)?.provider,
  );
  const eventPayload = asRecord(record.payload) ?? record;

  if (V2_ACCOUNT_EVENT_TO_STATUS[type]) {
    const accountStatus: UnipileAccountStatusWebhook = {
      AccountStatus: {
        account_id: accountId,
        account_type: accountType,
        message: V2_ACCOUNT_EVENT_TO_STATUS[type],
        name:
          typeof record.state === 'string'
            ? record.state
            : typeof eventPayload.name === 'string'
              ? eventPayload.name
              : undefined,
      },
    };
    return accountStatus;
  }

  if (type === 'relation.new' || type === 'relation.accepted') {
    const user = asRecord(eventPayload.user) ?? eventPayload;
    const publicIdentifier = pickNonEmptyString(
      user.public_identifier,
      eventPayload.user_public_identifier,
    );
    const relation: UnipileNewRelationWebhook = {
      event: 'new_relation',
      account_id: accountId,
      account_type: 'LINKEDIN',
      user_full_name: userDisplayName(user),
      user_provider_id: pickNonEmptyString(
        user.id,
        eventPayload.user_provider_id,
        publicIdentifier,
      ),
      user_public_identifier: publicIdentifier,
      user_profile_url: linkedinProfileUrl(
        pickNonEmptyString(user.profile_url, eventPayload.user_profile_url),
        publicIdentifier,
      ),
      user_picture_url: pickNonEmptyString(
        user.public_picture_url,
        user.user_picture_url,
        eventPayload.user_picture_url,
      ),
    };
    return relation;
  }

  const v1Event = V2_MESSAGE_EVENT_TO_V1[type];
  if (v1Event) {
    const message = asRecord(eventPayload.message) ?? eventPayload;
    const sender = toAttendee(message.sender ?? eventPayload.sender);
    const attendeesRaw = Array.isArray(message.attendees)
      ? message.attendees
      : Array.isArray(eventPayload.participants)
        ? eventPayload.participants
        : [];
    const mapped: UnipileMessageWebhook = {
      account_id: accountId,
      account_type: accountType,
      event: v1Event,
      chat_id: String(message.chat_id ?? eventPayload.chat_id ?? ''),
      timestamp: String(
        message.created_at ?? record.created_at ?? new Date().toISOString(),
      ),
      webhook_name: type,
      message_id: String(message.id ?? eventPayload.id ?? ''),
      message:
        typeof message.text === 'string'
          ? message.text
          : typeof eventPayload.text === 'string'
            ? eventPayload.text
            : null,
      sender,
      attendees: attendeesRaw.map(toAttendee),
      attachments: (message.attachments ?? eventPayload.attachments) as UnipileMessageWebhook['attachments'],
      is_sender: Boolean(message.is_sender ?? eventPayload.is_sender),
      provider_chat_id: String(message.chat_id ?? ''),
      provider_message_id: String(message.id ?? ''),
      account_info: {
        type: accountType,
        user_id: String(
          asRecord(record.account)?.user_id ?? eventPayload.account_user_id ?? '',
        ),
      },
    };
    return mapped;
  }

  return payload as UnipileWebhookPayload;
};

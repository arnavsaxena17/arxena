export const MessagingChannel = {
  BAILEYS: 'BAILEYS',
  WHATSAPP_UNIPILE: 'WHATSAPP_UNIPILE',
  WHATSAPP_WEB: 'WHATSAPP_WEB',
  WHATSAPP_OFFICIAL: 'WHATSAPP_OFFICIAL',
  LINKEDIN: 'LINKEDIN',
  LINKEDIN_PREMIUM: 'LINKEDIN_PREMIUM',
  LINKEDIN_INMAIL: 'LINKEDIN_INMAIL',
  LINKEDIN_SOCK: 'LINKEDIN_SOCK',
  LINKEDIN_CONNECT: 'LINKEDIN_CONNECT',
  COMMENT: 'COMMENT',
  EMAIL: 'EMAIL',
} as const;

export type MessagingChannelValue =
  (typeof MessagingChannel)[keyof typeof MessagingChannel];

export const MESSAGING_CHANNEL_SELECT_VALUES = [
  MessagingChannel.BAILEYS,
  MessagingChannel.WHATSAPP_UNIPILE,
  MessagingChannel.WHATSAPP_WEB,
  MessagingChannel.WHATSAPP_OFFICIAL,
  MessagingChannel.LINKEDIN,
  MessagingChannel.LINKEDIN_PREMIUM,
  MessagingChannel.LINKEDIN_INMAIL,
  MessagingChannel.LINKEDIN_SOCK,
  MessagingChannel.LINKEDIN_CONNECT,
  MessagingChannel.COMMENT,
  MessagingChannel.EMAIL,
] as const;

// Normalize CRM SELECT values (UPPER_SNAKE) and legacy kebab-case to canonical form
export const normalizeMessagingChannel = (
  value: string | null | undefined,
): string | null => {
  if (!isDefinedNonEmptyString(value)) {
    return null;
  }

  return value.replace(/-/g, '_').toUpperCase();
};

// Transport / whatsapp_key / typeOfMessage still use kebab-case
export const toMessagingChannelTransportKey = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeMessagingChannel(value);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/_/g, '-').toLowerCase();
};

export const messagingChannelEquals = (
  value: string | null | undefined,
  ...expected: string[]
): boolean => {
  const normalized = normalizeMessagingChannel(value);

  if (!normalized) {
    return false;
  }

  return expected.some(
    (candidate) => normalizeMessagingChannel(candidate) === normalized,
  );
};

export const isAllowedMessagingChannel = (
  value: string | null | undefined,
  allowed: Iterable<string> = MESSAGING_CHANNEL_SELECT_VALUES,
): boolean => {
  const normalized = normalizeMessagingChannel(value);

  if (!normalized) {
    return false;
  }

  for (const allowedValue of allowed) {
    if (normalizeMessagingChannel(allowedValue) === normalized) {
      return true;
    }
  }

  return false;
};

const isDefinedNonEmptyString = (
  value: string | null | undefined,
): value is string => typeof value === 'string' && value.length > 0;

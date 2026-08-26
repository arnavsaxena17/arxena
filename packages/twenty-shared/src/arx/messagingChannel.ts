export enum MessagingChannel {
  BAILEYS = 'BAILEYS',
  WHATSAPP_UNIPILE = 'WHATSAPP_UNIPILE',
  WHATSAPP_WEB = 'WHATSAPP_WEB',
  WHATSAPP_OFFICIAL = 'WHATSAPP_OFFICIAL',
  LINKEDIN_INMAIL = 'LINKEDIN_INMAIL',
  LINKEDIN_SOCK = 'LINKEDIN_SOCK',
  LINKEDIN_CONNECT = 'LINKEDIN_CONNECT',
  COMMENT = 'COMMENT',
  EMAIL = 'EMAIL',
}

export type MessagingChannelValue = `${MessagingChannel}`;

export const MESSAGING_CHANNEL_SELECT_VALUES = [
  MessagingChannel.BAILEYS,
  MessagingChannel.WHATSAPP_UNIPILE,
  MessagingChannel.WHATSAPP_WEB,
  MessagingChannel.WHATSAPP_OFFICIAL,
  MessagingChannel.LINKEDIN_INMAIL,
  MessagingChannel.LINKEDIN_SOCK,
  MessagingChannel.LINKEDIN_CONNECT,
  MessagingChannel.COMMENT,
  MessagingChannel.EMAIL,
] as const;

export const MESSAGING_CHANNEL_LABELS: Record<MessagingChannel, string> = {
  [MessagingChannel.BAILEYS]: 'Baileys',
  [MessagingChannel.WHATSAPP_UNIPILE]: 'WhatsApp Unipile',
  [MessagingChannel.WHATSAPP_WEB]: 'WhatsApp Web',
  [MessagingChannel.WHATSAPP_OFFICIAL]: 'WhatsApp Official',
  [MessagingChannel.LINKEDIN_INMAIL]: 'LinkedIn InMail',
  [MessagingChannel.LINKEDIN_SOCK]: 'LinkedIn Sock',
  [MessagingChannel.LINKEDIN_CONNECT]: 'LinkedIn Connect',
  [MessagingChannel.COMMENT]: 'Comment',
  [MessagingChannel.EMAIL]: 'Email',
};

export const WHATSAPP_MESSAGING_CHANNELS = [
  MessagingChannel.BAILEYS,
  MessagingChannel.WHATSAPP_UNIPILE,
  MessagingChannel.WHATSAPP_WEB,
  MessagingChannel.WHATSAPP_OFFICIAL,
] as const;

export const LINKEDIN_DIRECT_MESSAGING_CHANNELS = [
  MessagingChannel.LINKEDIN_CONNECT,
  MessagingChannel.LINKEDIN_INMAIL,
  MessagingChannel.LINKEDIN_SOCK,
] as const;

const MESSAGING_CHANNEL_ALIASES: Record<string, MessagingChannel> = {
  // Legacy CRM / transport values for the same LinkedIn connect+DM channel
  LINKEDIN: MessagingChannel.LINKEDIN_CONNECT,
  LINKEDIN_PREMIUM: MessagingChannel.LINKEDIN_CONNECT,
};

const MESSAGING_CHANNEL_TRANSPORT_KEYS: Record<MessagingChannel, string> = {
  [MessagingChannel.BAILEYS]: 'baileys',
  [MessagingChannel.WHATSAPP_UNIPILE]: 'whatsapp-unipile',
  [MessagingChannel.WHATSAPP_WEB]: 'whatsapp-web',
  [MessagingChannel.WHATSAPP_OFFICIAL]: 'whatsapp-official',
  [MessagingChannel.LINKEDIN_INMAIL]: 'linkedin-inmail',
  [MessagingChannel.LINKEDIN_SOCK]: 'linkedin-sock',
  [MessagingChannel.LINKEDIN_CONNECT]: 'linkedin',
  [MessagingChannel.COMMENT]: 'comment',
  [MessagingChannel.EMAIL]: 'email',
};

const isDefinedNonEmptyString = (
  value: string | null | undefined,
): value is string => typeof value === 'string' && value.length > 0;

export const normalizeMessagingChannel = (
  value: string | null | undefined,
): string | null => {
  if (!isDefinedNonEmptyString(value)) {
    return null;
  }

  const formatted = value.replace(/-/g, '_').toUpperCase();

  return MESSAGING_CHANNEL_ALIASES[formatted] ?? formatted;
};

export const parseMessagingChannel = (
  value: string | null | undefined,
): MessagingChannel | null => {
  const normalized = normalizeMessagingChannel(value);

  if (!normalized) {
    return null;
  }

  return (
    MESSAGING_CHANNEL_SELECT_VALUES.find(
      (channel) => channel === normalized,
    ) ?? null
  );
};

export const toMessagingChannelTransportKey = (
  value: string | null | undefined,
): string | null => {
  const parsed = parseMessagingChannel(value);

  if (parsed) {
    return MESSAGING_CHANNEL_TRANSPORT_KEYS[parsed];
  }

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

export const isWhatsappMessagingChannel = (
  value: string | null | undefined,
): boolean => messagingChannelEquals(value, ...WHATSAPP_MESSAGING_CHANNELS);

export const isLinkedinDirectMessagingChannel = (
  value: string | null | undefined,
): boolean =>
  messagingChannelEquals(value, ...LINKEDIN_DIRECT_MESSAGING_CHANNELS);

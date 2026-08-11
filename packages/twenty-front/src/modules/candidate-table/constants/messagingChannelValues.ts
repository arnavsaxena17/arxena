/** Values accepted for candidate messagingChannel (SELECT UPPER_SNAKE_CASE). */
export const MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE = [
  'BAILEYS',
  'WHATSAPP_UNIPILE',
  'WHATSAPP_WEB',
  'WHATSAPP_OFFICIAL',
  'LINKEDIN',
  'LINKEDIN_PREMIUM',
  'LINKEDIN_INMAIL',
  'LINKEDIN_SOCK',
] as const;

export type MessagingChannelBulkUpdateValue =
  (typeof MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE)[number];

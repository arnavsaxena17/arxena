/** Values accepted for candidate messagingChannel (aligned with server messaging-controls). */
export const MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE = [
  'baileys',
  'whatsapp-unipile',
  'whatsapp-web',
  'whatsapp-official',
  'linkedin',
  'linkedin-premium',
  'linkedin-inmail',
  'linkedin-sock',
] as const;

export type MessagingChannelBulkUpdateValue =
  (typeof MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE)[number];

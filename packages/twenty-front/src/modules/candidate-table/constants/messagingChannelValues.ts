import {
  MESSAGING_CHANNEL_SELECT_VALUES,
  type MessagingChannelValue,
} from 'twenty-shared/arx';

/** Values accepted for candidate messagingChannel (SELECT UPPER_SNAKE_CASE). */
export const MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE =
  MESSAGING_CHANNEL_SELECT_VALUES;

export type MessagingChannelBulkUpdateValue = MessagingChannelValue;

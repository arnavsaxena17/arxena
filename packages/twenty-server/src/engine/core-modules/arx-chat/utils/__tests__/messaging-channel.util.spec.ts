import {
  isAllowedMessagingChannel,
  MessagingChannel,
  messagingChannelEquals,
  normalizeMessagingChannel,
  toMessagingChannelTransportKey,
} from 'src/engine/core-modules/arx-chat/utils/messaging-channel.util';

describe('messaging-channel.util', () => {
  it('normalizes kebab and UPPER to the same canonical value', () => {
    expect(normalizeMessagingChannel('whatsapp-unipile')).toBe(
      MessagingChannel.WHATSAPP_UNIPILE,
    );
    expect(normalizeMessagingChannel('WHATSAPP_UNIPILE')).toBe(
      MessagingChannel.WHATSAPP_UNIPILE,
    );
  });

  it('maps CRM values to kebab transport keys', () => {
    expect(toMessagingChannelTransportKey('LINKEDIN_INMAIL')).toBe(
      'linkedin-inmail',
    );
    expect(toMessagingChannelTransportKey('baileys')).toBe('baileys');
  });

  it('compares legacy and canonical channels', () => {
    expect(
      messagingChannelEquals('linkedin-sock', MessagingChannel.LINKEDIN_SOCK),
    ).toBe(true);
    expect(messagingChannelEquals('LINKEDIN', 'linkedin')).toBe(true);
    expect(messagingChannelEquals('email', MessagingChannel.WHATSAPP_UNIPILE)).toBe(
      false,
    );
  });

  it('validates allowed channels for both forms', () => {
    expect(isAllowedMessagingChannel('linkedin-premium')).toBe(true);
    expect(isAllowedMessagingChannel('LINKEDIN_PREMIUM')).toBe(true);
    expect(isAllowedMessagingChannel('sms')).toBe(false);
  });
});

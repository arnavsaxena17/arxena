import {
  isAllowedMessagingChannel,
  isLinkedinDirectMessagingChannel,
  isWhatsappMessagingChannel,
  MessagingChannel,
  messagingChannelEquals,
  normalizeMessagingChannel,
  parseMessagingChannel,
  toMessagingChannelTransportKey,
} from '../messagingChannel';

describe('messagingChannel', () => {
  it('normalizes kebab and UPPER to the same canonical value', () => {
    expect(normalizeMessagingChannel('whatsapp-unipile')).toBe(
      MessagingChannel.WHATSAPP_UNIPILE,
    );
    expect(normalizeMessagingChannel('WHATSAPP_UNIPILE')).toBe(
      MessagingChannel.WHATSAPP_UNIPILE,
    );
  });

  it('parses known channels and rejects unknown ones', () => {
    expect(parseMessagingChannel('linkedin-connect')).toBe(
      MessagingChannel.LINKEDIN_CONNECT,
    );
    expect(parseMessagingChannel('LINKEDIN_INMAIL')).toBe(
      MessagingChannel.LINKEDIN_INMAIL,
    );
    expect(parseMessagingChannel('sms')).toBeNull();
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
    expect(
      messagingChannelEquals('email', MessagingChannel.WHATSAPP_UNIPILE),
    ).toBe(false);
  });

  it('validates allowed channels for both forms', () => {
    expect(isAllowedMessagingChannel('linkedin-premium')).toBe(true);
    expect(isAllowedMessagingChannel('LINKEDIN_PREMIUM')).toBe(true);
    expect(isAllowedMessagingChannel('sms')).toBe(false);
  });

  it('groups whatsapp and linkedin direct channels', () => {
    expect(isWhatsappMessagingChannel('whatsapp-unipile')).toBe(true);
    expect(isWhatsappMessagingChannel(MessagingChannel.EMAIL)).toBe(false);
    expect(isLinkedinDirectMessagingChannel(MessagingChannel.LINKEDIN)).toBe(
      true,
    );
    expect(
      isLinkedinDirectMessagingChannel(MessagingChannel.LINKEDIN_CONNECT),
    ).toBe(false);
  });
});

import { shouldMatchLinkedinWebhookBySalesNavigatorProviderId } from 'src/engine/core-modules/arx-chat/utils/should-match-linkedin-webhook-by-sales-navigator-provider-id.util';

describe('shouldMatchLinkedinWebhookBySalesNavigatorProviderId', () => {
  it('returns true for sales_navigator feature with ACw attendee id', () => {
    expect(
      shouldMatchLinkedinWebhookBySalesNavigatorProviderId({
        feature: 'sales_navigator',
        attendeeProviderId: 'ACwAAabcdefghij1234567890',
      }),
    ).toBe(true);
  });

  it('returns false for classic feature or classic ACo id', () => {
    expect(
      shouldMatchLinkedinWebhookBySalesNavigatorProviderId({
        feature: 'classic',
        attendeeProviderId: 'ACwAAabcdefghij1234567890',
      }),
    ).toBe(false);

    expect(
      shouldMatchLinkedinWebhookBySalesNavigatorProviderId({
        feature: 'sales_navigator',
        attendeeProviderId: 'ACoAAabcdefghij1234567890',
      }),
    ).toBe(false);
  });
});

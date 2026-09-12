import { validateOutreachInboundSignals } from 'src/engine/core-modules/outreach-command/utils/validate-outreach-inbound-signals.util';

const SLOTS = [
  { startsAt: '2026-09-10T05:30:00.000Z', endsAt: '2026-09-10T06:00:00.000Z' },
  { startsAt: '2026-09-11T09:00:00.000Z', endsAt: '2026-09-11T09:30:00.000Z' },
];

describe('validateOutreachInboundSignals', () => {
  describe('meeting time', () => {
    it('resolves an accepted slot index to the injected slot', () => {
      const result = validateOutreachInboundSignals({
        slots: SLOTS,
        acceptedSlotIndex: 1,
      });

      expect(result.startsAt).toBe('2026-09-11T09:00:00.000Z');
      expect(result.endsAt).toBe('2026-09-11T09:30:00.000Z');
    });

    it('leaves times empty when no slot was accepted', () => {
      const result = validateOutreachInboundSignals({
        slots: SLOTS,
        acceptedSlotIndex: -1,
      });

      expect(result).toMatchObject({ startsAt: '', endsAt: '' });
    });

    it.each([2, 99, 1.5, 'tomorrow', undefined, null])(
      'refuses an out-of-range or non-integer index (%p)',
      (acceptedSlotIndex) => {
        const result = validateOutreachInboundSignals({
          slots: SLOTS,
          acceptedSlotIndex,
        });

        expect(result).toMatchObject({ startsAt: '', endsAt: '' });
      },
    );

    it('accepts slots that arrive JSON-encoded inside a larger template', () => {
      const result = validateOutreachInboundSignals({
        slots: JSON.stringify(SLOTS),
        acceptedSlotIndex: 0,
      });

      expect(result.startsAt).toBe('2026-09-10T05:30:00.000Z');
    });
  });

  describe('contact grounding', () => {
    it('keeps a referral email quoted in the transcript', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Try my colleague Priya — Priya.Nair@acme.com',
        referralName: 'Priya Nair',
        referralEmail: 'priya.nair@acme.com',
      });

      expect(result.referralEmail).toBe('priya.nair@acme.com');
      expect(result.referralName).toBe('Priya Nair');
      expect(result.hasReferral).toBe(true);
    });

    it('drops a referral email that never appears in the transcript', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Speak to Priya on the platform team.',
        referralName: 'Priya Nair',
        referralEmail: 'priya.nair@acme.com',
      });

      expect(result.referralEmail).toBe('');
      expect(result.hasReferral).toBe(false);
    });

    it('treats a grounded contact without a name as actionable', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Best person for this is on 9958177936.',
        referralPhone: '9958177936',
      });

      expect(result.referralName).toBe('');
      expect(result.hasReferral).toBe(true);
    });

    it('matches a phone number written with different separators', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Rahul is the buyer, his number is 995 817-7936.',
        referralName: 'Rahul',
        referralPhone: '+91 9958177936',
      });

      expect(result.referralPhone).toBe('+91 9958177936');
      expect(result.hasReferral).toBe(true);
    });

    it('drops an invented phone number and a too-short one', () => {
      const invented = validateOutreachInboundSignals({
        transcript: 'Happy to connect you with Rahul.',
        referralPhone: '9958177936',
      });
      const tooShort = validateOutreachInboundSignals({
        transcript: 'ext 4321',
        referralPhone: '4321',
      });

      expect(invented.referralPhone).toBe('');
      expect(tooShort.referralPhone).toBe('');
    });

    it('drops a referral name that is not in the transcript', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Let me check internally and revert.',
        referralName: 'Priya Nair',
      });

      expect(result.referralName).toBe('');
    });

    it('grounds the prospect email the same way', () => {
      const quoted = validateOutreachInboundSignals({
        transcript: 'Please email me at gaurav.z@flomattress.com',
        prospectEmail: 'gaurav.z@flomattress.com',
      });
      const invented = validateOutreachInboundSignals({
        transcript: 'Please email me the details.',
        prospectEmail: 'gaurav.z@flomattress.com',
      });

      expect(quoted.prospectEmail).toBe('gaurav.z@flomattress.com');
      expect(invented.prospectEmail).toBe('');
    });
  });

  describe('reply channel', () => {
    it('answers on the last inbound channel by default', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'whatsapp',
        requestedChannelSwitch: 'NONE',
      });

      expect(result.replyChannel).toBe('WHATSAPP');
      expect(result.preferredChannelToStamp).toBe('');
    });

    it('honours an explicit switch and stamps sticky preference', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'LINKEDIN',
        requestedChannelSwitch: 'EMAIL',
      });

      expect(result.replyChannel).toBe('EMAIL');
      expect(result.preferredChannelToStamp).toBe('EMAIL');
    });

    it('uses sticky preferred channel over last inbound', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'LINKEDIN',
        preferredChannel: 'EMAIL',
        requestedChannelSwitch: 'NONE',
      });

      expect(result.replyChannel).toBe('EMAIL');
      expect(result.preferredChannelToStamp).toBe('');
    });

    it('stamps EMAIL when prospect asks for details by email', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Please email me at gaurav.z@flomattress.com',
        lastInboundChannel: 'LINKEDIN',
        prospectEmail: 'gaurav.z@flomattress.com',
      });

      expect(result.prospectEmail).toBe('gaurav.z@flomattress.com');
      expect(result.preferredChannelToStamp).toBe('EMAIL');
    });

    it('falls back to LinkedIn for an unknown channel', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'sms',
        requestedChannelSwitch: 'carrier-pigeon',
      });

      expect(result.replyChannel).toBe('LINKEDIN');
    });
  });

  it('coerces a stringified opt-out flag', () => {
    expect(
      validateOutreachInboundSignals({ shouldNotRespond: 'true' })
        .shouldNotRespond,
    ).toBe(true);
    expect(
      validateOutreachInboundSignals({ shouldNotRespond: undefined })
        .shouldNotRespond,
    ).toBe(false);
  });

  it('returns every key so downstream templates always resolve', () => {
    expect(Object.keys(validateOutreachInboundSignals({})).sort()).toEqual([
      'endsAt',
      'hasReferral',
      'preferredChannelToStamp',
      'prospectEmail',
      'referralEmail',
      'referralName',
      'referralPhone',
      'replyChannel',
      'shouldNotRespond',
      'startsAt',
      'success',
    ]);
  });
});

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

  describe('explicit meeting time', () => {
    const NOW_IST = '2026-10-07T09:00:00.000Z';

    it('uses a time the prospect named instead of our slots', () => {
      const result = validateOutreachInboundSignals({
        slots: SLOTS,
        acceptedSlotIndex: -1,
        requestedStartsAt: '2026-10-15T16:30:00.000Z',
        nowIso: NOW_IST,
      });

      expect(result).toMatchObject({
        startsAt: '2026-10-15T16:30:00.000Z',
        endsAt: '2026-10-15T17:00:00.000Z',
        startsAtIsExplicit: true,
      });
    });

    it('prefers the explicit time over an accepted slot index', () => {
      const result = validateOutreachInboundSignals({
        slots: SLOTS,
        acceptedSlotIndex: 0,
        requestedStartsAt: '2026-10-15T16:30:00.000Z',
        nowIso: NOW_IST,
      });

      expect(result.startsAt).toBe('2026-10-15T16:30:00.000Z');
    });

    it.each(['', 'next thursday', '2026-10-01T10:00:00.000Z', null])(
      'ignores an unusable or past start (%p)',
      (requestedStartsAt) => {
        const result = validateOutreachInboundSignals({
          requestedStartsAt,
          nowIso: NOW_IST,
        });

        expect(result).toMatchObject({
          startsAt: '',
          startsAtIsExplicit: false,
        });
      },
    );
  });

  describe('follow-up date', () => {
    const NOW = '2026-10-07T09:00:00.000Z';

    it('keeps a future date', () => {
      expect(
        validateOutreachInboundSignals({
          followUpAt: '2026-11-03T04:30:00.000Z',
          nowIso: NOW,
        }).followUpAt,
      ).toBe('2026-11-03T04:30:00.000Z');
    });

    it.each(['2026-10-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z', 'soon'])(
      'drops a past, too-distant or unparseable date (%p)',
      (followUpAt) => {
        expect(
          validateOutreachInboundSignals({ followUpAt, nowIso: NOW }).followUpAt,
        ).toBe('');
      },
    );

    it('never schedules a comeback after an opt-out', () => {
      expect(
        validateOutreachInboundSignals({
          followUpAt: '2026-11-03T04:30:00.000Z',
          shouldNotRespond: true,
          nowIso: NOW,
        }).followUpAt,
      ).toBe('');
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
      expect(result.whatsappTo).toBe('');
      expect(result.emailTo).toBe('');
    });

    it('keeps the acknowledgement on LinkedIn when they ask for email', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Please email me at gaurav.z@flomattress.com',
        lastInboundChannel: 'LINKEDIN',
        requestedChannelSwitch: 'EMAIL',
        prospectEmail: 'gaurav.z@flomattress.com',
      });

      expect(result.replyChannel).toBe('LINKEDIN');
      expect(result.prospectEmail).toBe('gaurav.z@flomattress.com');
      expect(result.sendWhatsappReply).toBe(false);
      expect(result.preferredChannelToStamp).toBe('EMAIL');
      expect(result.emailTo).toBe('gaurav.z@flomattress.com');
      expect(result.whatsappTo).toBe('');
    });

    it('keeps the acknowledgement on the inbound channel when a sticky preference exists', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'LINKEDIN',
        preferredChannel: 'EMAIL',
        requestedChannelSwitch: 'NONE',
      });

      expect(result.replyChannel).toBe('LINKEDIN');
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

  describe('WhatsApp alongside LinkedIn', () => {
    it('allows both when they reply on LinkedIn with their own number', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Here is my number 966512345678',
        lastInboundChannel: 'LINKEDIN',
        prospectPhone: '966512345678',
        sendWhatsappReply: true,
        preferredChannel: 'EMAIL',
      });

      expect(result.sendWhatsappReply).toBe(true);
      expect(result.prospectPhone).toBe('966512345678');
      expect(result.replyChannel).toBe('LINKEDIN');
    });

    it('drops the flag when the number is not in the thread', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Happy to chat on LinkedIn',
        lastInboundChannel: 'LINKEDIN',
        prospectPhone: '966512345678',
        sendWhatsappReply: true,
      });

      expect(result.prospectPhone).toBe('');
      expect(result.sendWhatsappReply).toBe(false);
    });

    it('sends the content on WhatsApp and keeps the acknowledgement on LinkedIn', () => {
      const result = validateOutreachInboundSignals({
        transcript:
          'Send me a message. My email is abc@xyz.com and my phone is +1 415 555 0134',
        lastInboundChannel: 'LINKEDIN',
        prospectEmail: 'abc@xyz.com',
        prospectPhone: '+1 415 555 0134',
        requestedChannelSwitch: 'NONE',
      });

      expect(result.replyChannel).toBe('LINKEDIN');
      expect(result.prospectEmail).toBe('abc@xyz.com');
      expect(result.prospectPhone).toBe('+1 415 555 0134');
      expect(result.sendWhatsappReply).toBe(true);
      expect(result.preferredChannelToStamp).toBe('WHATSAPP');
      expect(result.whatsappTo).toBe('+1 415 555 0134');
      expect(result.emailTo).toBe('');
    });

    it('sends WhatsApp content when they ask to move to WhatsApp', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'WhatsApp me on 966512345678',
        lastInboundChannel: 'LINKEDIN',
        prospectPhone: '966512345678',
        requestedChannelSwitch: 'WHATSAPP',
      });

      expect(result.sendWhatsappReply).toBe(true);
      expect(result.replyChannel).toBe('LINKEDIN');
      expect(result.preferredChannelToStamp).toBe('WHATSAPP');
    });

    it('treats a number that matches the referral as the other person', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'Talk to Sara on 966512345678',
        lastInboundChannel: 'LINKEDIN',
        prospectPhone: '+966 512 345 678',
        referralPhone: '966512345678',
        sendWhatsappReply: true,
      });

      expect(result.prospectPhone).toBe('');
      expect(result.referralPhone).toBe('966512345678');
      expect(result.sendWhatsappReply).toBe(false);
      expect(result.whatsappTo).toBe('');
    });

    it('uses the person phone when the inbound channel is WhatsApp', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'WHATSAPP',
        personPrimaryPhone: '+1 415 555 0100',
      });

      expect(result.replyChannel).toBe('WHATSAPP');
      expect(result.whatsappTo).toBe('+1 415 555 0100');
    });

    it('falls back to a grounded prospect phone when WhatsApp inbound has no CRM number', () => {
      const result = validateOutreachInboundSignals({
        transcript: 'This is my WhatsApp 966512345678',
        lastInboundChannel: 'WHATSAPP',
        prospectPhone: '966512345678',
      });

      expect(result.whatsappTo).toBe('966512345678');
    });
  });

  describe('email destination', () => {
    it('uses the person email when the inbound channel is email', () => {
      const result = validateOutreachInboundSignals({
        lastInboundChannel: 'EMAIL',
        personPrimaryEmail: 'ada@acme.com',
      });

      expect(result.replyChannel).toBe('EMAIL');
      expect(result.emailTo).toBe('ada@acme.com');
      expect(result.whatsappTo).toBe('');
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
      'emailTo',
      'endsAt',
      'followUpAt',
      'hasReferral',
      'preferredChannelToStamp',
      'prospectEmail',
      'prospectPhone',
      'referralEmail',
      'referralName',
      'referralPhone',
      'replyChannel',
      'sendWhatsappReply',
      'shouldNotRespond',
      'startsAt',
      'startsAtIsExplicit',
      'success',
      'whatsappTo',
    ]);
  });
});

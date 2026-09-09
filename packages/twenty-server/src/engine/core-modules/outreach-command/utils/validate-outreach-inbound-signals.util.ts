import { isDefined } from 'twenty-shared/utils';

// Grounds the extraction agent's output before the outreach graph acts on it.
// Every downstream side effect (create referred candidate, email the prospect,
// create a calendar invite) branches on IS_NOT_EMPTY of one of these keys, so a
// hallucinated address or an invented time would send real messages.

export const OUTREACH_REPLY_CHANNELS = [
  'LINKEDIN',
  'WHATSAPP',
  'EMAIL',
] as const;

export type OutreachReplyChannel = (typeof OUTREACH_REPLY_CHANNELS)[number];

export type OutreachInboundSignalsInput = {
  transcript?: unknown;
  slots?: unknown;
  lastInboundChannel?: unknown;
  acceptedSlotIndex?: unknown;
  requestedChannelSwitch?: unknown;
  prospectEmail?: unknown;
  referralName?: unknown;
  referralEmail?: unknown;
  referralPhone?: unknown;
  shouldNotRespond?: unknown;
};

export type OutreachValidatedInboundSignals = {
  success: true;
  startsAt: string;
  endsAt: string;
  replyChannel: OutreachReplyChannel;
  prospectEmail: string;
  referralName: string;
  referralEmail: string;
  referralPhone: string;
  hasReferral: boolean;
  shouldNotRespond: boolean;
};

type CalendarSlot = { startsAt: string; endsAt: string };

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asBoolean = (value: unknown): boolean =>
  value === true || value === 'true';

const asChannel = (value: unknown): OutreachReplyChannel | undefined => {
  const candidate = asTrimmedString(value).toUpperCase();

  return OUTREACH_REPLY_CHANNELS.find((channel) => channel === candidate);
};

// A standalone {{step.slots}} template resolves to the real array, but slots
// embedded in a larger string arrive JSON-encoded.
const parseSlots = (value: unknown): CalendarSlot[] => {
  const rawSlots = (() => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return rawSlots.flatMap((rawSlot) => {
    if (typeof rawSlot !== 'object' || !isDefined(rawSlot)) {
      return [];
    }

    const { startsAt, endsAt } = rawSlot as Record<string, unknown>;
    const slot = {
      startsAt: asTrimmedString(startsAt),
      endsAt: asTrimmedString(endsAt),
    };

    return slot.startsAt !== '' && slot.endsAt !== '' ? [slot] : [];
  });
};

const resolveSlot = ({
  acceptedSlotIndex,
  slots,
}: {
  acceptedSlotIndex: unknown;
  slots: CalendarSlot[];
}): CalendarSlot => {
  // Number(null) and Number('') are 0, which would silently book the first
  // slot when the agent sent no index at all.
  const isNumeric =
    typeof acceptedSlotIndex === 'number' ||
    (typeof acceptedSlotIndex === 'string' && acceptedSlotIndex.trim() !== '');
  const index = isNumeric ? Number(acceptedSlotIndex) : Number.NaN;

  if (!Number.isInteger(index) || index < 0 || index >= slots.length) {
    return { startsAt: '', endsAt: '' };
  }

  return slots[index];
};

// Phone numbers are written with arbitrary separators, so both sides are
// stripped down to digits before comparison.
const stripPhoneSeparators = (value: string): string =>
  value.toLowerCase().replace(/[\s\-().+]/g, '');

const digitsOf = (value: string): string => value.replace(/\D/g, '');

const groundEmail = ({
  email,
  transcript,
}: {
  email: string;
  transcript: string;
}): string => {
  if (email === '' || !email.includes('@')) {
    return '';
  }

  return transcript.toLowerCase().includes(email.toLowerCase()) ? email : '';
};

const groundPhone = ({
  phone,
  transcript,
}: {
  phone: string;
  transcript: string;
}): string => {
  const phoneDigits = digitsOf(phone);

  if (phoneDigits.length < 7) {
    return '';
  }

  const strippedTranscript = stripPhoneSeparators(transcript);
  // Recipients often omit the country code the agent adds back, so a
  // national-length suffix also counts as grounded.
  const nationalDigits = phoneDigits.slice(-10);
  const isGrounded =
    strippedTranscript.includes(phoneDigits) ||
    (nationalDigits.length >= 7 && strippedTranscript.includes(nationalDigits));

  return isGrounded ? phone : '';
};

const groundName = ({
  name,
  transcript,
}: {
  name: string;
  transcript: string;
}): string => {
  const firstName = name.split(' ')[0] ?? '';

  if (firstName.length < 2) {
    return '';
  }

  return transcript.toLowerCase().includes(firstName.toLowerCase()) ? name : '';
};

export const validateOutreachInboundSignals = (
  input: OutreachInboundSignalsInput,
): OutreachValidatedInboundSignals => {
  const transcript = asTrimmedString(input.transcript);
  const slots = parseSlots(input.slots);
  const { startsAt, endsAt } = resolveSlot({
    acceptedSlotIndex: input.acceptedSlotIndex,
    slots,
  });

  const referralEmail = groundEmail({
    email: asTrimmedString(input.referralEmail),
    transcript,
  });
  const referralPhone = groundPhone({
    phone: asTrimmedString(input.referralPhone),
    transcript,
  });
  const referralName = groundName({
    name: asTrimmedString(input.referralName),
    transcript,
  });

  return {
    success: true,
    startsAt,
    endsAt,
    replyChannel:
      asChannel(input.requestedChannelSwitch) ??
      asChannel(input.lastInboundChannel) ??
      'LINKEDIN',
    prospectEmail: groundEmail({
      email: asTrimmedString(input.prospectEmail),
      transcript,
    }),
    referralName,
    referralEmail,
    referralPhone,
    // A grounded contact is what makes a referral actionable; recipients often
    // share a number without repeating the person's name.
    hasReferral: referralEmail !== '' || referralPhone !== '',
    shouldNotRespond: asBoolean(input.shouldNotRespond),
  };
};

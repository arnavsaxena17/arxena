export const OUTREACH_INBOUND_INTENTS = [
  'unsubscribe',
  'not_now',
  'interested',
  'times_proposed',
  'book',
  'question',
] as const;

export type OutreachInboundIntent = (typeof OUTREACH_INBOUND_INTENTS)[number];

export type OutreachClassifiedOutreachStage =
  | 'STOPPED'
  | 'DEFERRED'
  | 'NEGOTIATING'
  | 'REPLIED'
  | 'MEETING_BOOKED';

export type OutreachInboundReplyClassification = {
  intent: OutreachInboundIntent;
  stage: OutreachClassifiedOutreachStage;
  confidence: number;
  reasoning: string;
  extractedTimeHint: string;
};

export const OUTREACH_INBOUND_INTENT_TO_STAGE: Record<
  OutreachInboundIntent,
  OutreachClassifiedOutreachStage
> = {
  unsubscribe: 'STOPPED',
  not_now: 'DEFERRED',
  interested: 'NEGOTIATING',
  times_proposed: 'REPLIED',
  book: 'MEETING_BOOKED',
  question: 'REPLIED',
};

const STOP_PHRASES = [
  'unsubscribe',
  'stop messaging',
  'stop emailing',
  'remove me',
  'take me off',
  'do not contact',
  "don't contact",
  'never contact',
  'leave me alone',
];

const DEFER_PHRASES = [
  'not now',
  'not a good time',
  'next quarter',
  'next year',
  'in a few months',
  'circle back',
  'ping me later',
  'reach out later',
  'too busy',
  'maybe later',
];

const BOOK_PHRASES = [
  'book it',
  "let's book",
  'lets book',
  'confirmed',
  'see you then',
  'that time works',
  'send the invite',
  'send an invite',
  'put it on my calendar',
];

const TIME_PHRASES = [
  'tuesday',
  'wednesday',
  'thursday',
  'monday',
  'friday',
  'tomorrow',
  'next week',
  'am',
  'pm',
  'o\'clock',
  'available',
  'how about',
];

const INTEREST_PHRASES = [
  'interested',
  'tell me more',
  'sounds good',
  'sounds interesting',
  'would love to',
  "let's talk",
  'lets talk',
  'happy to chat',
  'keen',
];

const includesAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

export const classifyInboundReplyFallback = (
  inboundText: string,
): OutreachInboundReplyClassification => {
  const text = inboundText.trim().toLowerCase();

  if (!text) {
    return {
      intent: 'question',
      stage: 'REPLIED',
      confidence: 0.4,
      reasoning: 'Empty inbound burst; default to reply drafting.',
      extractedTimeHint: '',
    };
  }

  if (includesAny(text, STOP_PHRASES)) {
    return {
      intent: 'unsubscribe',
      stage: 'STOPPED',
      confidence: 0.75,
      reasoning: 'Opt-out language in inbound burst.',
      extractedTimeHint: '',
    };
  }

  if (includesAny(text, BOOK_PHRASES)) {
    return {
      intent: 'book',
      stage: 'MEETING_BOOKED',
      confidence: 0.7,
      reasoning: 'Explicit booking / invite confirmation.',
      extractedTimeHint: inboundText.trim().slice(0, 280),
    };
  }

  if (includesAny(text, DEFER_PHRASES)) {
    return {
      intent: 'not_now',
      stage: 'DEFERRED',
      confidence: 0.7,
      reasoning: 'Asked to pause or follow up later.',
      extractedTimeHint: '',
    };
  }

  if (includesAny(text, TIME_PHRASES) && /\d/.test(text)) {
    return {
      intent: 'times_proposed',
      stage: 'REPLIED',
      confidence: 0.65,
      reasoning: 'Proposed a time window; confirm via reply graph.',
      extractedTimeHint: inboundText.trim().slice(0, 280),
    };
  }

  if (includesAny(text, INTEREST_PHRASES)) {
    return {
      intent: 'interested',
      stage: 'NEGOTIATING',
      confidence: 0.65,
      reasoning: 'Positive interest without a booked slot.',
      extractedTimeHint: '',
    };
  }

  return {
    intent: 'question',
    stage: 'REPLIED',
    confidence: 0.5,
    reasoning: 'No stronger intent; treat as a question / open reply.',
    extractedTimeHint: '',
  };
};

export const classificationFromIntent = ({
  intent,
  confidence,
  reasoning,
  extractedTimeHint,
}: {
  intent: string;
  confidence?: number;
  reasoning?: string;
  extractedTimeHint?: string;
}): OutreachInboundReplyClassification => {
  const normalized = OUTREACH_INBOUND_INTENTS.includes(intent as OutreachInboundIntent)
    ? (intent as OutreachInboundIntent)
    : 'question';

  return {
    intent: normalized,
    stage: OUTREACH_INBOUND_INTENT_TO_STAGE[normalized],
    confidence: Math.min(1, Math.max(0, confidence ?? 0.5)),
    reasoning: reasoning?.trim() || 'Model classification.',
    extractedTimeHint: extractedTimeHint?.trim() ?? '',
  };
};

import {
  OUTREACH_INBOUND_INTENT_TO_CONVERSATION_STAGE,
  OUTREACH_INBOUND_INTENT_TO_SEQUENCE_STAGE,
  OUTREACH_INBOUND_INTENTS,
  type OutreachConversationStage,
  type OutreachInboundIntent,
} from 'twenty-shared/arx';

export const OUTREACH_INBOUND_INTENTS_LIST = OUTREACH_INBOUND_INTENTS;

export type { OutreachInboundIntent };

export type OutreachClassifiedSequenceStage = 'STOPPED' | 'REPLIED';

export type OutreachInboundReplyClassification = {
  intent: OutreachInboundIntent;
  stage: OutreachClassifiedSequenceStage;
  conversationStage: OutreachConversationStage;
  confidence: number;
  reasoning: string;
  extractedTimeHint: string;
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

const classificationFromResolvedIntent = ({
  intent,
  confidence,
  reasoning,
  extractedTimeHint,
}: {
  intent: OutreachInboundIntent;
  confidence: number;
  reasoning: string;
  extractedTimeHint: string;
}): OutreachInboundReplyClassification => ({
  intent,
  stage: OUTREACH_INBOUND_INTENT_TO_SEQUENCE_STAGE[intent],
  conversationStage: OUTREACH_INBOUND_INTENT_TO_CONVERSATION_STAGE[intent],
  confidence,
  reasoning,
  extractedTimeHint,
});

export const classifyInboundReplyFallback = (
  inboundText: string,
): OutreachInboundReplyClassification => {
  const text = inboundText.trim().toLowerCase();

  if (!text) {
    return classificationFromResolvedIntent({
      intent: 'question',
      confidence: 0.4,
      reasoning: 'Empty inbound burst; default to reply drafting.',
      extractedTimeHint: '',
    });
  }

  if (includesAny(text, STOP_PHRASES)) {
    return classificationFromResolvedIntent({
      intent: 'unsubscribe',
      confidence: 0.75,
      reasoning: 'Opt-out language in inbound burst.',
      extractedTimeHint: '',
    });
  }

  if (includesAny(text, BOOK_PHRASES)) {
    return classificationFromResolvedIntent({
      intent: 'book',
      confidence: 0.7,
      reasoning: 'Explicit booking / invite confirmation.',
      extractedTimeHint: inboundText.trim().slice(0, 280),
    });
  }

  if (includesAny(text, DEFER_PHRASES)) {
    return classificationFromResolvedIntent({
      intent: 'not_now',
      confidence: 0.7,
      reasoning: 'Asked to pause or follow up later.',
      extractedTimeHint: '',
    });
  }

  if (includesAny(text, TIME_PHRASES) && /\d/.test(text)) {
    return classificationFromResolvedIntent({
      intent: 'times_proposed',
      confidence: 0.65,
      reasoning: 'Proposed a time window; confirm via reply graph.',
      extractedTimeHint: inboundText.trim().slice(0, 280),
    });
  }

  if (includesAny(text, INTEREST_PHRASES)) {
    return classificationFromResolvedIntent({
      intent: 'interested',
      confidence: 0.65,
      reasoning: 'Positive interest without a booked slot.',
      extractedTimeHint: '',
    });
  }

  return classificationFromResolvedIntent({
    intent: 'question',
    confidence: 0.5,
    reasoning: 'No stronger intent; treat as a question / open reply.',
    extractedTimeHint: '',
  });
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
  const normalized = OUTREACH_INBOUND_INTENTS.includes(
    intent as OutreachInboundIntent,
  )
    ? (intent as OutreachInboundIntent)
    : 'question';

  return classificationFromResolvedIntent({
    intent: normalized,
    confidence: Math.min(1, Math.max(0, confidence ?? 0.5)),
    reasoning: reasoning?.trim() || 'Model classification.',
    extractedTimeHint: extractedTimeHint?.trim() ?? '',
  });
};

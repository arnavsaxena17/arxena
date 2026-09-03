export const OUTREACH_CONVERSATION_STAGES = [
  'NONE',
  'ACKNOWLEDGEMENT',
  'INTENT',
  'FOLLOW_UP_MEETING',
  'MEETING_BOOKED',
  'NOT_INTERESTED',
  'SNOOZED',
] as const;

export type OutreachConversationStage =
  (typeof OUTREACH_CONVERSATION_STAGES)[number];

export const OUTREACH_CONVERSATION_STAGE_LABELS: Record<
  OutreachConversationStage,
  string
> = {
  NONE: 'None',
  ACKNOWLEDGEMENT: 'Acknowledgement',
  INTENT: 'Replied with intent',
  FOLLOW_UP_MEETING: 'Follow up for call / meeting',
  MEETING_BOOKED: 'Call scheduled',
  NOT_INTERESTED: 'Not interested',
  SNOOZED: 'Snoozed',
};

export const OUTREACH_INBOUND_INTENTS = [
  'unsubscribe',
  'not_now',
  'interested',
  'times_proposed',
  'book',
  'question',
] as const;

export type OutreachInboundIntent = (typeof OUTREACH_INBOUND_INTENTS)[number];

export const OUTREACH_INBOUND_INTENT_TO_CONVERSATION_STAGE: Record<
  OutreachInboundIntent,
  OutreachConversationStage
> = {
  unsubscribe: 'NOT_INTERESTED',
  not_now: 'SNOOZED',
  interested: 'INTENT',
  times_proposed: 'FOLLOW_UP_MEETING',
  book: 'MEETING_BOOKED',
  question: 'ACKNOWLEDGEMENT',
};

// Cadence only: inbound received is REPLIED; opt-out is STOPPED.
export const OUTREACH_INBOUND_INTENT_TO_SEQUENCE_STAGE: Record<
  OutreachInboundIntent,
  'REPLIED' | 'STOPPED'
> = {
  unsubscribe: 'STOPPED',
  not_now: 'REPLIED',
  interested: 'REPLIED',
  times_proposed: 'REPLIED',
  book: 'REPLIED',
  question: 'REPLIED',
};

export const isOutreachConversationStage = (
  value: string | null | undefined,
): value is OutreachConversationStage =>
  typeof value === 'string' &&
  OUTREACH_CONVERSATION_STAGES.includes(value as OutreachConversationStage);

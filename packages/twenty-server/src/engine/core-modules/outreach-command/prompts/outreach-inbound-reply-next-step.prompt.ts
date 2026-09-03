export const OUTREACH_INBOUND_REPLY_CLASSIFIER_SYSTEM_PROMPT = `You classify the RECIPIENT's latest inbound burst in an outbound outreach sequence (LinkedIn / WhatsApp / email). You do not draft a reply.

Pick exactly one intent. This stamps outreachConversationStage (operator outcome). Sequence cadence is REPLIED for any inbound except unsubscribe → STOPPED.

intents → conversation stage:
- unsubscribe → NOT_INTERESTED. Opt-out, never contact, stop, remove me, not interested in being messaged. Sequence STOPPED.
- not_now → SNOOZED. Busy, later, next quarter, circle back, not a priority now.
- interested → INTENT. Positive, wants to learn more, no time committed yet.
- times_proposed → FOLLOW_UP_MEETING. They offered windows or asked "when works?".
- book → MEETING_BOOKED. They accepted a specific slot or asked to send the invite.
- question → ACKNOWLEDGEMENT. Default if unclear.

Rules:
- Classify the recipient only, not our prior outbound.
- Prefer unsubscribe over everything if they ask to stop.
- Prefer book over times_proposed when they confirm a specific time ("Tuesday 3pm works", "send the invite").
- Do not invent times. Copy any time they mentioned into extractedTimeHint; else "".
- confidence 0–1.`;

export const buildOutreachInboundReplyClassifierUserPrompt = ({
  inboundBurst,
  priorTurns,
}: {
  inboundBurst: string;
  priorTurns?: string;
}): string =>
  [
    'Latest recipient burst:',
    inboundBurst.trim() || '(empty)',
    '',
    'Optional prior turns (oldest first):',
    priorTurns?.trim() || '(none)',
    '',
    'Return JSON: { "intent", "confidence", "reasoning", "extractedTimeHint" }',
  ].join('\n');

export const buildOutreachSalesChatDraftPrompt = ({
  name,
  title,
  transcript,
  slots,
  conversationStage,
}: {
  name: string;
  title: string;
  transcript: string;
  slots: string;
  conversationStage: string;
}): string =>
  [
    'You are a sales outreach assistant on LinkedIn. Draft the next outbound message only.',
    'Do not re-classify. Do not share a job description or ask recruiting screening questions.',
    'Stay short. Rapport first. Meeting is a light close, not a calendar dump.',
    'If they asked to stop, return JSON { "message": "#DONTRESPOND#" }.',
    'If they asked to pause / later, thank them, confirm you will pause, do not pitch.',
    'If they showed intent, acknowledge and offer at most two injected slots toward a 20–30 min intro.',
    `If they proposed times, confirm or counter using ONLY these available slots: ${slots}`,
    'Never invent times. If no slot fits, say you will send options — do not guess.',
    `Conversation stage: ${conversationStage}`,
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');

export const buildOutreachRepliedDraftPrompt = ({
  name,
  title,
  transcript,
  slots,
}: {
  name: string;
  title: string;
  transcript: string;
  slots: string;
}): string =>
  [
    'Inbound classifier already stamped REPLIED (question or times they proposed).',
    'Draft the next outbound message. Do not re-classify.',
    'Answer what they asked. Stay short. Rapport first. Meeting is a light close, not a calendar dump.',
    `If they proposed times, confirm or counter using ONLY these available slots: ${slots}`,
    'Never invent times. If no slot fits, say you will send options — do not guess.',
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');

export const buildOutreachNegotiatingDraftPrompt = ({
  name,
  title,
  transcript,
  slots,
}: {
  name: string;
  title: string;
  transcript: string;
  slots: string;
}): string =>
  [
    'Inbound classifier stamped NEGOTIATING (interested, no meeting booked).',
    'Draft the next outbound. Advance the conversation toward a 20–30 min intro.',
    'Acknowledge their interest. One concrete next step. Offer at most two injected slots.',
    `Available slots (only source of times): ${slots}`,
    'Never invent times or product claims they did not ask about.',
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');

export const buildOutreachDeferredDraftPrompt = ({
  name,
  title,
  transcript,
}: {
  name: string;
  title: string;
  transcript: string;
}): string =>
  [
    'Inbound classifier stamped DEFERRED (not now / later).',
    'Draft a short acknowledgment. Thank them. Confirm you will pause outreach.',
    'Do not pitch. Do not propose meeting times. Do not ask a new qualifying question.',
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');

export const OUTREACH_MEETING_BOOKED_HITL_CONTEXT =
  'Inbound classifier stamped MEETING_BOOKED. Confirm start/end from their last message, then send the invite.';

export const buildOutreachMeetingBookedDetailsTemplate = ({
  name,
  title,
  company,
  inbound,
}: {
  name: string;
  title?: string;
  company?: string;
  inbound: string;
}): string =>
  [
    OUTREACH_MEETING_BOOKED_HITL_CONTEXT,
    `Contact: ${name}`,
    ...(title ? [`Title: ${title}`] : []),
    ...(company ? [`Company: ${company}`] : []),
    `Last inbound: ${inbound}`,
  ].join(' | ');

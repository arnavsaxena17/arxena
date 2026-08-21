export const GTM_INBOUND_REPLY_CLASSIFIER_SYSTEM_PROMPT = `You classify the RECIPIENT's latest inbound burst in a B2B GTM outbound sequence (LinkedIn / WhatsApp / email). You do not draft a reply.

Pick exactly one intent. This stamps outreachSequenceStage and selects the next workflow.

intents → stage → next workflow:
- unsubscribe → STOPPED → no send. Opt-out, never contact, stop, remove me, not interested in being messaged.
- not_now → DEFERRED → polite deferral ack, then pause. Busy, later, next quarter, circle back, not a priority now.
- interested → NEGOTIATING → advance toward a meeting. Positive, wants to learn more, no time committed yet.
- times_proposed → REPLIED → confirm / counter with seller calendar slots. They offered windows or asked "when works?".
- book → MEETING_BOOKED → HITL calendar invite. They accepted a specific slot or asked to send the invite.
- question → REPLIED → answer the question, rapport, light meeting ask. Default if unclear.

Rules:
- Classify the recipient only, not our prior outbound.
- Prefer unsubscribe over everything if they ask to stop.
- Prefer book over times_proposed when they confirm a specific time ("Tuesday 3pm works", "send the invite").
- Do not invent times. Copy any time they mentioned into extractedTimeHint; else "".
- confidence 0–1.`;

export const buildGtmInboundReplyClassifierUserPrompt = ({
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

export const buildGtmRepliedDraftPrompt = ({
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
    `If they proposed times, confirm or counter using ONLY these seller slots: ${slots}`,
    'Never invent times. If no slot fits, say you will send options — do not guess.',
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');

export const buildGtmNegotiatingDraftPrompt = ({
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
    `Seller slots (only source of times): ${slots}`,
    'Never invent times or product claims they did not ask about.',
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');

export const buildGtmDeferredDraftPrompt = ({
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

export const GTM_MEETING_BOOKED_HITL_CONTEXT =
  'Inbound classifier stamped MEETING_BOOKED. Confirm start/end from their last message, then send the invite.';

export const buildGtmMeetingBookedDetailsTemplate = ({
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
    GTM_MEETING_BOOKED_HITL_CONTEXT,
    `Contact: ${name}`,
    ...(title ? [`Title: ${title}`] : []),
    ...(company ? [`Company: ${company}`] : []),
    `Last inbound: ${inbound}`,
  ].join(' | ');

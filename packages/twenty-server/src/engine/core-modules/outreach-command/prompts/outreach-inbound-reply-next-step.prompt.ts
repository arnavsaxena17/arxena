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

export const OUTREACH_DONT_RESPOND_SENTINEL = '#DONTRESPOND#';

export const OUTREACH_NO_CHANNEL_SWITCH = 'NONE';

// Extraction only — no prose, no intent. Every field is checkable against the
// transcript or the injected slots, which is what lets the validator step drop
// anything the model invented before the graph acts on it.
export const buildOutreachInboundSignalExtractionPrompt = ({
  transcript,
  slots,
  lastChannel,
}: {
  transcript: string;
  slots: string;
  lastChannel?: string;
}): string =>
  [
    "You extract structured signals from the recipient's inbound reply in a sales thread.",
    'You do not write a message and you do not classify intent — both happen elsewhere.',
    'Copy only what is literally in the transcript. Never infer a time or a contact detail.',
    'The transcript may span several rounds. Read the full thread, not only the last line.',
    'acceptedSlotIndex: 0-based index into Available slots of the one slot they accepted.',
    '  Only when they confirmed that specific time. Vague windows ("tomorrow", "second half",',
    '  "next week", "Friday-ish") are -1. Anything you are unsure about is -1.',
    `requestedChannelSwitch: ${OUTREACH_NO_CHANNEL_SWITCH} unless they explicitly asked to move`,
    '  channel ("email me", "WhatsApp me") — then LINKEDIN, WHATSAPP, or EMAIL.',
    'prospectEmail: an address they asked us to send details to, character for character.',
    'referralName / referralEmail / referralPhone: the other person they pointed us to,',
    '  character for character. Naming someone without contact details is normal — leave the',
    '  contact fields "" in that case rather than guessing.',
    'shouldNotRespond: true only for opt-out — stop, unsubscribe, never contact me.',
    'Use "" for any string you cannot copy from the transcript.',
    `Available slots (index order): ${slots}`,
    `Last inbound channel: ${lastChannel?.trim() || 'LINKEDIN'}`,
    `Transcript: ${transcript}`,
    'Return JSON only: {',
    '  "acceptedSlotIndex": <integer, -1 when none>,',
    `  "requestedChannelSwitch": "<${OUTREACH_NO_CHANNEL_SWITCH}|LINKEDIN|WHATSAPP|EMAIL>",`,
    '  "prospectEmail": "<email they asked us to write to, or empty>",',
    '  "referralName": "<referred person name or empty>",',
    '  "referralEmail": "<referred person email or empty>",',
    '  "referralPhone": "<referred person WhatsApp/phone or empty>",',
    '  "shouldNotRespond": <true|false>',
    '}',
  ].join('\n');

// Copy only. Times, channel and contacts arrive already validated, so this
// prompt never decides a side effect — it writes prose around given facts.
export const buildOutreachSalesChatDraftPrompt = ({
  name,
  title,
  transcript,
  slots,
  conversationStage,
  replyChannel,
  confirmedStartsAt,
  referralName,
  prospectEmail,
  shouldNotRespond,
}: {
  name: string;
  title: string;
  transcript: string;
  slots: string;
  conversationStage: string;
  replyChannel?: string;
  confirmedStartsAt?: string;
  referralName?: string;
  prospectEmail?: string;
  shouldNotRespond?: string;
}): string =>
  [
    'You drive a sales outreach conversation on LinkedIn / WhatsApp / email.',
    'Goal: book a 20–30 minute intro, not recruit them.',
    'Do not share a job description. Do not ask CTC, notice period, or any screening question.',
    'Draft the next outbound message only. Do not re-classify and do not extract contacts.',
    `If "Asked to stop" below is true, set message to "${OUTREACH_DONT_RESPOND_SENTINEL}" exactly and leave every other field empty.`,
    'Do not invent product claims they did not ask about.',
    'Be short, conversational, and to the point. Neutral tone. Plain text, no markdown.',
    'The transcript may span several rounds. Read the full thread, not only the last line.',
    `If they asked to stop or unsubscribe, set message to "${OUTREACH_DONT_RESPOND_SENTINEL}" exactly.`,
    'If they said they will discuss internally / revert / keep you posted, send a short ack or',
    `use "${OUTREACH_DONT_RESPOND_SENTINEL}" - do not pitch or offer new slots.`,
    'If they asked to pause / later / traveling, thank them, confirm you will pause, do not pitch.',
    'Wrong person: it is common that the recipient is not the buyer. Ask if they can refer',
    'the right person in the company. Do not stop just because they are the wrong fit.',
    'Write the reply for the injected reply channel. Keep it native to that channel.',
    'The injected facts below are already verified against the thread. Treat them as given:',
    '- A confirmed meeting time means the invite is already being created. Confirm it in prose',
    '  and do not offer alternatives.',
    '- No confirmed time means nothing is booked. Offer at most two of the Available slots in',
    '  prose. Never invent times from "tomorrow", "second half", or "next week".',
    '- A referral name with no contact details means you must ask them for that',
    "  person's email or WhatsApp. Fill referralMessage only once we can reach them.",
    '- referralMessage is the intro we send the referred person, not the ack to this recipient.',
    '- A prospect email means they asked for details in writing: keep the ack short and put the',
    '  detail in emailSubject and emailBody. Otherwise leave both empty.',
    'Stage playbooks:',
    '- INTENT / ACKNOWLEDGEMENT: acknowledge, offer at most two Available slots.',
    '- FOLLOW_UP_MEETING: confirm the injected time, or ask which Available slot works.',
    '- MEETING_BOOKED: confirm the injected time in prose.',
    '- SNOOZED: thank, confirm pause, no pitch.',
    `- NOT_INTERESTED: message "${OUTREACH_DONT_RESPOND_SENTINEL}".`,
    `Available slots (only source of times): ${slots}`,
    `Conversation stage: ${conversationStage}`,
    `Reply channel: ${replyChannel?.trim() || 'LINKEDIN'}`,
    `Asked to stop: ${shouldNotRespond?.trim() || 'false'}`,
    `Confirmed meeting time: ${confirmedStartsAt?.trim() || '(none)'}`,
    `Referred person: ${referralName?.trim() || '(none)'}`,
    `Prospect email for details: ${prospectEmail?.trim() || '(none)'}`,
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: {',
    '  "message": "<reply on the injected reply channel>",',
    '  "emailSubject": "<subject when emailing details, else empty>",',
    '  "emailBody": "<details email body, else empty>",',
    '  "referralMessage": "<intro to the referred person or empty>"',
    '}',
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

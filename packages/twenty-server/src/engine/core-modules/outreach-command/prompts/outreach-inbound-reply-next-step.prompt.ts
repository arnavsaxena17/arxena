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

export const buildOutreachSalesChatDraftPrompt = ({
  name,
  title,
  transcript,
  slots,
  conversationStage,
  lastChannel,
}: {
  name: string;
  title: string;
  transcript: string;
  slots: string;
  conversationStage: string;
  lastChannel?: string;
}): string =>
  [
    'You drive a sales outreach conversation on LinkedIn / WhatsApp / email.',
    'Goal: qualify interest and book a 30 minute demo.',
    'Draft the next outbound message only. Do not re-classify.',
    'Do not invent product claims they did not ask about.',
    'Be short, conversational, and to the point. Neutral tone. Plain text, no markdown.',
    'The transcript may span several rounds. Read the full thread, not only the last line.',
    `If they asked to stop or unsubscribe, set message to "${OUTREACH_DONT_RESPOND_SENTINEL}" exactly.`,
    'If they said they will discuss internally / revert / keep you posted, send a short ack or',
    `use "${OUTREACH_DONT_RESPOND_SENTINEL}" - do not pitch or offer new slots.`,
    'If they asked to pause / later / traveling, thank them, confirm you will pause, do not pitch.',
    'Wrong person: it is common that the recipient is not the buyer. Ask if they can refer',
    'the right person in the company. Do not stop just because they are the wrong fit.',
    "If they name someone else but give no contact, ask for that person's email or WhatsApp.",
    "If they have referred someone but haven't mentioned their contact details, ask them for the contact details",
    'If they have agreed to a meeting and gave a vague time, provide a few time slots and ask if it works for them',
    "If they share someone else's email or phone, thank them in message and fill referral*",
    'fields. referralMessage is the intro we send that person (not the LinkedIn ack).',
    'If they ask to email details ("email me at …"), fill prospectEmail, emailSubject, and',
    'emailBody with the details. The ack on the inbound channel is short; details go over email.',
    'If they shared an email or phone for themselves, acknowledge it. Do not dump a calendar.',
    'Answer on the channel of the last inbound message. Set replyChannel to exactly one of',
    'LINKEDIN, WHATSAPP, or EMAIL (uppercase). Default to the injected last inbound channel.',
    'Only switch if they explicitly asked to move ("email me", "WhatsApp me").',
    'If replyChannel is EMAIL, put the full reply in message and fill emailSubject.',
    'Leave prospectEmail empty unless sending a second details email to a different address.',
    'Stage playbooks:',
    '- INTENT / ACKNOWLEDGEMENT: acknowledge, offer at most two injected slots, leave times empty.',
    '- FOLLOW_UP_MEETING: confirm or counter using ONLY injected slots. Fill startsAt/endsAt',
    '  only if their window matches a slot (ISO-8601). Otherwise leave times empty and ask.',
    '- MEETING_BOOKED: confirm the agreed slot in prose and fill startsAt/endsAt from injected slots.',
    '- SNOOZED: thank, confirm pause, empty times, no pitch.',
    '- NOT_INTERESTED:',
    `  message "${OUTREACH_DONT_RESPOND_SENTINEL}", empty times.`,
    'Never invent times from "tomorrow", "second half", or "next week" unless that instant',
    'matches an injected slot. Vague windows stay empty; confirm in prose instead.',
    `Available slots (only source of times): ${slots}`,
    `Conversation stage: ${conversationStage}`,
    `Last inbound channel: ${lastChannel?.trim() || 'LINKEDIN'}`,
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${transcript}`,
    'Return JSON only: {',
    '  "message": "<ack on replyChannel>",',
    '  "startsAt": "<ISO or empty>",',
    '  "endsAt": "<ISO or empty>",',
    '  "replyChannel": "<LINKEDIN|WHATSAPP|EMAIL>",',
    '  "emailSubject": "<subject or empty>",',
    '  "emailBody": "<details email body or empty>",',
    '  "prospectEmail": "<email they asked us to write, or empty>",',
    '  "referralName": "<referred person name or empty>",',
    '  "referralEmail": "<referred person email or empty>",',
    '  "referralPhone": "<referred person WhatsApp/phone or empty>",',
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

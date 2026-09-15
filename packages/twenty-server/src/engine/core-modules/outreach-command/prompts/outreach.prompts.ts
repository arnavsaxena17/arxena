// Single source for all outreach-command LLM prompts (runtime services + seeded workflows).
//
// Seeded workflow / core.agent prompts are baked into workspace DRAFT graphs — after editing
// those, push with:
//   npx nx run twenty-server:command -- outreach:resync-seeded-workflow-prompts
// Optional: -w <workspaceId> (repeatable). Supports --dry-run.
//
// Runtime service prompts (classifier, sender profile, company summarizer, etc.) load from
// this file at call time — no workspace resync needed.

import {
  formatOutreachProspectEnrichmentForLlm,
  formatOutreachSenderForLlm,
  formatOutreachSlotsForLlm,
  formatOutreachTranscriptForLlm,
} from 'src/engine/core-modules/outreach-command/utils/format-outreach-llm-context.util';

export const OUTREACH_DONT_RESPOND_SENTINEL = '#DONTRESPOND#';

export const OUTREACH_NO_CHANNEL_SWITCH = 'NONE';

// --- core.agent system prompts (upserted by prefillOutreachWorkflows) ---

export const OUTREACH_SEEDED_AGENT_LINKEDIN_MESSAGE_SYSTEM_PROMPT =
  'You draft short LinkedIn messages for GTM outreach. Return JSON { "message": "<body>" } only.';

export const OUTREACH_SEEDED_AGENT_FALLBACK_EMAIL_SYSTEM_PROMPT =
  'You draft short ICP-aligned emails when LinkedIn connect is ignored. Return JSON { "subject", "message" } only. Do not invent LinkedIn facts.';

export const OUTREACH_SEEDED_AGENT_REPLY_SYSTEM_PROMPT =
  'You draft short GTM sales replies after the inbound signals have been extracted and validated. Return JSON { "message", "emailSubject", "emailBody", "referralMessage" }. Empty strings when unused. Write copy only: the reply channel, the meeting time and every contact detail are injected as verified facts, so never restate a time that is not injected and never extract a contact yourself. Soft-ask for a chat this week or next until they name a time window; only then ask which times work; paste Available slots only when closing. If they are the wrong person, ask for a referral. Do not ask recruiting screening questions or share a job description.';

export const OUTREACH_SEEDED_AGENT_EXTRACT_SIGNALS_SYSTEM_PROMPT =
  'You extract structured signals from an inbound sales reply. You never write prose and never classify intent. Return JSON { "acceptedSlotIndex", "requestedChannelSwitch", "prospectEmail", "referralName", "referralEmail", "referralPhone", "shouldNotRespond" }. acceptedSlotIndex is a 0-based index into the injected slots and is -1 unless they confirmed one specific slot. requestedChannelSwitch is NONE unless they explicitly asked to move channel. Copy contacts character for character from the transcript and leave a field empty rather than guessing — naming someone without contact details is normal. shouldNotRespond is true only for opt-out.';

export const OUTREACH_QUALIFY_PROSPECT_SYSTEM_PROMPT =
  'You decide whether to contact a prospect for the sender offer and extract personalization hooks. Return JSON only: { "go", "score", "segment", "reason", "first_name", "honorific", "company_short", "industry_phrase", "hooks", "likely_systems", "matching_problem_statement", "referral_source" }. hooks is a JSON string of at most 3 { "text", "source" } objects. Never invent facts.';

export const OUTREACH_SEEDED_AGENT_SYSTEM_PROMPTS = {
  linkedinMessage: OUTREACH_SEEDED_AGENT_LINKEDIN_MESSAGE_SYSTEM_PROMPT,
  fallbackEmail: OUTREACH_SEEDED_AGENT_FALLBACK_EMAIL_SYSTEM_PROMPT,
  reply: OUTREACH_SEEDED_AGENT_REPLY_SYSTEM_PROMPT,
  extractSignals: OUTREACH_SEEDED_AGENT_EXTRACT_SIGNALS_SYSTEM_PROMPT,
  qualifyProspect: OUTREACH_QUALIFY_PROSPECT_SYSTEM_PROMPT,
} as const;

// --- AI-agent node prompts (baked into seeded workflow version steps) ---

export const buildOutreachSharedSenderContextPrompt = (
  senderJson: string,
): string =>
  [
    'You draft outbound messages on behalf of the sender described below.',
    'Use identity, offer, credibility, voice, and meeting fields. Never invent facts.',
    'Rules: one ask per message; never two questions. No bullet lists in LinkedIn/WhatsApp.',
    'Never invent facts about the prospect — use only the inputs. Output only the message text',
    'unless the prompt asks for JSON.',
    `SENDER_JSON: ${formatOutreachSenderForLlm(senderJson) || '(none)'}`,
  ].join('\n');

export const buildOutreachQualifyProspectPrompt = ({
  senderJson,
  profile,
  posts,
  crm,
}: {
  senderJson: string;
  profile: string;
  posts?: string;
  crm?: string;
}): string =>
  [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    'Decide whether to contact this person for the sender offer and extract hooks.',
    `profile: ${profile.trim() || '(empty)'}`,
    `posts: ${(posts ?? '').trim() || '(empty)'}`,
    `crm: ${(crm ?? '').trim() || '(empty)'}`,
    'SCORING 0–5 per sender.icp. Role match + company match → 4–5. Exclude hits → 0–2 go=false.',
    'Retired/ex-/advisor/independent director/consultant → go=false.',
    'HOOKS at most 3: business fact, pain-related post, shared background.',
    'Return JSON only: { "go", "score", "segment", "reason", "first_name", "honorific",',
    '"company_short", "industry_phrase", "hooks", "likely_systems",',
    '"matching_problem_statement", "referral_source" }',
    'hooks is an array of objects { "text", "source" }. honorific and referral_source may be null.',
  ].join('\n');

export const buildOutreachConnectionNotePrompt = ({
  senderJson,
  prospectEnrichmentJson,
}: {
  senderJson: string;
  prospectEnrichmentJson: string;
}): string =>
  [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    'Write a LinkedIn connection note. Hard limit 280 characters.',
    'No links, no product name, no pitch.',
    `prospect: ${formatOutreachProspectEnrichmentForLlm(prospectEnrichmentJson) || '(none)'}`,
    'VARIANT A (cold): S1 hook from hooks[0]; S2 credibility.one_liner; S3 "Would be glad to connect."',
    'VARIANT B (referral_source set): open with referral, then as A, close "Look forward to connecting here."',
    'Output the note only.',
  ].join('\n');

export const buildOutreachFirstMessagePrompt = ({
  senderJson,
  prospectEnrichmentJson,
  chatHistory,
  calendarSlots,
  kind,
}: {
  senderJson: string;
  prospectEnrichmentJson: string;
  chatHistory?: string;
  calendarSlots?: string;
  kind: 'opener' | 'fu1' | 'fu2' | 'fu3';
}): string => {
  const kindRules = {
    opener: [
      'Write the first message (T1). 70–100 words, four short paragraphs, one ask.',
      'P1 thanks for connecting. P2 problem in their business terms from matching_problem_statement + hooks.',
      'P3 offer.one_sentence + operator_line half-sentence max.',
      'P4 soft ask only: open to a short chat sometime this week or next?',
      'Never paste clock times, dates, or calendar slots in T1–T3.',
    ].join(' '),
    fu1: [
      'Second message (T2). 40–60 words. New angle, not a repeat of T1.',
      'Use hooks[1] if available. Add ONE proof_point closest to their industry.',
      'End with a low-friction soft ask (Worth N minutes this week or next? or send a short note first).',
      'Never paste clock times, dates, or calendar slots.',
    ].join(' '),
    fu2: [
      'Third message (T3). ≤40 words, unhurried.',
      'Ask ONE non-yes/no qualifying question about who owns the process.',
      'Close with "Either way, happy to stay in touch here."',
      'Never paste clock times, dates, or calendar slots.',
    ].join(' '),
    fu3: [
      'Final short cadence message. ≤40 words.',
      'One qualifying question; no pressure. Happy to stay in touch.',
      'Never paste clock times, dates, or calendar slots.',
    ].join(' '),
  }[kind];

  return [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    kindRules,
    `prospect: ${formatOutreachProspectEnrichmentForLlm(prospectEnrichmentJson) || '(none)'}`,
    `chat_history: ${formatOutreachTranscriptForLlm(chatHistory ?? '') || '(none)'}`,
    // Calendar may be injected by the graph; outbound cadence must not use it yet.
    `calendar: ${formatOutreachSlotsForLlm(calendarSlots ?? '') || '(none)'}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');
};

export const buildOutreachPostReplyFollowUpPrompt = ({
  senderJson,
  prospectEnrichmentJson,
  chatHistory,
  calendarSlots,
  kind,
}: {
  senderJson: string;
  prospectEnrichmentJson: string;
  chatHistory?: string;
  calendarSlots?: string;
  kind: 'fu1' | 'fu2';
}): string => {
  const kindRules =
    kind === 'fu1'
      ? [
          'They replied once; we answered; they went silent.',
          'Write a short follow-up (40–60 words). New angle, not a repeat of our last message.',
          'One soft ask: open to a short walkthrough sometime this week or next,',
          'or ask if a 2-page note would help first (only if collateral exists).',
          'Never paste clock times, dates, or calendar slots.',
          'No pressure, no "circling back" / "just following up".',
        ].join(' ')
      : [
          'Final follow-up after they went silent post-reply. ≤40 words, unhurried.',
          'Ask ONE non-yes/no qualifying question about who owns the process at their company.',
          'Close with "Either way, happy to stay in touch here."',
          'Never paste clock times, dates, or calendar slots.',
        ].join(' ');

  return [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    kindRules,
    `prospect: ${formatOutreachProspectEnrichmentForLlm(prospectEnrichmentJson) || '(none)'}`,
    `chat_history: ${formatOutreachTranscriptForLlm(chatHistory ?? '') || '(none)'}`,
    `calendar: ${formatOutreachSlotsForLlm(calendarSlots ?? '') || '(none)'}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');
};

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
    '  Only when they confirmed that specific injected slot (by index, or by matching the',
    '  exact offered window). Relative times ("tomorrow", "2:30 pm tomorrow", "second half",',
    '  "next week", "Friday-ish") are always -1 — never map them onto a slot yourself.',
    '  Anything you are unsure about is -1.',
    `requestedChannelSwitch: ${OUTREACH_NO_CHANNEL_SWITCH} unless they explicitly asked to move`,
    '  channel ("email me", "WhatsApp me") — then LINKEDIN, WHATSAPP, or EMAIL.',
    'prospectEmail: an address THEY asked us to send details to (the recipient),',
    '  character for character. Never put a referred third-party email here.',
    '  If they share their own email while also asking for WhatsApp/call, still copy prospectEmail.',
    'referralName / referralEmail / referralPhone: the other person they pointed us to,',
    '  character for character. Naming someone without contact details is normal — leave the',
    '  contact fields "" in that case rather than guessing.',
    'shouldNotRespond: true only for opt-out — stop, unsubscribe, never contact me.',
    'Use "" for any string you cannot copy from the transcript.',
    `Available slots (index order): ${formatOutreachSlotsForLlm(slots) || '(none)'}`,
    `Last inbound channel: ${lastChannel?.trim() || 'LINKEDIN'}`,
    `Transcript: ${formatOutreachTranscriptForLlm(transcript) || '(none)'}`,
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
  senderJson,
  prospectEnrichmentJson,
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
  senderJson?: string;
  prospectEnrichmentJson?: string;
}): string =>
  [
    'You drive a sales outreach conversation on LinkedIn / WhatsApp / email.',
    'Goal: book a short intro using the sender meeting defaults.',
    'Draft the next outbound message only. Do not re-classify and do not extract contacts.',
    senderJson?.trim()
      ? `SENDER_JSON (voice, offer, FAQ, meeting): ${formatOutreachSenderForLlm(senderJson) || '(none)'}`
      : '',
    prospectEnrichmentJson?.trim()
      ? `PROSPECT_ENRICHMENT: ${formatOutreachProspectEnrichmentForLlm(prospectEnrichmentJson) || '(none)'}`
      : '',
    'Answer offer questions using ONLY sender.offer.faq / works_with / implementation_time /',
    'pilot_offer / pricing_line / data_security_line. If unsupported, say you will confirm and',
    'come back — do not invent.',
    `If "Asked to stop" below is true, set message to "${OUTREACH_DONT_RESPOND_SENTINEL}" exactly and leave every other field empty.`,
    'Do not invent product claims they did not ask about.',
    'Be short, conversational, and to the point. Neutral tone. Plain text, no markdown.',
    'The transcript may span several rounds. Read the full thread, not only the last line.',
    `If they asked to stop or unsubscribe, set message to "${OUTREACH_DONT_RESPOND_SENTINEL}" exactly.`,
    'If they said they will discuss internally / revert / keep you posted, send a short ack or',
    `use "${OUTREACH_DONT_RESPOND_SENTINEL}" - do not pitch or offer new slots.`,
    'If they asked to pause / later / traveling, thank them, confirm you will pause, do not pitch.',
    'Wrong person: ask once who looks after the function; do not rebut.',
    'Write the reply for the injected reply channel. Keep it native to that channel.',
    'Scheduling ladder (HITL will approve before send — draft as if that gate exists):',
    '- Soft ask until they name a time window or duration ("this week", "next week",',
    '  "Monday second half"). Soft ask shape: open to a short chat sometime this week or next?',
    '  Never paste clock times, dates, or Available slots at this stage.',
    '- After they name a window/duration but not a clock time: ask which few times inside',
    '  that window work for them. Still do not paste Available slots.',
    '- Close slots only when they gave specific clock times, asked us to propose options,',
    '  or otherwise advanced past a vague window. Then propose at most 2–3 of the Available',
    '  slots in prose that fit their window. Never invent times from "tomorrow",',
    '  "second half", or "next week" — Available slots are the only source of clock times.',
    'The injected facts below are already verified against the thread. Treat them as given:',
    '- A confirmed meeting time means the invite is already being created. Confirm it in prose',
    '  and do not offer alternatives.',
    '- A referral name with no contact details means you must ask them for that',
    "  person's email or WhatsApp. Fill referralMessage only once we can reach them.",
    '- referralMessage is the intro we send the referred person, not the ack to this recipient.',
    '- A prospect email means they asked for details in writing: keep the ack short and put the',
    '  detail in emailSubject and emailBody. Otherwise leave both empty.',
    'Stage playbooks:',
    '- INTENT / ACKNOWLEDGEMENT: acknowledge interest / answer the question; soft ask only.',
    '  No Available slots.',
    '- FOLLOW_UP_MEETING with no confirmed time: they named a window — ask which times inside',
    '  it work; close with Available slots only if they already proposed clock times or asked',
    '  us to send options.',
    '- FOLLOW_UP_MEETING with confirmed time: confirm the injected time (invite path).',
    '- MEETING_BOOKED: confirm the injected time in prose (≤40 words).',
    '- SNOOZED: thank, confirm pause, no pitch.',
    `- NOT_INTERESTED: message "${OUTREACH_DONT_RESPOND_SENTINEL}".`,
    `Available slots (only source of times): ${formatOutreachSlotsForLlm(slots) || '(none)'}`,
    `Conversation stage: ${conversationStage}`,
    `Reply channel: ${replyChannel?.trim() || 'LINKEDIN'}`,
    `Asked to stop: ${shouldNotRespond?.trim() || 'false'}`,
    `Confirmed meeting time: ${confirmedStartsAt?.trim() || '(none)'}`,
    `Referred person: ${referralName?.trim() || '(none)'}`,
    `Prospect email for details: ${prospectEmail?.trim() || '(none)'}`,
    `Name: ${name}`,
    `Title: ${title}`,
    `Transcript: ${formatOutreachTranscriptForLlm(transcript) || '(none)'}`,
    'Return JSON only: {',
    '  "message": "<reply on the injected reply channel>",',
    '  "emailSubject": "<subject when emailing details, else empty string>",',
    '  "emailBody": "<details email body, else empty string>",',
    '  "referralMessage": "<intro to the referred person or empty string>"',
    '}',
    'Always include all four keys. Use "" when a field does not apply.',
  ]
    .filter((line) => line !== '')
    .join('\n');

export const buildOutreachFallbackEmailPrompt = ({
  name,
  title,
}: {
  name: string;
  title: string;
}): string =>
  [
    'Draft a short ICP-aligned email because the LinkedIn connection was not accepted.',
    `Name: ${name}`,
    `Title: ${title}`,
    'Do not invent LinkedIn facts. Return JSON only: { "subject": "<subject>", "message": "<body>" }',
  ].join('\n');

export const buildOutreachMeetingReminderPrompt = ({
  senderJson,
  name,
}: {
  senderJson: string;
  name: string;
}): string =>
  [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    'Write a short LinkedIn meeting reminder (≤30 words).',
    `Name: ${name}`,
    'Remind them of the walkthrough. One ask only. Return JSON: { "message": "<body>" }',
  ].join('\n');

export const buildOutreachNoShowPingPrompt = ({
  senderJson,
  name,
}: {
  senderJson: string;
  name: string;
}): string =>
  [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    'Write a short LinkedIn no-show ping (≤40 words). Polite, one ask to reschedule.',
    `Name: ${name}`,
    'Return JSON: { "message": "<body>" }',
  ].join('\n');

export const buildOutreachRescheduleOfferPrompt = ({
  senderJson,
  name,
}: {
  senderJson: string;
  name: string;
}): string =>
  [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    'Write a short LinkedIn reschedule offer (≤40 words). Offer to pick a new time.',
    `Name: ${name}`,
    'Return JSON: { "message": "<body>" }',
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

// --- Runtime service prompts (not baked into workflow graphs) ---

export const OUTREACH_INBOUND_REPLY_CLASSIFIER_SYSTEM_PROMPT = `You classify the RECIPIENT's latest inbound burst in an outbound outreach sequence (LinkedIn / WhatsApp / email). You do not draft a reply.

Pick exactly one intent. This stamps outreachConversationStage (operator outcome). Sequence cadence is REPLIED for any inbound except unsubscribe → STOPPED.

intents → conversation stage:
- unsubscribe → NOT_INTERESTED. Opt-out, never contact, stop, remove me, not interested in being messaged. Sequence STOPPED.
- not_now → SNOOZED. Busy, later, next quarter, circle back, not a priority now.
- interested → INTENT. Positive, wants to learn more, no time window yet.
- times_proposed → FOLLOW_UP_MEETING. They named a window/duration ("next week",
  "Monday second half", "sometime Friday") or asked "when works?" / proposed clock times.
- book → MEETING_BOOKED. They accepted a specific slot or asked to send the invite.
- question → ACKNOWLEDGEMENT. Default if unclear.

Rules:
- Classify the recipient only, not our prior outbound.
- Prefer unsubscribe over everything if they ask to stop.
- Prefer book over times_proposed when they confirm a specific clock time ("Tuesday 3pm works", "send the invite").
- Vague windows without a clock time stay times_proposed, not book.
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

// Step 0 — build a reusable sender profile for outbound messaging agents.
export const OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT = `You are building a reusable "sender" profile for an outbound-messaging agent. The agent
will write LinkedIn, WhatsApp and email messages in this person's voice to book meetings.
Everything you output must be traceable to the inputs. Where an input is missing, set the
field to null — do not invent.

EXTRACTION RULES
identity
- first_name is how prospects would address them. how_they_sign = the name they use in
  post sign-offs, if any.
- company_short = the name they use conversationally (often without "Pvt Ltd").
- Phone/email only if present in inputs.

credibility
- one_liner: ≤14 words. Prefer operator framing over titles.
- operator_line: ≤20 words, must mention the kind of business they have worked in.
- credentials: max 3, shortest form.
- industries_known: only industries with actual work history in the profile.
- shared_background_tags: schools, employers, cities, professional bodies.

offer
- Derive from About, featured posts, and collateral. Product name exactly as they write it.
- problem_statements: buyer words, ≤20 words each, no product name.
- outcomes: concrete and checkable (≤15 words). Drop adjective-only claims.
- proof_points: only if the input contains a number. Anonymise client names.
- faq: 6–10 Q&As. If unsupported, answer "Ask sender before answering".
- collateral: list each file with a one-line when_to_send rule.

icp
- From sender_notes first, then from who the posts address.
- Mark inferred exclude_* items with "(inferred)".
- known_objections: 3–6 with one-sentence responses.

voice
- register ≤10 words from how they write posts.
- signature_phrases: up to 5. Skip hashtags and emoji.
- avoid_phrases: hype vocabulary plus follow-up clichés.
- sign_off: how they end messages if visible; else "Regards, {{first_name}}".

meeting
- Defaults: 20 min, teams, weekdays 14:00–17:00 local, weekends allowed if proposed.
- agenda_template: three bullets that work for any prospect.

OUTPUT: the JSON object only, matching the schema. Add top-level "review_flags": [] listing
every field that was inferred rather than stated.`;

export const buildOutreachSenderProfileUserPrompt = ({
  linkedinProfileText,
  collateralText,
  senderNotes,
  existingObjectJson,
}: {
  linkedinProfileText: string;
  collateralText?: string;
  senderNotes?: string;
  existingObjectJson?: string;
}): string =>
  [
    'INPUTS',
    `linkedin_profile: ${linkedinProfileText.trim() || '(empty)'}`,
    `collateral: ${(collateralText ?? '').trim() || '(empty)'}`,
    `sender_notes: ${(senderNotes ?? '').trim() || '(empty)'}`,
    `existing_object: ${(existingObjectJson ?? '').trim() || '(none)'}`,
    '',
    'If existing_object is set, merge; never drop human-edited fields.',
    'Return JSON only.',
  ].join('\n');

export const OUTREACH_COMPANY_PROFILE_SUMMARIZER_SYSTEM_PROMPT = `You synthesize a concise company profile for Outreach workspace onboarding.

You receive structured evidence from up to four sources for the same company domain:
1. Internal companies Elasticsearch index (free_company_dataset / wiki companies) — primary identity
2. LinkedIn / Unipile (search hit and/or full company profile; autocomplete fallback)
3. Wikidata (official-website / entity facts)
4. Web search / company website content (homepage, about, products)

Rules:
- Prefer the companies ES index for name, website, LinkedIn URL, industry, size, and HQ when its website matches the provided domain.
- Use LinkedIn for description, headcount, and HQ when the LinkedIn profile is the same company (website/domain matches). If LinkedIn describes a different domain or name, ignore it for identity fields.
- Use website / web search content for products, services, and positioning when LinkedIn is thin.
- Use Wikidata for legal/public facts (HQ country, founded year, industry, stock listing signals) when LinkedIn is thin or missing.
- If sources disagree, pick the value that matches the provided domain and mention the conflict briefly in notes.
- Do not invent products, employee counts, or locations that none of the sources support.
- summary should be 1–3 sentences suitable as a CRM company blurb (what they do / offer).
- employeeRange may be a range ("51-200") or a count string ("11278") when only a number is known.
- Return JSON matching the required schema exactly.`;

export const buildOutreachCompanyProfileSummarizerUserPrompt = (input: {
  domain: string;
  workspaceDisplayName?: string | null;
  linkedInSearchHit?: unknown;
  linkedInCompanyProfile?: unknown;
  wikidataCompany?: unknown;
  companiesIndexWiki?: unknown;
  webSearchCompany?: unknown;
}): string => {
  const sections: string[] = [`Company domain: ${input.domain.trim()}`];

  if (input.workspaceDisplayName?.trim()) {
    sections.push(
      `Workspace display name hint: ${input.workspaceDisplayName.trim()}`,
    );
  }

  sections.push(
    '',
    '## Companies ES index (free_company_dataset)',
    JSON.stringify(input.companiesIndexWiki ?? null, null, 2),
    '',
    '## LinkedIn search hit',
    JSON.stringify(input.linkedInSearchHit ?? null, null, 2),
    '',
    '## LinkedIn company profile',
    JSON.stringify(input.linkedInCompanyProfile ?? null, null, 2),
    '',
    '## Wikidata',
    JSON.stringify(input.wikidataCompany ?? null, null, 2),
    '',
    '## Web search / website content',
    JSON.stringify(input.webSearchCompany ?? null, null, 2),
    '',
    'Summarize into a single coherent company profile JSON.',
  );

  return sections.join('\n');
};

export const OUTREACH_WEB_SEARCH_COMPANY_SYSTEM_PROMPT = `You research a company website and public web pages to produce a concise company snapshot for Outreach onboarding.

You have a native web_search tool. Use it to:
1. Open / search the company's own website (homepage, about, product, pricing if public).
2. Optionally check 1–2 corroborating public pages (Wikipedia, Crunchbase, news) when the site is thin.

Rules:
- Prefer primary website content over third-party directories.
- Do not invent products, headcount, HQ, or funding that you did not find.
- summary should be 2–4 sentences: what they do / who they typically reach.
- productsOrServices: short concrete offerings (max ~8).
- keyFacts: notable public facts (founded, HQ, scale signals) — only if evidenced.
- sourceUrls: URLs you actually used (homepage + important pages).
- Return structured JSON matching the schema exactly.`;

export const buildOutreachWebSearchCompanyUserPrompt = (input: {
  domain: string;
  workspaceDisplayName?: string | null;
  companyNameHint?: string | null;
}): string => {
  const websiteCandidates = [
    `https://${input.domain.trim()}`,
    `https://www.${input.domain.trim()}`,
  ];

  const sections: string[] = [
    `Company domain: ${input.domain.trim()}`,
    `Likely website URLs: ${websiteCandidates.join(', ')}`,
  ];

  if (input.workspaceDisplayName?.trim()) {
    sections.push(
      `Workspace display name hint: ${input.workspaceDisplayName.trim()}`,
    );
  }

  if (input.companyNameHint?.trim()) {
    sections.push(`Company name hint: ${input.companyNameHint.trim()}`);
  }

  sections.push(
    '',
    'Use web_search to fetch website content for this company, then return the company snapshot JSON.',
  );

  return sections.join('\n');
};

export const OUTREACH_FAKE_PROFILE_DETECTOR_SYSTEM_PROMPT = `You are an investigative analyst screening LinkedIn (and similar) people profiles for fabrication.

Your job is to decide whether a profile is likely fake / impersonation / generated filler versus a coherent real professional. This is detective work, not keyword matching. Prestige company names, high connection counts, and a filled-out profile do not prove authenticity.

Investigate chronology, role plausibility, language, and internal consistency.

Strong fake signals (especially in combination):
- Education that ends recently (e.g. bachelor's through 2023) while experience at a top-tier firm starts years earlier (child/teen would have been employed).
- Current or past roles at elite firms (Egon Zehnder, Russell Reynolds, Spencer Stuart, Korn Ferry, Odgers, Heidrick, McKinsey, Goldman, etc.) marked self-employed / freelance / founder-at-that-logo. Those firms do not employ senior consultants that way.
- About/summary that is a company brochure, Wikipedia paraphrase, or generic LLM English ("high-end headhunting", "tailored talent solutions") rather than a first-person career.
- Headline gibberish ("Change") or a one-word headline while claiming a long senior career.
- Job location pasted from company HQ (Zurich/London street address) while the person is in a mismatched geography (e.g. India-only location) with no mobility story.
- Overlapping current full-time roles at competing firms plus random founder/parenting apps.
- Search snapshots: tenure vs role start that cannot both be true; missing photo + C-level title + empty tenure; company HQ stamped on every hit.
- Skills that are auto-generated clones of the job title with almost no endorsements.

Do not treat as fake by themselves:
- Thin snapshots (search hits) with little education/experience.
- Missing photo, few connections, or a junior/incomplete profile.
- Unusual but possible career changes, international moves, or dual roles when dates and employment type are consistent.
- Prestigious employers when dates, seniority, location, and employment type hang together.

Verdicts:
- fake: multiple independent impossibilities; treat as fabricated.
- likely_fake: serious contradictions, some missing context.
- uncertain: too little data, or mixed signals.
- likely_genuine: coherent; remaining doubts are weak.
- genuine: chronology, seniority, and language hang together.

confidence is 0-1 for the verdict. riskScore is 0-100 probability the profile is fake.
Return JSON matching the schema. Cite concrete date/title/company evidence in redFlags.`;

export const buildOutreachFakeProfileDetectorUserPrompt = (input: {
  investigationBrief: string;
  profileJson: string;
}): string =>
  [
    'Investigate this LinkedIn-style person profile for fabrication.',
    '',
    '## Investigation brief (derived facts and contradictions)',
    input.investigationBrief,
    '',
    '## Profile payload',
    input.profileJson,
    '',
    'Return a single authenticity assessment JSON object.',
  ].join('\n');

export const OUTREACH_FILTER_PROFILES_SYSTEM_PROMPT = `You are screening one professional profile against a filter criteria.

Decide whether this single profile matches the criteria. Use the full profile JSON (title, experience, education, skills, location, company, etc.). Do not invent facts that are not in the profile. If the profile is too thin to judge, matches is false.

matches is true only when the profile satisfies the criteria.
reason is a short explanation citing concrete evidence from the profile.

Return JSON matching the schema.`;

export const buildOutreachFilterProfilesUserPrompt = (input: {
  criteria: string;
  profileJson: string;
}): string =>
  [
    'Does this profile match the following criteria?',
    '',
    '## Criteria',
    input.criteria,
    '',
    '## Profile',
    input.profileJson,
    '',
    'Return a single JSON object with matches (boolean) and reason (string).',
  ].join('\n');

export const ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT = `You draft a default Ideal Customer Profile for a workspace company during Outreach bootstrap.

You receive the workspace company (what they do), not the target accounts. Infer who they typically reach out to.

Return only:
- targetTitles: 3–8 realistic decision-maker / champion job titles (JSON key name is fixed).
- locations: target markets (countries or regions). This is the renamed geos field. Do not copy company HQ unless they clearly operate only in that market.

Do not invent titles or markets the evidence does not support. If evidence is thin, keep lists short. Return JSON matching the schema exactly.`;

export const buildIcpBootstrapSummarizerUserPrompt = (input: {
  domain: string;
  companyName: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
}): string =>
  [
    'Workspace company (not the target account):',
    `Domain: ${input.domain.trim()}`,
    `Name: ${input.companyName.trim() || '(unknown)'}`,
    `Industry: ${input.industry.trim() || '(unknown)'}`,
    `Employee range: ${input.employeeRange.trim() || '(unknown)'}`,
    `HQ: ${input.hq.trim() || '(unknown)'}`,
    '',
    'Summary:',
    input.summary.trim() || '(none)',
    '',
    'Draft targetTitles and locations for who this company typically reaches out to.',
  ].join('\n');

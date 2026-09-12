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

// Shared preamble prepended to Steps 1–7 drafting prompts.
export const buildOutreachSharedSenderContextPrompt = (
  senderJson: string,
): string =>
  [
    'You draft outbound messages on behalf of the sender described in SENDER_JSON below.',
    'Use identity, offer, credibility, voice, and meeting fields. Never invent facts.',
    'Rules: one ask per message; never two questions. No bullet lists in LinkedIn/WhatsApp.',
    'Never invent facts about the prospect — use only the inputs. Output only the message text',
    'unless the prompt asks for JSON.',
    `SENDER_JSON: ${senderJson.trim() || '{}'}`,
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
    `prospect: ${prospectEnrichmentJson.trim() || '{}'}`,
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
      'P4 ask for default_duration_min walkthrough with two concrete windows from calendar.',
    ].join(' '),
    fu1: [
      'Second message (T2). 40–60 words. New angle, not a repeat of T1.',
      'Use hooks[1] if available. Add ONE proof_point closest to their industry.',
      'End with a low-friction ask (Worth N minutes? or send a short note first).',
    ].join(' '),
    fu2: [
      'Third message (T3). ≤40 words, unhurried.',
      'Ask ONE non-yes/no qualifying question about who owns the process.',
      'Close with "Either way, happy to stay in touch here."',
    ].join(' '),
    fu3: [
      'Final short cadence message. ≤40 words.',
      'One qualifying question; no pressure. Happy to stay in touch.',
    ].join(' '),
  }[kind];

  return [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    kindRules,
    `prospect: ${prospectEnrichmentJson.trim() || '{}'}`,
    `chat_history: ${(chatHistory ?? '').trim() || '(none)'}`,
    `calendar: ${(calendarSlots ?? '').trim() || '(none)'}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');
};

// After we answered their inbound and they went quiet — resume toward a meeting.
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
          'One ask: offer two concrete windows from calendar for a short walkthrough,',
          'or ask if a 2-page note would help first (only if collateral exists).',
          'No pressure, no "circling back" / "just following up".',
        ].join(' ')
      : [
          'Final follow-up after they went silent post-reply. ≤40 words, unhurried.',
          'Ask ONE non-yes/no qualifying question about who owns the process at their company.',
          'Close with "Either way, happy to stay in touch here."',
        ].join(' ');

  return [
    buildOutreachSharedSenderContextPrompt(senderJson),
    '',
    kindRules,
    `prospect: ${prospectEnrichmentJson.trim() || '{}'}`,
    `chat_history: ${(chatHistory ?? '').trim() || '(none)'}`,
    `calendar: ${(calendarSlots ?? '').trim() || '(none)'}`,
    'Return JSON only: { "message": "<body>" }',
  ].join('\n');
};

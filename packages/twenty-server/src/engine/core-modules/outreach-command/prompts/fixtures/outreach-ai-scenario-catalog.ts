import {
  OUTREACH_AI_DEFAULT_PROSPECT_ENRICHMENT_JSON,
  OUTREACH_AI_EVAL_SLOTS,
  OUTREACH_AI_EVAL_SLOTS_JSON,
  OUTREACH_AI_NARESH_SENDER_JSON,
  OUTREACH_AI_REFERRAL_PROSPECT_ENRICHMENT_JSON,
} from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-shared.fixtures';
import { type OutreachAiScenario } from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-scenario.types';
import { OUTREACH_AI_TRANSCRIPTS } from 'src/engine/core-modules/outreach-command/prompts/fixtures/transcripts/outreach-ai-naresh-transcripts';
import { OUTREACH_DONT_RESPOND_SENTINEL } from 'src/engine/core-modules/outreach-command/prompts/outreach-inbound-reply-next-step.prompt';

const slots = [...OUTREACH_AI_EVAL_SLOTS];
const slotsJson = OUTREACH_AI_EVAL_SLOTS_JSON;
const senderJson = OUTREACH_AI_NARESH_SENDER_JSON;
const enrichmentJson = OUTREACH_AI_DEFAULT_PROSPECT_ENRICHMENT_JSON;

const emptyExtract = {
  acceptedSlotIndex: -1,
  requestedChannelSwitch: 'NONE' as const,
  prospectEmail: '',
  referralName: '',
  referralEmail: '',
  referralPhone: '',
  shouldNotRespond: false,
};

export const OUTREACH_AI_SCENARIO_CATALOG: OutreachAiScenario[] = [
  // --- must: extract ---
  {
    id: 'extract-book-slot-explicit',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Prospect explicitly accepts injected slot 0',
    tags: ['extract', 'meeting', 'synthetic'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.explicitSlotAccept.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: { ...emptyExtract, acceptedSlotIndex: 0 },
      validate: {
        startsAt: slots[0].startsAt,
        endsAt: slots[0].endsAt,
        shouldNotRespond: false,
      },
    },
  },
  {
    id: 'extract-relative-time-sanil',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description:
      'Sanil phone + "2:30 pm tomorrow" is relative → acceptedSlotIndex -1 per prompt rules',
    sourcePublicIdentifier:
      OUTREACH_AI_TRANSCRIPTS.sanilPhoneAndRelativeTime.sourcePublicIdentifier,
    tags: ['extract', 'vague-time', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.sanilPhoneAndRelativeTime.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: { ...emptyExtract },
      validate: { startsAt: '', endsAt: '' },
    },
  },
  {
    id: 'extract-vague-time-pulkit',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Pulkit vague "tomorrow / second half" → acceptedSlotIndex -1',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.pulkitVagueTime.sourcePublicIdentifier,
    tags: ['extract', 'vague-time', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.pulkitVagueTime.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: { ...emptyExtract },
      validate: { startsAt: '', endsAt: '' },
    },
  },
  {
    id: 'extract-channel-email-gaurav',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Gaurav asks to email a literal address',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.gauravEmail.sourcePublicIdentifier,
    tags: ['extract', 'email', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.gauravEmail.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: {
        ...emptyExtract,
        requestedChannelSwitch: 'EMAIL',
        prospectEmail: 'gaurav.zatakia@flomattress.com',
      },
      validate: {
        prospectEmail: 'gaurav.zatakia@flomattress.com',
        replyChannel: 'EMAIL',
      },
    },
  },
  {
    id: 'extract-channel-switch-whatsapp-kamallath',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Kamallath asks for WhatsApp + shares email/phone',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.kamallathWhatsapp.sourcePublicIdentifier,
    tags: ['extract', 'whatsapp', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.kamallathWhatsapp.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: {
        ...emptyExtract,
        requestedChannelSwitch: 'WHATSAPP',
        prospectEmail: 'kamallath@gmail.com',
      },
      validate: {
        prospectEmail: 'kamallath@gmail.com',
        replyChannel: 'WHATSAPP',
      },
    },
  },
  {
    id: 'extract-referral-ashlyn-with-contact',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Ashlyn refers CFO with phone + email grounded in transcript',
    sourcePublicIdentifier:
      OUTREACH_AI_TRANSCRIPTS.ashlynReferralWithContact.sourcePublicIdentifier,
    tags: ['extract', 'referral', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.ashlynReferralWithContact.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: {
        ...emptyExtract,
        referralName: 'Jitendar Singh',
        referralEmail: 'cfo@redlandsmotors.com',
        referralPhone: '+91 8139-898930',
      },
      validate: {
        hasReferral: true,
        referralEmail: 'cfo@redlandsmotors.com',
      },
    },
  },
  {
    id: 'extract-referral-rajesh-no-contact',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Rajesh names CEO without contact details',
    sourcePublicIdentifier:
      OUTREACH_AI_TRANSCRIPTS.rajeshReferralNoContact.sourcePublicIdentifier,
    tags: ['extract', 'referral', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.rajeshReferralNoContact.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: {
        ...emptyExtract,
        referralName: 'prassann Daphal',
      },
      validate: {
        hasReferral: false,
        referralEmail: '',
        referralPhone: '',
      },
    },
  },
  {
    id: 'extract-snooze-kunal-june',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Kunal snoozes to June — not opt-out',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.kunalSnoozeJune.sourcePublicIdentifier,
    tags: ['extract', 'snooze', 'real'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.kunalSnoozeJune.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: { ...emptyExtract },
      validate: { shouldNotRespond: false },
    },
  },
  {
    id: 'extract-opt-out',
    nodeKind: 'extract_inbound_signals',
    priority: 'must',
    description: 'Synthetic hard opt-out',
    tags: ['extract', 'opt-out', 'synthetic'],
    inputs: {
      transcript: OUTREACH_AI_TRANSCRIPTS.syntheticOptOut.transcript,
      slots,
      lastChannel: 'LINKEDIN',
    },
    expected: {
      extract: { ...emptyExtract, shouldNotRespond: true },
      validate: { shouldNotRespond: true },
    },
  },

  // --- must: draft reply ---
  {
    id: 'draft-reply-intent-kunal-clarify',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'INTENT: clarify SaaS vs consulting without inventing times',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.kunalIntentClarify.sourcePublicIdentifier,
    tags: ['draft', 'intent', 'real'],
    inputs: {
      name: 'Kunal',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.kunalIntentClarify.transcript,
      slots: slotsJson,
      conversationStage: 'INTENT',
      replyChannel: 'LINKEDIN',
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        notContains: [OUTREACH_DONT_RESPOND_SENTINEL, 'CTC', 'job description'],
        maxWords: 180,
      },
    },
  },
  {
    id: 'draft-reply-follow-up-meeting-pulkit',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'FOLLOW_UP_MEETING with no confirmed slot — offer injected slots only',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.pulkitVagueTime.sourcePublicIdentifier,
    tags: ['draft', 'follow-up-meeting', 'real'],
    inputs: {
      name: 'Pulkit',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.pulkitVagueTime.transcript,
      slots: slotsJson,
      conversationStage: 'FOLLOW_UP_MEETING',
      replyChannel: 'LINKEDIN',
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        notContains: [OUTREACH_DONT_RESPOND_SENTINEL],
        maxWords: 160,
      },
    },
  },
  {
    id: 'draft-reply-meeting-booked-sunil',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'MEETING_BOOKED with confirmed startsAt',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.sunilBookSlot.sourcePublicIdentifier,
    tags: ['draft', 'meeting-booked', 'real'],
    inputs: {
      name: 'Sunil',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.sunilBookSlot.transcript,
      slots: slotsJson,
      conversationStage: 'MEETING_BOOKED',
      replyChannel: 'LINKEDIN',
      confirmedStartsAt: slots[2].startsAt,
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        notContains: [OUTREACH_DONT_RESPOND_SENTINEL],
        maxWords: 80,
      },
    },
  },
  {
    id: 'draft-reply-details-email-gaurav',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'Prospect email injected → non-empty emailSubject/emailBody',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.gauravEmail.sourcePublicIdentifier,
    tags: ['draft', 'email', 'real'],
    inputs: {
      name: 'Gaurav',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.gauravEmail.transcript,
      slots: slotsJson,
      conversationStage: 'INTENT',
      replyChannel: 'EMAIL',
      prospectEmail: 'gaurav.zatakia@flomattress.com',
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        nonEmptyKeys: ['emailSubject', 'emailBody'],
        notContains: [OUTREACH_DONT_RESPOND_SENTINEL],
      },
    },
  },
  {
    id: 'draft-reply-referral-ask-contact-rajesh',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'Referral name only → ask for contact; no referralMessage yet',
    sourcePublicIdentifier:
      OUTREACH_AI_TRANSCRIPTS.rajeshReferralNoContact.sourcePublicIdentifier,
    tags: ['draft', 'referral', 'real'],
    inputs: {
      name: 'Rajesh',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.rajeshReferralNoContact.transcript,
      slots: slotsJson,
      conversationStage: 'INTENT',
      replyChannel: 'LINKEDIN',
      referralName: 'prassann Daphal',
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        contains: ['prassann'],
        notContains: [OUTREACH_DONT_RESPOND_SENTINEL],
      },
    },
  },
  {
    id: 'draft-reply-snoozed-kunal-june',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'SNOOZED — thank/pause, no pitch',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.kunalSnoozeJune.sourcePublicIdentifier,
    tags: ['draft', 'snooze', 'real'],
    inputs: {
      name: 'Kunal',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.kunalSnoozeJune.transcript,
      slots: slotsJson,
      conversationStage: 'SNOOZED',
      replyChannel: 'LINKEDIN',
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        notContains: [OUTREACH_DONT_RESPOND_SENTINEL, 'CTC'],
        maxWords: 80,
      },
    },
  },
  {
    id: 'draft-reply-opt-out',
    nodeKind: 'draft_sales_reply',
    priority: 'must',
    description: 'NOT_INTERESTED / asked to stop → #DONTRESPOND#',
    tags: ['draft', 'opt-out', 'synthetic'],
    inputs: {
      name: 'Prospect',
      title: 'Leader',
      transcript: OUTREACH_AI_TRANSCRIPTS.syntheticOptOut.transcript,
      slots: slotsJson,
      conversationStage: 'NOT_INTERESTED',
      replyChannel: 'LINKEDIN',
      shouldNotRespond: 'true',
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      draft: {
        contains: [OUTREACH_DONT_RESPOND_SENTINEL],
      },
    },
  },

  // --- must: first message + qualify ---
  {
    id: 'first-message-cold',
    nodeKind: 'first_message_opener',
    priority: 'must',
    description: 'Cold opener with enrichment hooks, no chat history',
    tags: ['first-message', 'synthetic'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      kind: 'opener',
      calendarSlots: slotsJson,
    },
    expected: {
      message: {
        notContains: ['CTC', 'job description', 'JD'],
        maxWords: 140,
      },
    },
  },
  {
    id: 'first-message-with-slots',
    nodeKind: 'first_message_opener',
    priority: 'must',
    description: 'Opener with calendar windows injected',
    tags: ['first-message', 'synthetic'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      kind: 'opener',
      calendarSlots: slotsJson,
    },
    expected: {
      message: {
        notContains: ['CTC'],
        maxWords: 140,
      },
    },
  },
  {
    id: 'qualify-go-true',
    nodeKind: 'qualify',
    priority: 'must',
    description: 'ICP-fit manufacturing CFO profile',
    tags: ['qualify', 'synthetic'],
    inputs: {
      senderJson,
      profile:
        'About: CFO of a mid-market manufacturing group in India. Skills: FP&A, ERP, MIS.',
      crm: 'Name: Anil Kumar\nTitle: CFO',
    },
    expected: { qualify: { go: true } },
  },
  {
    id: 'qualify-go-false',
    nodeKind: 'qualify',
    priority: 'must',
    description: 'Excluded independent director / retired',
    tags: ['qualify', 'synthetic'],
    inputs: {
      senderJson,
      profile:
        'About: Independent director and retired consultant. No operating finance role.',
      crm: 'Name: Board Advisor\nTitle: Independent Director',
    },
    expected: { qualify: { go: false } },
  },

  // --- pass ---
  {
    id: 'connection-note-cold',
    nodeKind: 'connection_note',
    priority: 'pass',
    description: 'Cold LinkedIn connection note ≤280 chars',
    tags: ['connection-note'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
    },
    expected: {
      message: {
        notContains: ['http', 'IMAGE-I', 'demo'],
        maxWords: 60,
      },
    },
  },
  {
    id: 'connection-note-referral',
    nodeKind: 'connection_note',
    priority: 'pass',
    description: 'Referral connection note (Sandesh → Yogesh)',
    tags: ['connection-note', 'referral'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: OUTREACH_AI_REFERRAL_PROSPECT_ENRICHMENT_JSON,
    },
    expected: {
      message: {
        contains: ['Sandesh'],
        notContains: ['http'],
        maxWords: 60,
      },
    },
  },
  {
    id: 'post-reply-fu1-silent',
    nodeKind: 'post_reply_follow_up_1',
    priority: 'pass',
    description: 'Post-reply FU1 after Pulkit silence',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.pulkitSilentAfterReply.sourcePublicIdentifier,
    tags: ['post-reply-fu', 'real'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.pulkitSilentAfterReply.transcript,
      calendarSlots: slotsJson,
      kind: 'fu1',
    },
    expected: {
      message: {
        notContains: ['circling back', 'just following up', 'CTC'],
        maxWords: 90,
      },
    },
  },
  {
    id: 'post-reply-fu2-final',
    nodeKind: 'post_reply_follow_up_2',
    priority: 'pass',
    description: 'Post-reply FU2 final nudge',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.pulkitSilentAfterReply.sourcePublicIdentifier,
    tags: ['post-reply-fu'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.pulkitSilentAfterReply.transcript,
      calendarSlots: slotsJson,
      kind: 'fu2',
    },
    expected: {
      message: {
        contains: ['happy to stay in touch'],
        maxWords: 50,
      },
    },
  },
  {
    id: 'accepted-fu1',
    nodeKind: 'linkedin_follow_up_1',
    priority: 'pass',
    description: 'Accepted-branch FU1 after silence',
    tags: ['accepted-fu'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.negativeSilence.transcript,
      kind: 'fu1',
    },
    expected: {
      message: { notContains: ['CTC'], maxWords: 80 },
    },
  },
  {
    id: 'accepted-fu2',
    nodeKind: 'linkedin_follow_up_2',
    priority: 'pass',
    description: 'Accepted-branch FU2 qualifying question',
    tags: ['accepted-fu'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.negativeSilence.transcript,
      kind: 'fu2',
    },
    expected: {
      message: {
        contains: ['happy to stay in touch'],
        maxWords: 50,
      },
    },
  },
  {
    id: 'accepted-fu3',
    nodeKind: 'linkedin_follow_up_3',
    priority: 'pass',
    description: 'Accepted-branch FU3 final',
    tags: ['accepted-fu'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.negativeSilence.transcript,
      kind: 'fu3',
    },
    expected: {
      message: { maxWords: 50, notContains: ['CTC'] },
    },
  },

  // --- low ---
  {
    id: 'fallback-email-ignored',
    nodeKind: 'fallback_email',
    priority: 'low',
    description: 'Fallback email after connection ignored',
    tags: ['fallback-email'],
    inputs: {
      senderJson,
      prospectEnrichmentJson: enrichmentJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.negativeSilence.transcript,
    },
    expected: {
      email: {
        notContains: ['CTC', 'job description'],
        maxWords: 220,
      },
    },
  },
  {
    id: 'meeting-reminder',
    nodeKind: 'meeting_reminder',
    priority: 'low',
    description: 'Day-before meeting reminder',
    sourcePublicIdentifier: OUTREACH_AI_TRANSCRIPTS.sunilPostMeetingChase.sourcePublicIdentifier,
    tags: ['meeting'],
    inputs: {
      senderJson,
      name: 'Sunil',
      chatHistory: OUTREACH_AI_TRANSCRIPTS.sunilPostMeetingChase.transcript,
    },
    expected: {
      message: { maxWords: 40, notContains: ['CTC'] },
    },
  },
  {
    id: 'no-show-ping',
    nodeKind: 'no_show_ping',
    priority: 'low',
    description: 'Polite no-show ping',
    tags: ['meeting'],
    inputs: {
      senderJson,
      name: 'Sunil',
      chatHistory: OUTREACH_AI_TRANSCRIPTS.sunilPostMeetingChase.transcript,
    },
    expected: {
      message: { maxWords: 50, notContains: ['CTC'] },
    },
  },
  {
    id: 'reschedule-offer',
    nodeKind: 'reschedule_offer',
    priority: 'low',
    description: 'Offer to pick a new time',
    tags: ['meeting'],
    inputs: {
      senderJson,
      name: 'Sunil',
      calendarSlots: slotsJson,
      chatHistory: OUTREACH_AI_TRANSCRIPTS.sunilPostMeetingChase.transcript,
    },
    expected: {
      message: { maxWords: 50, notContains: ['CTC'] },
    },
  },
];

export const outreachAiScenariosByPriority = (priority: OutreachAiScenario['priority']) =>
  OUTREACH_AI_SCENARIO_CATALOG.filter((scenario) => scenario.priority === priority);

export const outreachAiScenarioById = (id: string) =>
  OUTREACH_AI_SCENARIO_CATALOG.find((scenario) => scenario.id === id);

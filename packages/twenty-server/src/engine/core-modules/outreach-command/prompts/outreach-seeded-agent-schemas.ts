// Canonical JSON schemas for seeded outreach AI agents (prefill + live eval).

export const OUTREACH_SEEDED_LINKEDIN_MESSAGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' as const, description: 'LinkedIn message body' },
  },
  required: ['message'],
  additionalProperties: false as const,
};

export const OUTREACH_SEEDED_FALLBACK_EMAIL_SCHEMA = {
  type: 'object' as const,
  properties: {
    subject: { type: 'string' as const, description: 'Email subject' },
    message: { type: 'string' as const, description: 'Email body' },
  },
  required: ['subject', 'message'],
  additionalProperties: false as const,
};

export const OUTREACH_SEEDED_REPLY_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: {
      type: 'string' as const,
      description:
        'Reply body. Use #DONTRESPOND# exactly when nothing should be sent.',
    },
    emailSubject: {
      type: 'string' as const,
      description: 'Subject when emailing details or a referral, else empty',
    },
    emailBody: {
      type: 'string' as const,
      description: 'Body for the details email to the prospect, else empty',
    },
    referralMessage: {
      type: 'string' as const,
      description:
        'Intro message to the referred person (email or WhatsApp), else empty',
    },
    referralCandidateId: {
      type: 'string' as const,
      description:
        'Id returned by create_one_candidate for a referral, else empty',
    },
  },
  required: [
    'message',
    'emailSubject',
    'emailBody',
    'referralMessage',
    'referralCandidateId',
  ],
  additionalProperties: false as const,
};

// Signals are represented so they can be checked: a slot index is either in
// range or not, and a contact either appears in the transcript or does not.
export const OUTREACH_SEEDED_EXTRACT_SIGNALS_SCHEMA = {
  type: 'object' as const,
  properties: {
    acceptedSlotIndex: {
      type: 'integer' as const,
      description:
        '0-based index into the injected slots of the one slot they accepted, -1 when none',
    },
    requestedChannelSwitch: {
      type: 'string' as const,
      enum: ['NONE', 'LINKEDIN', 'WHATSAPP', 'EMAIL'],
      description:
        'NONE unless they explicitly asked to move channel ("email me", "WhatsApp me")',
    },
    prospectEmail: {
      type: 'string' as const,
      description: 'Address they asked us to email details to, else empty',
    },
    referralName: {
      type: 'string' as const,
      description: 'Name of someone else they pointed us to, else empty',
    },
    referralEmail: {
      type: 'string' as const,
      description: 'Email of that person as written in the thread, else empty',
    },
    referralPhone: {
      type: 'string' as const,
      description:
        'WhatsApp/phone of that person as written in the thread, else empty',
    },
    shouldNotRespond: {
      type: 'boolean' as const,
      description: 'True only for opt-out: stop, unsubscribe, never contact me',
    },
  },
  required: [
    'acceptedSlotIndex',
    'requestedChannelSwitch',
    'prospectEmail',
    'referralName',
    'referralEmail',
    'referralPhone',
    'shouldNotRespond',
  ],
  additionalProperties: false as const,
};

export const OUTREACH_SEEDED_QUALIFY_PROSPECT_SCHEMA = {
  type: 'object' as const,
  properties: {
    go: {
      type: 'boolean' as const,
      description: 'Whether to contact this prospect for the sender offer',
    },
    score: {
      type: 'number' as const,
      description: 'ICP fit score 0–5',
    },
    segment: {
      type: 'string' as const,
      description: 'Short segment label for the prospect',
    },
    reason: {
      type: 'string' as const,
      description: 'Why go/score was chosen',
    },
    first_name: {
      type: 'string' as const,
      description: 'Given name for addressing the prospect',
    },
    honorific: {
      type: 'string' as const,
      description: 'Honorific if known, else empty',
    },
    company_short: {
      type: 'string' as const,
      description: 'Short company name for copy',
    },
    industry_phrase: {
      type: 'string' as const,
      description: 'Industry phrase in business language',
    },
    hooks: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          text: { type: 'string' as const },
          source: { type: 'string' as const },
        },
      },
      description: 'At most 3 { text, source } personalization hooks',
    },
    likely_systems: {
      type: 'string' as const,
      description: 'Likely systems or stack cues, else empty',
    },
    matching_problem_statement: {
      type: 'string' as const,
      description: 'Problem statement matched to the sender offer',
    },
    referral_source: {
      type: 'string' as const,
      description: 'Referral source when known, else empty',
    },
  },
  required: [
    'go',
    'score',
    'segment',
    'reason',
    'first_name',
    'honorific',
    'company_short',
    'industry_phrase',
    'hooks',
    'likely_systems',
    'matching_problem_statement',
    'referral_source',
  ],
  additionalProperties: false as const,
};

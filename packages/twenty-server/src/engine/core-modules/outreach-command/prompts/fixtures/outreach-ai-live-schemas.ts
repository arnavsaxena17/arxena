// JSON schemas mirrored from prefill-outreach-workflows.util.ts for live eval.
// Keep descriptions aligned with seeded agents.

export const OUTREACH_AI_EXTRACT_SIGNALS_SCHEMA = {
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

export const OUTREACH_AI_REPLY_SCHEMA = {
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
  },
  required: ['message', 'emailSubject', 'emailBody', 'referralMessage'],
  additionalProperties: false as const,
};

export const OUTREACH_AI_LINKEDIN_MESSAGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' as const, description: 'LinkedIn message body' },
  },
  required: ['message'],
  additionalProperties: false as const,
};

export const OUTREACH_AI_FALLBACK_EMAIL_SCHEMA = {
  type: 'object' as const,
  properties: {
    subject: { type: 'string' as const, description: 'Email subject' },
    message: { type: 'string' as const, description: 'Email body' },
  },
  required: ['subject', 'message'],
  additionalProperties: false as const,
};

export const OUTREACH_AI_QUALIFY_SCHEMA = {
  type: 'object' as const,
  properties: {
    go: { type: 'boolean' as const },
    score: { type: 'number' as const },
    segment: { type: 'string' as const },
    reason: { type: 'string' as const },
    first_name: { type: 'string' as const },
    honorific: { type: ['string', 'null'] as const },
    company_short: { type: 'string' as const },
    industry_phrase: { type: 'string' as const },
    hooks: { type: 'array' as const, items: { type: 'object' as const } },
    likely_systems: { type: 'string' as const },
    matching_problem_statement: { type: 'string' as const },
    referral_source: { type: ['string', 'null'] as const },
  },
  required: [
    'go',
    'score',
    'segment',
    'reason',
    'first_name',
    'company_short',
    'industry_phrase',
    'hooks',
    'likely_systems',
    'matching_problem_statement',
  ],
  additionalProperties: false as const,
};

import { type OutreachProspectEnrichment } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';
import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';

export const OUTREACH_AI_EVAL_SLOTS = [
  {
    startsAt: '2024-11-10T09:00:00.000Z',
    endsAt: '2024-11-10T09:30:00.000Z',
  },
  {
    startsAt: '2024-11-11T09:00:00.000Z',
    endsAt: '2024-11-11T09:30:00.000Z',
  },
  {
    startsAt: '2024-11-08T09:00:00.000Z',
    endsAt: '2024-11-08T09:30:00.000Z',
  },
] as const;

export const OUTREACH_AI_EVAL_SLOTS_JSON = JSON.stringify(
  OUTREACH_AI_EVAL_SLOTS,
);

export const OUTREACH_AI_NARESH_SENDER_PROFILE = {
  targetTitles: ['CFO', 'CEO', 'Finance Controller', 'Managing Director'],
  locations: ['India'],
  brief: [
    'Sender: Naresh Lahoti · Founder · Projective Tech. Signs as Naresh. Sign-off: Regards, Naresh.',
    'Ex-CFO who built realtime management reporting for manufacturers. IMAGE-I is realtime multidimensional management reporting always reconciled to financials.',
    'Voice: operator peer, concise; warm-professional; uses honorifics. Meeting: 30 min on Teams, weekdays 14:00–17:00 IST.',
    'FAQ: Is this consulting or software? SaaS with optional execution support. How long to go live? Typically a few weeks with a light pilot first.',
  ].join('\n'),
} as const satisfies OutreachSenderProfile;

export const OUTREACH_AI_NARESH_SENDER_JSON = JSON.stringify(
  OUTREACH_AI_NARESH_SENDER_PROFILE,
);

export const OUTREACH_AI_DEFAULT_PROSPECT_ENRICHMENT = {
  go: true,
  score: 4,
  segment: 'manufacturing-cfo',
  reason: 'Finance leader at manufacturing SME in ICP geography',
  first_name: 'Prospect',
  honorific: null,
  company_short: 'Acme Manufacturing',
  industry_phrase: 'manufacturing',
  hooks: [
    { text: 'Running finance for a multi-plant manufacturer', source: 'crm' },
    {
      text: 'Likely still consolidating plant P&L in spreadsheets',
      source: 'infer',
    },
  ],
  likely_systems: 'ERP + Excel MIS',
  matching_problem_statement:
    'Spreadsheet MIS takes too long and is not scalable',
  referral_source: null,
} as const satisfies OutreachProspectEnrichment;

export const OUTREACH_AI_DEFAULT_PROSPECT_ENRICHMENT_JSON = JSON.stringify(
  OUTREACH_AI_DEFAULT_PROSPECT_ENRICHMENT,
);

export const OUTREACH_AI_REFERRAL_PROSPECT_ENRICHMENT_JSON = JSON.stringify({
  ...OUTREACH_AI_DEFAULT_PROSPECT_ENRICHMENT,
  referral_source: 'Sandesh Bhagwat',
  first_name: 'Yogesh',
  company_short: 'KSH International',
});

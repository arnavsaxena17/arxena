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

export const OUTREACH_AI_EVAL_SLOTS_JSON = JSON.stringify(OUTREACH_AI_EVAL_SLOTS);

export const OUTREACH_AI_NARESH_SENDER_PROFILE = {
  id: 'naresh-projective-eval',
  identity: {
    full_name: 'Naresh Lahoti',
    first_name: 'Naresh',
    how_they_sign: 'Naresh',
    title: 'Founder',
    company: 'Projective Tech',
    company_short: 'Projective',
    website: 'www.projectivetech.com',
    phone: '+91 98921 97720',
    email: 'naresh@projectivetech.com',
    linkedin_url: 'https://www.linkedin.com/in/naresh-lahoti-0b774821',
    city: 'Mumbai',
    timezone: 'Asia/Kolkata',
  },
  credibility: {
    one_liner: 'Ex-CFO who built realtime management reporting for manufacturers',
    operator_line:
      '20+ years in finance leadership across manufacturing SMEs and enterprises',
    credentials: ['CFO Tata Motors', 'Deloitte', 'Chartered Accountant'],
    years_experience: 20,
    industries_known: ['manufacturing', 'automotive', 'pharma'],
    shared_background_tags: ['CFO', 'manufacturing', 'India'],
  },
  offer: {
    product_name: 'IMAGE-I',
    category: 'management reporting',
    one_sentence:
      'Realtime multidimensional management reporting always reconciled to financials',
    problem_statements: [
      'Spreadsheet MIS takes too long and is not scalable',
      'ERP and BI still leave decision data late or incomplete',
    ],
    outcomes: [
      'Realtime profit at granular level',
      'MIS that matches financial statements',
    ],
    proof_points: ['Clients extract value within a few weeks'],
    works_with: ['ERP', 'Excel', 'finance teams'],
    implementation_time: 'weeks, not months',
    pilot_offer: 'Free 30-day pilot with light lift from your team',
    pricing_line: 'Fraction of traditional BI programmes',
    data_security_line: 'Ask sender before answering',
    faq: [
      {
        q: 'Is this consulting or software?',
        a: 'SaaS software platform with optional execution support.',
      },
      {
        q: 'How long to go live?',
        a: 'Typically a few weeks with a light pilot first.',
      },
    ],
    collateral: [
      {
        name: 'Approach note',
        file_id: 'approach-note',
        when_to_send: 'When they ask what this is about or want details by email',
      },
    ],
  },
  icp: {
    target_roles: ['CFO', 'CEO', 'Finance Controller', 'Managing Director'],
    target_company_profile: 'Manufacturing SMEs and mid-market in India',
    revenue_band: null,
    geography: ['India'],
    exclude_roles: [
      'independent director',
      'retired',
      'consultant',
      'recruiter',
    ],
    exclude_company_types: ['pure staffing', 'recruiting agency'],
    known_objections: [
      {
        objection: 'We already have ERP / BI',
        response:
          'IMAGE-I sits on top and turns operational data into decision-ready MIS.',
      },
    ],
  },
  voice: {
    register: 'operator peer, concise',
    formality: 'warm-professional',
    uses_honorifics: true,
    signature_phrases: ['Hope you are doing well', 'Would be glad to connect'],
    avoid_phrases: ['circling back', 'just following up', 'synergy'],
    sign_off: 'Regards, Naresh',
  },
  meeting: {
    default_duration_min: 30,
    platform: 'teams',
    agenda_template:
      '- Current MIS pain\n- IMAGE-I walkthrough\n- Pilot fit',
    preferred_windows: ['14:00-17:00 IST weekdays'],
    allow_weekends_if_proposed: true,
  },
  review_flags: [],
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
    { text: 'Likely still consolidating plant P&L in spreadsheets', source: 'infer' },
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

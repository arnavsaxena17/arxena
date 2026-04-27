/* @license Enterprise */

export type CreditPackKey = string;

export type CreditPack = {
  key: CreditPackKey;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
  /** Display string for pricing UI (e.g. "1 credit (<100 employees)") */
  creditsDisplay: string;
  /** Short use-case label for pricing UI */
  useCase: string;
  /** Bullet points for pricing card */
  features: string[];
};

export type PricingIntent =
  | 'RECRUITING'
  | 'SALES'
  | 'INVESTING';

  const ORG_CHART_CREDIT_RULES =
  '1 credit = 1 org chart (<100 employees). Larger org charts consume more (e.g. 300 employees = 3 credits). Reveal credits (email + phone) are sold separately.';
 

  const BASE_PACK_FEATURES = [
    'Full org chart structure with reporting lines',
    'LinkedIn profiles, names + titles',
  ] as const;

const REVEAL_COPY = [
  'Reveal emails + mobiles (separate reveal credits)',
  'Export-ready shortlist',
] as const;
export const CREDIT_PACKS_BY_INTENT: Record<PricingIntent, CreditPack[]> = {
 
  // ─── RECRUITING ────────────────────────────────────────────────────────────
  RECRUITING: [
    {
      key: 'recruiting_starter_3000',
      name: 'Recruiting Starter',
      credits: 3000,
      amountSubunits: 19900,
      currency: 'GBP',
      creditsDisplay: '3,000 search credits — ~2 full org chart mandates/month',
      useCase: 'Independent search consultant',
      features: [
        ...BASE_PACK_FEATURES,
        ...REVEAL_COPY,
        'Best for: 1–3 active retained mandates',
      ],
    },
    {
      key: 'recruiting_pro_7000',
      name: 'Recruiting Pro',
      credits: 7000,
      amountSubunits: 39900,
      currency: 'GBP',
      creditsDisplay: '7,000 search credits — ~4–5 concurrent mandates/month',
      useCase: 'Active search consultant with 4–6 mandates',
      features: [
        ...BASE_PACK_FEATURES,
        ...REVEAL_COPY,
        'Best for: retained exec search, PE-backed mandates, CFO/CTO searches',
        'Map 6–8 competitor orgs per mandate without running dry',
      ],
    },
    {
      key: 'recruiting_team_15000',
      name: 'Recruiting Team',
      credits: 15000,
      amountSubunits: 79900,
      currency: 'GBP',
      creditsDisplay: '15,000 search credits — shared across your team',
      useCase: 'Boutique exec search firm (3–6 consultants)',
      features: [
        ...BASE_PACK_FEATURES,
        ...REVEAL_COPY,
        'Shared credit pool — allocate across consultants by mandate',
        'Best for: boutique retained search firms, functional specialists, PE talent advisors',
      ],
    },
  ],
 
  // ─── SALES ─────────────────────────────────────────────────────────────────
  SALES: [
    {
      key: 'sales_starter_15000',
      name: 'Sales Starter',
      credits: 15000,
      amountSubunits: 39900,
      currency: 'GBP',
      creditsDisplay: '15,000 search credits — ~75 full account org charts/month',
      useCase: 'Solo AE or small SDR pod',
      features: [
        'Full org chart structure with buying committee visibility',
        'LinkedIn profiles, names + titles',
        ...REVEAL_COPY,
        'Export to CRM or sequencing tool',
        'Best for: new account penetration, ICP prospecting, finding the real economic buyer',
        '~75 target accounts mapped end-to-end per month',
      ],
    },
    {
      key: 'sales_team_50000',
      name: 'Sales Team',
      credits: 50000,
      amountSubunits: 99900,
      currency: 'GBP',
      creditsDisplay: '50,000 search credits — ~5,000 credits per rep/month',
      useCase: '5–10 rep teams running account-based plays',
      features: [
        'Full org chart structure with buying committee visibility',
        'LinkedIn profiles, names + titles',
        ...REVEAL_COPY,
        'Export to CRM or sequencing tool',
        'Best for: ABM campaigns, multi-threaded enterprise deals, QBR prep',
        'Map every stakeholder in a target account before your first call',
      ],
    },
    {
      key: 'sales_scale_150000',
      name: 'Sales Scale',
      credits: 150000,
      amountSubunits: 249900,
      currency: 'GBP',
      creditsDisplay: '150,000 search credits — high-volume account intelligence',
      useCase: 'Full GTM teams and revenue operations',
      features: [
        'Full org chart structure with buying committee visibility',
        'LinkedIn profiles, names + titles',
        ...REVEAL_COPY,
        'CRM-ready export (Salesforce, HubSpot)',
        'Best for: enterprise sales orgs, SDR-AE pods at scale, RevOps enrichment pipelines',
        'API access available — pipe org chart data directly into your stack',
        'Dedicated onboarding and usage review',
      ],
    },
  ],
 
  // ─── INVESTING ─────────────────────────────────────────────────────────────
  INVESTING: [
    {
      key: 'fund_starter_10000',
      name: 'Fund Starter',
      credits: 10000,
      amountSubunits: 59900,
      currency: 'GBP',
      creditsDisplay: '10,000 search credits — ~50 company org charts/month',
      useCase: 'Small VC or angel fund (2–3 users)',
      features: [
        'Full org chart structure with seniority and reporting lines',
        'LinkedIn profiles, names + titles',
        'Reveal emails + mobiles (separate reveal credits)',
        'Deal pipeline org mapping — know the team before the pitch',
        'Portfolio company monitoring — track leadership changes monthly',
        'Best for: pre-seed/seed funds, solo GPs, deal-by-deal diligence',
      ],
    },
    {
      key: 'fund_pro_25000',
      name: 'Fund Pro',
      credits: 25000,
      amountSubunits: 119900,
      currency: 'GBP',
      creditsDisplay: '25,000 search credits — deep diligence across your deal pipeline',
      useCase: 'Growth PE or mid-size VC (4–6 users)',
      features: [
        'Full org chart structure with seniority and reporting lines',
        'LinkedIn profiles, names + titles',
        'Reveal emails + mobiles (separate reveal credits)',
        'Management benchmarking — compare leadership teams across sector comps',
        'Shared deal room access — align your deal team on org intelligence',
        'Best for: Series B–D diligence, management assessment, pre-LOI people risk',
      ],
    },
    {
      key: 'fund_enterprise_60000',
      name: 'Fund Enterprise',
      credits: 60000,
      amountSubunits: 250000,
      currency: 'GBP',
      creditsDisplay: '60,000+ search credits — institutional-grade org intelligence',
      useCase: 'Large PE, buyout funds and multi-strategy investors',
      features: [
        'Full org chart structure with seniority and reporting lines',
        'LinkedIn profiles, names + titles',
        'Reveal emails + mobiles (separate reveal credits)',
        'Continuous portfolio monitoring — flag C-suite changes within 48 hours',
        'Operating partner and board-level org mapping',
        'Best for: buyout funds, large-cap PE, portfolio talent transformation',
        'Dedicated account management and custom onboarding',
        'Volume reveal pricing negotiated per fund',
      ],
    },
  ],
};


export const ALL_CREDIT_PACKS: CreditPack[] = Object.values(
  CREDIT_PACKS_BY_INTENT,
).flat();

// Backwards-compatible export (server re-exports this as RAZORPAY_CREDIT_PACKS)
export const CREDIT_PACKS: CreditPack[] = ALL_CREDIT_PACKS;

export const DEFAULT_CREDIT_PACKS: CreditPack[] =
  CREDIT_PACKS_BY_INTENT.SALES;

export const getCreditPacksForIntent = (
  intent: PricingIntent | null | undefined,
): CreditPack[] => {
  if (!intent) return DEFAULT_CREDIT_PACKS;
  return CREDIT_PACKS_BY_INTENT[intent] ?? DEFAULT_CREDIT_PACKS;
};

export const creditPackPricingFootnote = [
  ORG_CHART_CREDIT_RULES,
  'Credit card payments: +3% surcharge. Pay by invoice: no surcharge.',
].join(' ');

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
  /** Included email reveal credits bundled with the pack */
  includedEmailCredits: number;
  /** Included phone reveal credits bundled with the pack */
  includedPhoneCredits: number;
};

export type PricingIntent =
  | 'RECRUITING'
  | 'SALES'
  | 'INVESTING';

export type SupportedPricingCurrency = 'INR' | 'USD' | 'GBP' | 'EUR';

const PRICING_CURRENCY_RATES_FROM_GBP: Record<SupportedPricingCurrency, number> = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  INR: 106,
};

const PRICING_CURRENCY_SYMBOLS: Record<SupportedPricingCurrency, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  INR: '₹',
};

const EUR_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'CY',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'SK',
  'SI',
  'ES',
]);

  const ORG_CHART_CREDIT_RULES =
  '1 credit = 1 org chart (<100 employees).\nLarger org charts consume more (e.g. 300 employees = 3 credits).\nReveal credits (email + phone) are sold separately.';
 

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
      includedEmailCredits: 300,
      includedPhoneCredits: 150,
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
      includedEmailCredits: 700,
      includedPhoneCredits: 350,
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
      includedEmailCredits: 1500,
      includedPhoneCredits: 750,
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
      includedEmailCredits: 1500,
      includedPhoneCredits: 750,
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
      includedEmailCredits: 5000,
      includedPhoneCredits: 2500,
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
      includedEmailCredits: 15000,
      includedPhoneCredits: 7500,
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
      includedEmailCredits: 1000,
      includedPhoneCredits: 500,
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
      includedEmailCredits: 2500,
      includedPhoneCredits: 1250,
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
      amountSubunits: 249900,
      currency: 'GBP',
      creditsDisplay: '60,000+ search credits — institutional-grade org intelligence',
      useCase: 'Large PE, buyout funds and multi-strategy investors',
      includedEmailCredits: 6000,
      includedPhoneCredits: 3000,
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

export const SUPPORTED_PRICING_CURRENCIES: SupportedPricingCurrency[] = [
  'INR',
  'USD',
  'GBP',
  'EUR',
];

export const getPricingCurrencySymbol = (
  currency: SupportedPricingCurrency,
): string => PRICING_CURRENCY_SYMBOLS[currency];

export const convertPricingAmountSubunits = (
  amountSubunits: number,
  fromCurrency: SupportedPricingCurrency,
  toCurrency: SupportedPricingCurrency,
): number => {
  if (fromCurrency === toCurrency) {
    return amountSubunits;
  }
  const inGbp = amountSubunits / PRICING_CURRENCY_RATES_FROM_GBP[fromCurrency];
  const convertedSubunits = Math.round(
    inGbp * PRICING_CURRENCY_RATES_FROM_GBP[toCurrency],
  );

  return normalizePricingAmountSubunits(convertedSubunits);
};

const normalizePricingAmountSubunits = (amountSubunits: number): number => {
  const amountMajor = Math.max(1, Math.round(amountSubunits / 100));

  if (amountMajor >= 1000) {
    const rounded = Math.round(amountMajor / 1000) * 1000 - 1;

    return Math.max(999, rounded) * 100;
  }

  if (amountMajor >= 100) {
    const rounded = Math.round(amountMajor / 100) * 100 - 1;

    return Math.max(99, rounded) * 100;
  }

  return amountMajor * 100;
};

export const convertCreditPackToCurrency = (
  pack: CreditPack,
  targetCurrency: SupportedPricingCurrency,
): CreditPack => {
  const sourceCurrency = (
    SUPPORTED_PRICING_CURRENCIES.includes(
      pack.currency as SupportedPricingCurrency,
    )
      ? (pack.currency as SupportedPricingCurrency)
      : 'GBP'
  );

  return {
    ...pack,
    amountSubunits: convertPricingAmountSubunits(
      pack.amountSubunits,
      sourceCurrency,
      targetCurrency,
    ),
    currency: targetCurrency,
  };
};

export const convertCreditPacksToCurrency = (
  packs: CreditPack[],
  targetCurrency: SupportedPricingCurrency,
): CreditPack[] =>
  packs.map((pack) => convertCreditPackToCurrency(pack, targetCurrency));

export const resolvePricingCurrencyFromCountryCode = (
  countryCode: string | null | undefined,
): SupportedPricingCurrency => {
  if (!countryCode) {
    return 'USD';
  }
  const normalized = countryCode.trim().toUpperCase();
  if (!normalized) {
    return 'USD';
  }
  if (normalized === 'IN') {
    return 'INR';
  }
  if (normalized === 'GB') {
    return 'GBP';
  }
  if (EUR_COUNTRY_CODES.has(normalized)) {
    return 'EUR';
  }
  return 'USD';
};

export const creditPackPricingFootnote = [
  ORG_CHART_CREDIT_RULES,
  'Credit card payments: +3% surcharge. Pay by invoice: no surcharge.',
].join(' ');

/* @license Enterprise */

export type CreditPackKey = string;

export type PricingIntent =
  | 'SALES'
  | 'RECRUITING'
  | 'CORPORATE'
  | 'INVESTING';

export type SupportedPricingCurrency =
  | 'INR'
  | 'USD'
  | 'GBP'
  | 'EUR'
  | 'AUD'
  | 'AED';

export type PricingPlanId =
  | 'sales'
  | 'recruitment'
  | 'corporate'
  | 'investment';

export type MapType = 'functional' | 'full' | 'timeline';

export type PricingPlanTier = {
  maps: number;
  credits: number;
  pricesSubunits: Record<SupportedPricingCurrency, number>;
};

export type PricingPlan = {
  id: PricingPlanId;
  intent: PricingIntent;
  label: string;
  tagline: string;
  icon: string;
  mapType: MapType;
  mapTypeLabel: string;
  minMaps: number;
  inheritedFromPlanId: PricingPlanId | null;
  ownFeatures: string[];
  tiers: PricingPlanTier[];
};

export type PricingPlanContent = {
  tabLabel: string;
  onboardingTitle: string;
  onboardingBody: string;
  onboardingHint: string;
  heroHeadline: string;
  heroSubheadline: string;
};

export type CreditPack = {
  key: CreditPackKey;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
  /** Display string for pricing UI (e.g. "500 credits — 10 talent maps"). */
  creditsDisplay: string;
  /** Short use-case label for pricing UI. */
  useCase: string;
  /** Bullet points for pricing card (the plan's own features). */
  features: string[];
  /** Display-only equivalents — backend uses a single revealCredits pool. */
  includedEmailCredits: number;
  includedPhoneCredits: number;
  /** Plan + tier metadata for the new 4-plan / volume-tier UI. */
  planId: PricingPlanId;
  intent: PricingIntent;
  mapsCount: number;
  mapType: MapType;
  mapTypeLabel: string;
  tagline: string;
  inheritedFromPlanId: PricingPlanId | null;
  /** Explicit per-currency price subunits (preferred over GBP-rate conversion). */
  pricesSubunits: Record<SupportedPricingCurrency, number>;
};

const PRICING_CURRENCY_RATES_FROM_GBP: Record<
  SupportedPricingCurrency,
  number
> = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  INR: 106,
  AUD: 1.95,
  AED: 4.66,
};

const PRICING_CURRENCY_SYMBOLS: Record<SupportedPricingCurrency, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  INR: '₹',
  AUD: 'A$',
  AED: 'AED ',
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

const GCC_COUNTRY_CODES = new Set(['AE', 'SA', 'KW', 'BH', 'QA', 'OM']);

// ---------------------------------------------------------------------------
// PRICING_PLANS — JSON-shaped source of truth (4 plans × volume tiers).
// ---------------------------------------------------------------------------

export const PRICING_PLANS: Record<PricingPlanId, PricingPlan> = {
  sales: {
    id: 'sales',
    intent: 'SALES',
    label: 'Sales / ABM',
    tagline:
      'Functional talent maps for targeted account outreach',
    icon: '📡',
    mapType: 'functional',
    mapTypeLabel:
      'Functional · 3–4 levels · up to 100 people per function',
    minMaps: 10,
    inheritedFromPlanId: null,
    ownFeatures: [
      'Functional talent map (3–4 levels)',
      'Up to 100 people per function or leadership tier',
      'Decision-maker identification',
      'LinkedIn profiles linked',
      'Shareable tokenized link',
      'Email / WhatsApp export',
    ],
    tiers: [
      {
        maps: 10,
        credits: 500,
        pricesSubunits: {
          INR: 5000 * 100,
          USD: 150 * 100,
          GBP: 110 * 100,
          EUR: 125 * 100,
          AUD: 150 * 100,
          AED: 550 * 100,
        },
      },
      {
        maps: 25,
        credits: 1300,
        pricesSubunits: {
          INR: 4500 * 100,
          USD: 135 * 100,
          GBP: 98 * 100,
          EUR: 112 * 100,
          AUD: 130 * 100,
          AED: 500 * 100,
        },
      },
      {
        maps: 50,
        credits: 2700,
        pricesSubunits: {
          INR: 4000 * 100,
          USD: 120 * 100,
          GBP: 88 * 100,
          EUR: 100 * 100,
          AUD: 110 * 100,
          AED: 440 * 100,
        },
      },
      {
        maps: 100,
        credits: 5500,
        pricesSubunits: {
          INR: 3500 * 100,
          USD: 100 * 100,
          GBP: 75 * 100,
          EUR: 85 * 100,
          AUD: 100 * 100,
          AED: 370 * 100,
        },
      },
    ],
  },
  recruitment: {
    id: 'recruitment',
    intent: 'RECRUITING',
    label: 'Recruitment / Exec Search',
    tagline:
      'Full company mapped — every level, every function, 1,000+ people',
    icon: '🔍',
    mapType: 'full',
    mapTypeLabel: 'Full company · 5–6 levels · 1,000+ people mapped',
    minMaps: 5,
    inheritedFromPlanId: 'sales',
    ownFeatures: [
      'Full company talent map (5–6 levels)',
      '1,000+ people mapped across all functions',
      'Mandate-specific candidate identification',
      'Candidate contact enrichment',
      'WhatsApp outreach sequences',
      'CRM sync (Twenty)',
    ],
    tiers: [
      {
        maps: 5,
        credits: 500,
        pricesSubunits: {
          INR: 10000 * 100,
          USD: 200 * 100,
          GBP: 155 * 100,
          EUR: 170 * 100,
          AUD: 200 * 100,
          AED: 735 * 100,
        },
      },
      {
        maps: 10,
        credits: 1000,
        pricesSubunits: {
          INR: 9000 * 100,
          USD: 185 * 100,
          GBP: 140 * 100,
          EUR: 155 * 100,
          AUD: 200 * 100,
          AED: 680 * 100,
        },
      },
      {
        maps: 25,
        credits: 2600,
        pricesSubunits: {
          INR: 7500 * 100,
          USD: 165 * 100,
          GBP: 125 * 100,
          EUR: 140 * 100,
          AUD: 170 * 100,
          AED: 600 * 100,
        },
      },
      {
        maps: 50,
        credits: 5200,
        pricesSubunits: {
          INR: 6000 * 100,
          USD: 150 * 100,
          GBP: 110 * 100,
          EUR: 125 * 100,
          AUD: 150 * 100,
          AED: 550 * 100,
        },
      },
      {
        maps: 100,
        credits: 10500,
        pricesSubunits: {
          INR: 5000 * 100,
          USD: 130 * 100,
          GBP: 98 * 100,
          EUR: 110 * 100,
          AUD: 130 * 100,
          AED: 480 * 100,
        },
      },
    ],
  },
  corporate: {
    id: 'corporate',
    intent: 'CORPORATE',
    label: 'Corporate TA',
    tagline:
      'Competitor benchmarking and internal mobility intelligence',
    icon: '🏛',
    mapType: 'full',
    mapTypeLabel: 'Full company · bulk coverage · multi-company',
    minMaps: 10,
    inheritedFromPlanId: 'recruitment',
    ownFeatures: [
      'Competitor org tracking',
      'Bulk company coverage',
      'Team / BU level views',
      'Multi-seat access with credit controls',
      'Custom refresh cadence',
    ],
    tiers: [
      {
        maps: 10,
        credits: 1500,
        pricesSubunits: {
          INR: 8500 * 100,
          USD: 220 * 100,
          GBP: 170 * 100,
          EUR: 188 * 100,
          AUD: 250 * 100,
          AED: 800 * 100,
        },
      },
      {
        maps: 25,
        credits: 3800,
        pricesSubunits: {
          INR: 8000 * 100,
          USD: 210 * 100,
          GBP: 160 * 100,
          EUR: 178 * 100,
          AUD: 250 * 100,
          AED: 770 * 100,
        },
      },
      {
        maps: 50,
        credits: 7500,
        pricesSubunits: {
          INR: 7500 * 100,
          USD: 195 * 100,
          GBP: 150 * 100,
          EUR: 165 * 100,
          AUD: 220 * 100,
          AED: 715 * 100,
        },
      },
      {
        maps: 100,
        credits: 15000,
        pricesSubunits: {
          INR: 7000 * 100,
          USD: 180 * 100,
          GBP: 138 * 100,
          EUR: 152 * 100,
          AUD: 200 * 100,
          AED: 660 * 100,
        },
      },
      {
        maps: 200,
        credits: 28000,
        pricesSubunits: {
          INR: 6500 * 100,
          USD: 165 * 100,
          GBP: 125 * 100,
          EUR: 140 * 100,
          AUD: 180 * 100,
          AED: 600 * 100,
        },
      },
    ],
  },
  investment: {
    id: 'investment',
    intent: 'INVESTING',
    label: 'Investment Companies',
    tagline:
      'Portfolio org intelligence + leadership timeline for PE / VC',
    icon: '📈',
    mapType: 'timeline',
    mapTypeLabel:
      'Full company + Org Timeline · alumni data included',
    minMaps: 5,
    inheritedFromPlanId: 'corporate',
    ownFeatures: [
      'Portfolio company mapping',
      'Org Timeline — leadership changes over time',
      'Alumni data · up to 3× profile depth',
      'Post-acquisition team buildout tracking',
      'Dedicated account manager',
    ],
    tiers: [
      {
        maps: 5,
        credits: 750,
        pricesSubunits: {
          INR: 12000 * 100,
          USD: 200 * 100,
          GBP: 155 * 100,
          EUR: 170 * 100,
          AUD: 220 * 100,
          AED: 735 * 100,
        },
      },
      {
        maps: 10,
        credits: 1500,
        pricesSubunits: {
          INR: 11000 * 100,
          USD: 188 * 100,
          GBP: 145 * 100,
          EUR: 160 * 100,
          AUD: 200 * 100,
          AED: 690 * 100,
        },
      },
      {
        maps: 25,
        credits: 3800,
        pricesSubunits: {
          INR: 10000 * 100,
          USD: 175 * 100,
          GBP: 135 * 100,
          EUR: 148 * 100,
          AUD: 200 * 100,
          AED: 640 * 100,
        },
      },
      {
        maps: 50,
        credits: 7500,
        pricesSubunits: {
          INR: 9000 * 100,
          USD: 160 * 100,
          GBP: 120 * 100,
          EUR: 135 * 100,
          AUD: 170 * 100,
          AED: 585 * 100,
        },
      },
      {
        maps: 100,
        credits: 15000,
        pricesSubunits: {
          INR: 8000 * 100,
          USD: 145 * 100,
          GBP: 110 * 100,
          EUR: 122 * 100,
          AUD: 150 * 100,
          AED: 530 * 100,
        },
      },
    ],
  },
};

export const PRICING_PLAN_CONTENT_BY_ID: Record<
  PricingPlanId,
  PricingPlanContent
> = {
  sales: {
    tabLabel: 'Sales / ABM',
    onboardingTitle: 'Sales / ABM',
    onboardingBody:
      'Functional talent maps for targeted outreach, decision-maker IDs, credits to start.',
    onboardingHint: 'Self-serve · extension · ~2 hr delivery',
    heroHeadline: 'Pipeline-grade org intelligence for Sales / ABM',
    heroSubheadline:
      'Map buying committees, champions, and blockers across target accounts — then reveal/export only what matters.',
  },
  recruitment: {
    tabLabel: 'Recruitment / Exec Search',
    onboardingTitle: 'Recruitment / Exec Search',
    onboardingBody:
      'Full company maps, mandate-specific candidates, contact enrichment.',
    onboardingHint: 'Self-serve or 20-min live walkthrough',
    heroHeadline: 'Full-company talent maps for Recruitment & Exec Search',
    heroSubheadline:
      'Map every level and function across target companies, then run mandate-specific shortlists with verified contacts.',
  },
  corporate: {
    tabLabel: 'Corporate HR',
    onboardingTitle: 'Corporate talent intelligence',
    onboardingBody:
      'Competitor benchmarking, internal mobility, multi-company maps.',
    onboardingHint: 'Self-serve · multi-company maps',
    heroHeadline: 'Competitor benchmarking for Corporate TA',
    heroSubheadline:
      'Track competitor org changes, run BU-level benchmarks, and govern multi-seat access with credit controls.',
  },
  investment: {
    tabLabel: 'Investment Companies',
    onboardingTitle: 'Investment / deal diligence',
    onboardingBody:
      'Portfolio org intelligence and leadership timeline for deals.',
    onboardingHint: 'Book a call · live company map',
    heroHeadline: 'Org Timeline for Investment Companies',
    heroSubheadline:
      'Diligence faster, monitor portfolios, and benchmark leadership timelines before your first meeting.',
  },
};

const PRICING_PLAN_IDS: PricingPlanId[] = [
  'sales',
  'recruitment',
  'corporate',
  'investment',
];

const buildCreditPackFromTier = (
  plan: PricingPlan,
  tier: PricingPlanTier,
): CreditPack => ({
  key: `${plan.id}_maps_${tier.maps}`,
  name: `${plan.label} — ${tier.maps} maps`,
  credits: tier.credits,
  amountSubunits: tier.pricesSubunits.GBP,
  currency: 'GBP',
  creditsDisplay: `${tier.credits.toLocaleString('en-US')} credits — ${tier.maps} talent maps`,
  useCase: plan.tagline,
  features: plan.ownFeatures,
  includedEmailCredits: tier.credits,
  includedPhoneCredits: Math.floor(tier.credits / 5),
  planId: plan.id,
  intent: plan.intent,
  mapsCount: tier.maps,
  mapType: plan.mapType,
  mapTypeLabel: plan.mapTypeLabel,
  tagline: plan.tagline,
  inheritedFromPlanId: plan.inheritedFromPlanId,
  pricesSubunits: tier.pricesSubunits,
});

// ---------------------------------------------------------------------------
// Derived flat CREDIT_PACKS — runtime keeps using `creditPackKey` end to end.
// ---------------------------------------------------------------------------

export const CREDIT_PACKS_BY_PLAN: Record<PricingPlanId, CreditPack[]> = {
  sales: PRICING_PLANS.sales.tiers.map((tier) =>
    buildCreditPackFromTier(PRICING_PLANS.sales, tier),
  ),
  recruitment: PRICING_PLANS.recruitment.tiers.map((tier) =>
    buildCreditPackFromTier(PRICING_PLANS.recruitment, tier),
  ),
  corporate: PRICING_PLANS.corporate.tiers.map((tier) =>
    buildCreditPackFromTier(PRICING_PLANS.corporate, tier),
  ),
  investment: PRICING_PLANS.investment.tiers.map((tier) =>
    buildCreditPackFromTier(PRICING_PLANS.investment, tier),
  ),
};

export const CREDIT_PACKS_BY_INTENT: Record<PricingIntent, CreditPack[]> = {
  SALES: CREDIT_PACKS_BY_PLAN.sales,
  RECRUITING: CREDIT_PACKS_BY_PLAN.recruitment,
  CORPORATE: CREDIT_PACKS_BY_PLAN.corporate,
  INVESTING: CREDIT_PACKS_BY_PLAN.investment,
};

export const ALL_CREDIT_PACKS: CreditPack[] = PRICING_PLAN_IDS.flatMap(
  (planId) => CREDIT_PACKS_BY_PLAN[planId],
);

// Backwards-compatible export (server re-exports this as RAZORPAY_CREDIT_PACKS).
export const CREDIT_PACKS: CreditPack[] = ALL_CREDIT_PACKS;

export const DEFAULT_CREDIT_PACKS: CreditPack[] = CREDIT_PACKS_BY_INTENT.SALES;

export const getCreditPacksForIntent = (
  intent: PricingIntent | null | undefined,
): CreditPack[] => {
  if (!intent) return DEFAULT_CREDIT_PACKS;

  return CREDIT_PACKS_BY_INTENT[intent] ?? DEFAULT_CREDIT_PACKS;
};

export const PRICING_INTENT_TO_PLAN_ID: Record<PricingIntent, PricingPlanId> = {
  SALES: 'sales',
  RECRUITING: 'recruitment',
  CORPORATE: 'corporate',
  INVESTING: 'investment',
};

export const PRICING_PLAN_ID_TO_INTENT: Record<PricingPlanId, PricingIntent> = {
  sales: 'SALES',
  recruitment: 'RECRUITING',
  corporate: 'CORPORATE',
  investment: 'INVESTING',
};

export const getCreditPackByKey = (
  key: CreditPackKey,
): CreditPack | undefined =>
  ALL_CREDIT_PACKS.find((pack) => pack.key === key);

/** Walk inheritedFromPlanId to compute the cascading feature list. */
export const getInheritedFeatures = (
  planId: PricingPlanId,
): { inheritedFromLabel: string | null; features: string[] } => {
  const plan = PRICING_PLANS[planId];
  const parentId = plan.inheritedFromPlanId;
  if (!parentId) {
    return { inheritedFromLabel: null, features: [] };
  }
  const parent = PRICING_PLANS[parentId];
  return { inheritedFromLabel: parent.label, features: parent.ownFeatures };
};

// ---------------------------------------------------------------------------
// Currency helpers (extended with AUD + AED).
// ---------------------------------------------------------------------------

export const SUPPORTED_PRICING_CURRENCIES: SupportedPricingCurrency[] = [
  'INR',
  'USD',
  'GBP',
  'EUR',
  'AUD',
  'AED',
];

export const getPricingCurrencySymbol = (
  currency: SupportedPricingCurrency,
): string => PRICING_CURRENCY_SYMBOLS[currency];

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

export const convertCreditPackToCurrency = (
  pack: CreditPack,
  targetCurrency: SupportedPricingCurrency,
): CreditPack => {
  const explicitPrice = pack.pricesSubunits?.[targetCurrency];
  if (typeof explicitPrice === 'number' && explicitPrice > 0) {
    return {
      ...pack,
      amountSubunits: explicitPrice,
      currency: targetCurrency,
    };
  }

  const sourceCurrency = SUPPORTED_PRICING_CURRENCIES.includes(
    pack.currency as SupportedPricingCurrency,
  )
    ? (pack.currency as SupportedPricingCurrency)
    : 'GBP';

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

/** Returns explicit per-currency price from the tier table when available. */
export const getCreditPackTierPrice = (
  pack: CreditPack,
  currency: SupportedPricingCurrency,
): number => {
  const explicit = pack.pricesSubunits?.[currency];
  if (typeof explicit === 'number' && explicit > 0) {
    return explicit;
  }
  const sourceCurrency = SUPPORTED_PRICING_CURRENCIES.includes(
    pack.currency as SupportedPricingCurrency,
  )
    ? (pack.currency as SupportedPricingCurrency)
    : 'GBP';
  return convertPricingAmountSubunits(
    pack.amountSubunits,
    sourceCurrency,
    currency,
  );
};

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
  if (normalized === 'AU') {
    return 'AUD';
  }
  if (GCC_COUNTRY_CODES.has(normalized)) {
    return 'AED';
  }
  if (EUR_COUNTRY_CODES.has(normalized)) {
    return 'EUR';
  }
  return 'USD';
};

export const creditPackPricingFootnote = [
  'Prices shown per Talent Map at the selected volume.',
  'Credits are bundled per map purchase (1 credit = 1 verified email; 5 credits = 1 phone number).',
  'Unused credits roll over within your plan cycle.',
  'Custom enterprise pricing is available — get in touch.',
  'Credit card payments: +3% surcharge. Pay by invoice: no surcharge.',
].join(' ');

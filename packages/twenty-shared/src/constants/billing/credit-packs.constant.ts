/* @license Enterprise */

export type CreditPackKey = string;

export type PricingIntent = 'SALES' | 'RECRUITING' | 'CORPORATE' | 'INVESTING';

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

export type MapType = 'Function Specific' | 'Full Company' | 'Full Company Timelines';

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

export type PricingSegmentTone = 'orange' | 'indigo' | 'teal' | 'forest';

export type PricingPlanContent = {
  tabLabel: string;
  onboardingTitle: string;
  onboardingBody: string;
  onboardingHint: string;
  persona: string;
  segmentTone: PricingSegmentTone;
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
    tagline: 'Map the buying committee from the live org graph',
    icon: '📡',
    mapType: 'Function Specific',
    mapTypeLabel:
      'Any Function · All Levels',
    minMaps: 10,
    inheritedFromPlanId: null,
    ownFeatures: [
      'Functional talent map (All Levels)',
      '100 people per function',
      'Decision-maker identification and mapping',
      'Contact enrichment',
      'WhatsApp/ Email/ Linkedin outreach sequences',
      'Email / WhatsApp export',
    ],
    tiers: [
      {
        maps: 10,
        credits: 500,
        pricesSubunits: {
          INR: 7500 * 100,
          USD: 200 * 100,
          GBP: 200 * 100,
          EUR: 200 * 100,
          AUD: 200 * 100,
          AED: 750 * 100,
        },
      },
      {
        maps: 25,
        credits: 1300,
        pricesSubunits: {
          INR: 4500 * 100,
          USD: 180 * 100,
          GBP: 180 * 100,
          EUR: 180 * 100,
          AUD: 180 * 100,
          AED: 550 * 100,
        },
      },
      {
        maps: 50,
        credits: 2700,
        pricesSubunits: {
          INR: 4000 * 100,
          USD: 175 * 100,
          GBP: 175 * 100,
          EUR: 175 * 100,
          AUD: 175 * 100,
          AED: 500 * 100,
        },
      },
      {
        maps: 100,
        credits: 5500,
        pricesSubunits: {
          INR: 3500 * 100,
          USD: 150 * 100,
          GBP: 150 * 100,
          EUR: 150 * 100,
          AUD: 150 * 100,
          AED: 400 * 100,
        },
      },
    ],
  },
  recruitment: {
    id: 'recruitment',
    intent: 'RECRUITING',
    label: 'Recruitment / Exec Search',
    tagline: 'Org intelligence before the mandate—every level, every function',
    icon: '🔍',
    mapType: 'Full Company',
    mapTypeLabel: 'Full company · All Levels & Functions',
    minMaps: 10,
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
        maps: 10,
        credits: 1000,
        pricesSubunits: {
          INR: 10000 * 100,
          USD: 250 * 100,
          GBP: 250 * 100,
          EUR: 250 * 100,
          AUD: 250 * 100,
          AED: 1000 * 100,
        },
      },
      {
        maps: 25,
        credits: 2600,
        pricesSubunits: {
          INR: 7500 * 100,
          USD: 200 * 100,
          GBP: 200 * 100,
          EUR: 200 * 100,
          AUD: 200 * 100,
          AED: 750 * 100,
        },
      },
      {
        maps: 50,
        credits: 5200,
        pricesSubunits: {
          INR: 6000 * 100,
          USD: 160 * 100,
          GBP: 160 * 100,
          EUR: 160 * 100,
          AUD: 160 * 100,
          AED: 600 * 100,
        },
      },
      {
        maps: 100,
        credits: 10500,
        pricesSubunits: {
          INR: 5000 * 100,
          USD: 130 * 100,
          GBP: 130 * 100,
          EUR: 130 * 100,
          AUD: 130 * 100,
          AED: 500 * 100,
        },
      },
    ],
  },
  corporate: {
    id: 'corporate',
    intent: 'CORPORATE',
    label: 'Corporate HR',
    tagline: 'Peer org structure as a live benchmark',
    icon: '🏛',
    mapType: 'Full Company',
    mapTypeLabel: 'Full company · All levels & Functions',
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
          INR: 12500 * 100,
          USD: 300 * 100,
          GBP: 300 * 100,
          EUR: 300 * 100,
          AUD: 300 * 100,
          AED: 1250 * 100,
        },
      },
      {
        maps: 25,
        credits: 3800,
        pricesSubunits: {
          INR: 10500 * 100,
          USD: 280 * 100,
          GBP: 280 * 100,
          EUR: 280 * 100,
          AUD: 280 * 100,
          AED: 1050 * 100,
        },
      },
      {
        maps: 50,
        credits: 7500,
        pricesSubunits: {
          INR: 10000 * 100,
          USD: 270 * 100,
          GBP: 270 * 100,
          EUR: 270 * 100,
          AUD: 270 * 100,
          AED: 1000 * 100,
        },
      },
      {
        maps: 100,
        credits: 15000,
        pricesSubunits: {
          INR: 9500 * 100,
          USD: 255 * 100,
          GBP: 255 * 100,
          EUR: 255 * 100,
          AUD: 255 * 100,
          AED: 950 * 100,
        },
      },
      {
        maps: 200,
        credits: 28000,
        pricesSubunits: {
          INR: 9000 * 100,
          USD: 240 * 100,
          GBP: 240 * 100,
          EUR: 240 * 100,
          AUD: 240 * 100,
          AED: 900 * 100,
        },
      },
    ],
  },
  investment: {
    id: 'investment',
    intent: 'INVESTING',
    label: 'Investment Companies',
    tagline: 'Queryable structure and org timeline for PE / VC',
    icon: '📈',
    mapType: 'Full Company Timelines',
    mapTypeLabel: 'Full company · All Levels & Functions',
    minMaps: 10,
    inheritedFromPlanId: 'corporate',
    ownFeatures: [
      'Portfolio company mapping',
      'Org Timeline — complete MoM company changes',
      'Alumni data · up to 3× profile depth',
      'Post-acquisition team buildout tracking',
      'Dedicated account manager',
    ],
    tiers: [
      {
        maps: 10,
        credits: 1500,
        pricesSubunits: {
          INR: 15000 * 100,
          USD: 400 * 100,
          GBP: 400 * 100,
          EUR: 400 * 100,
          AUD: 400 * 100,
          AED: 1500 * 100,
        },
      },
      {
        maps: 25,
        credits: 3800,
        pricesSubunits: {
          INR: 13500 * 100,
          USD: 375 * 100,
          GBP: 375 * 100,
          EUR: 375 * 100,
          AUD: 375 * 100,
          AED: 1350 * 100,
        },
      },
      {
        maps: 50,
        credits: 7500,
        pricesSubunits: {
          INR: 12000 * 100,
          USD: 350 * 100,
          GBP: 350 * 100,
          EUR: 350 * 100,
          AUD: 350 * 100,
          AED: 1200 * 100,
        },
      },
      {
        maps: 100,
        credits: 15000,
        pricesSubunits: {
          INR: 11000 * 100,
          USD: 325 * 100,
          GBP: 325 * 100,
          EUR: 325 * 100,
          AUD: 325 * 100,
          AED: 1100 * 100,
        },
      },
    ],
  },
};

export const PRICING_MARKETING_HERO_HEADLINE =
  'Access the org graph—plans for every team that runs on org intelligence';
export const PRICING_MARKETING_HERO_SUBHEADLINE =
  'Executive search, investors, sales, and corporate strategy—choose your tier.\nMap volume, depth, and refresh cadence scale with how you query structure.';
export const PRICING_BILLING_HERO_HEADLINE =
  'Choose your org intelligence plan';
export const PRICING_MARKETING_ROI_HEADLINE =
  'Queryable structure before your first message, brief, or management call.';
export const PRICING_HELP_ENGAGEMENT_LEAD =
  'Ready to act on the org graph? Engage with precision from the same platform.';
export const PRICING_HELP_ENGAGEMENT_LINK_LABEL = 'Learn about Engagement →';
export const PRICING_HELP_TITLE = 'Need more information?';
export const PRICING_HELP_SUBTITLE =
  "Let's find the perfect solution for your organization.";
export const PRICING_CTA_START_FOR_FREE = 'Setup a free trial';
export const PRICING_CTA_TALK_TO_SALES = 'Talk to sales';
export const PRICING_CTA_BOOK_DEMO = 'Book a demo';
export const PRICING_MAP_TYPE_LABEL = 'Map type';
export const PRICING_VOLUME_LABEL = 'Volume';
export const PRICING_TALENT_MAP_UNIT = 'map';
export const PRICING_TALENT_MAPS_UNIT = 'talent maps';
export const PRICING_RECOMMENDED_PLAN_LABEL = 'Recommended';
export const PRICING_RECOMMENDED_PLAN_ID: PricingPlanId = 'recruitment';
export const PRICING_COMPARABLE_MAPS_VOLUME = 10;
export const REVEAL_CREDIT_COST_EMAIL = 1;
export const REVEAL_CREDIT_COST_PHONE = 5;
export const PRICING_CREDITS_CONVERSION_HELP =
  '1 credit = 1 verified email. 5 credits = 1 phone reveal.';
export const PRICING_SMALL_PAYMENT_TEST_DEV_BANNER =
  'Development only: small payment test SKUs are enabled on this environment.';
export const PRICING_PLAN_CONTENT_BY_ID: Record<
  PricingPlanId,
  PricingPlanContent
> = {
  sales: {
    tabLabel: PRICING_PLANS.sales.label,
    onboardingTitle: PRICING_PLANS.sales.label,
    onboardingBody: 'Functional talent maps for targeted outreach, decision-maker IDs, credits to start.',
    onboardingHint: 'Self-serve · extension · ~2 hr delivery',
    persona: 'Founder/ Sales',
    segmentTone: 'orange',
    heroHeadline: 'Pipeline-grade org intelligence for Sales/ ABM',
    heroSubheadline: 'Map buying committees, champions, and blockers across target accounts — then reveal/export only what matters.',
  },
  recruitment: {
    tabLabel: PRICING_PLANS.recruitment.label,
    onboardingTitle: PRICING_PLANS.recruitment.label,
    onboardingBody: 'Full company maps, mandate-specific candidates, contact enrichment.',
    onboardingHint: 'Self-serve or 20-min live walkthrough',
    persona: 'Recruiter',
    segmentTone: 'indigo',
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
    persona: 'Corporate HR',
    segmentTone: 'teal',
    heroHeadline: 'Competitor benchmarking for Corporate HR',
    heroSubheadline:
      'Track competitor org changes, run BU-level benchmarks, and govern multi-seat access with credit controls.',
  },
  investment: {
    tabLabel: PRICING_PLANS.investment.label,
    onboardingTitle: 'Investment / deal diligence',
    onboardingBody:
      'Portfolio org intelligence and leadership timeline for deals.',
    onboardingHint: 'Book a call · live company map',
    persona: 'PE/ VC',
    segmentTone: 'forest',
    heroHeadline: 'Org Timeline for Investment Companies',
    heroSubheadline:
      'Diligence faster, monitor portfolios, and benchmark leadership timelines before your first meeting.',
  },
};

export const PRICING_PLAN_ORDER: PricingPlanId[] = [
  'sales',
  'recruitment',
  'corporate',
  'investment',
];

export const getPricingMarketingSubheadlineLines = (): string[] =>
  PRICING_MARKETING_HERO_SUBHEADLINE.split('\n');

export const findPricingPlanTier = (
  plan: PricingPlan,
  maps: number,
): PricingPlanTier => {
  const exact = plan.tiers.find((tier) => tier.maps === maps);
  return exact ?? plan.tiers[0];
};

export const getComparableMapsForPlan = (
  planId: PricingPlanId,
  comparableMaps = PRICING_COMPARABLE_MAPS_VOLUME,
): number => {
  const plan = PRICING_PLANS[planId];
  const hasComparableTier = plan.tiers.some(
    (tier) => tier.maps === comparableMaps,
  );
  return hasComparableTier ? comparableMaps : plan.minMaps;
};

export const buildComparableMapsByPlan = (
  comparableMaps = PRICING_COMPARABLE_MAPS_VOLUME,
): Record<PricingPlanId, number> =>
  PRICING_PLAN_ORDER.reduce(
    (acc, planId) => {
      acc[planId] = getComparableMapsForPlan(planId, comparableMaps);
      return acc;
    },
    {} as Record<PricingPlanId, number>,
  );

export const buildInitialPricingTierStateByMinMaps = (): Record<
  PricingPlanId,
  number
> =>
  PRICING_PLAN_ORDER.reduce(
    (acc, planId) => {
      acc[planId] = PRICING_PLANS[planId].minMaps;
      return acc;
    },
    {} as Record<PricingPlanId, number>,
  );

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

export const CREDIT_PACKS_BY_PLAN: Record<PricingPlanId, CreditPack[]> =
  PRICING_PLAN_ORDER.reduce<Record<PricingPlanId, CreditPack[]>>(
    (acc, planId) => {
      const plan = PRICING_PLANS[planId];
      acc[planId] = plan.tiers.map((tier) =>
        buildCreditPackFromTier(plan, tier),
      );
      return acc;
    },
    {
      sales: [],
      recruitment: [],
      corporate: [],
      investment: [],
    },
  );

export const CREDIT_PACKS_BY_INTENT: Record<PricingIntent, CreditPack[]> = {
  SALES: CREDIT_PACKS_BY_PLAN.sales,
  RECRUITING: CREDIT_PACKS_BY_PLAN.recruitment,
  CORPORATE: CREDIT_PACKS_BY_PLAN.corporate,
  INVESTING: CREDIT_PACKS_BY_PLAN.investment,
};

export const ALL_CREDIT_PACKS: CreditPack[] = PRICING_PLAN_ORDER.flatMap(
  (planId) => CREDIT_PACKS_BY_PLAN[planId],
);

const SMALL_PAYMENT_TEST_PRICE_SUBUNITS_BY_CURRENCY: Record<
  SupportedPricingCurrency,
  number
> = {
  USD: 100,
  GBP: 79,
  EUR: 93,
  INR: 8300,
  AUD: 154,
  AED: 367,
};

export const SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE = -1;

export const getSmallPaymentTestCreditPackKey = (
  planId: PricingPlanId,
): CreditPackKey => `${planId}_small_payment_test`;

export const SMALL_PAYMENT_TEST_CREDIT_PACKS: CreditPack[] =
  PRICING_PLAN_ORDER.map((planId) => {
    const plan = PRICING_PLANS[planId];

    return {
      key: getSmallPaymentTestCreditPackKey(planId),
      name: `${plan.label} — $1 payment test`,
      credits: 1,
      amountSubunits: SMALL_PAYMENT_TEST_PRICE_SUBUNITS_BY_CURRENCY.GBP,
      currency: 'GBP',
      creditsDisplay:
        '1 org chart credit · 1 reveal credit (sandbox / card test)',
      useCase: plan.tagline,
      features: [
        '$1 total charge plus card surcharge (Razorpay test mode).',
        'Grants exactly one map credit and one reveal credit.',
        'Enable only via SMALL_PAYMENT_TESTING — never leave on in production.',
      ],
      includedEmailCredits: 1,
      includedPhoneCredits: 0,
      planId,
      intent: plan.intent,
      mapsCount: 1,
      mapType: plan.mapType,
      mapTypeLabel: plan.mapTypeLabel,
      tagline: plan.tagline,
      inheritedFromPlanId: plan.inheritedFromPlanId,
      pricesSubunits: { ...SMALL_PAYMENT_TEST_PRICE_SUBUNITS_BY_CURRENCY },
    };
  });

// Backwards-compatible export (server re-exports this as RAZORPAY_CREDIT_PACKS).
export const CREDIT_PACKS: CreditPack[] = ALL_CREDIT_PACKS;

export const DEFAULT_CREDIT_PACKS: CreditPack[] = CREDIT_PACKS_BY_INTENT.SALES;

export const getCreditPacksForIntent = (
  intent: PricingIntent | null | undefined,
): CreditPack[] => {
  if (!intent) return DEFAULT_CREDIT_PACKS;

  return CREDIT_PACKS_BY_INTENT[intent] ?? DEFAULT_CREDIT_PACKS;
};

export const PRICING_PLAN_ID_TO_INTENT: Record<PricingPlanId, PricingIntent> =
  PRICING_PLAN_ORDER.reduce<Record<PricingPlanId, PricingIntent>>(
    (acc, planId) => {
      acc[planId] = PRICING_PLANS[planId].intent;
      return acc;
    },
    {} as Record<PricingPlanId, PricingIntent>,
  );

export const PRICING_INTENT_TO_PLAN_ID: Record<PricingIntent, PricingPlanId> =
  PRICING_PLAN_ORDER.reduce<Record<PricingIntent, PricingPlanId>>(
    (acc, planId) => {
      acc[PRICING_PLAN_ID_TO_INTENT[planId]] = planId;
      return acc;
    },
    {} as Record<PricingIntent, PricingPlanId>,
  );

export const getCreditPackByKey = (
  key: CreditPackKey,
): CreditPack | undefined => ALL_CREDIT_PACKS.find((pack) => pack.key === key);

/** Credit pack for a plan volume — always matches `findPricingPlanTier` (single source with `PRICING_PLANS`). */
export const getCreditPackForPlanVolume = (
  planId: PricingPlanId,
  requestedMaps: number,
): CreditPack | undefined => {
  const tier = findPricingPlanTier(PRICING_PLANS[planId], requestedMaps);

  return getCreditPackByKey(`${planId}_maps_${tier.maps}`);
};

export type OnboardingIntentPathKey =
  | 'EXTENSION_INSTALL'
  | 'COMPETITIVE_RESEARCH'
  | 'CORPORATE_TA'
  | 'DEAL_DILIGENCE';

/** Maps onboarding intent paths to the pricing plan whose features they promote. */
export const ONBOARDING_INTENT_PATH_TO_PRICING_PLAN_ID: Record<
  OnboardingIntentPathKey,
  PricingPlanId
> = {
  EXTENSION_INSTALL: 'sales',
  COMPETITIVE_RESEARCH: 'recruitment',
  CORPORATE_TA: 'corporate',
  DEAL_DILIGENCE: 'investment',
};

export const getPricingPlanOwnFeatures = (planId: PricingPlanId): string[] =>
  PRICING_PLANS[planId].ownFeatures;

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

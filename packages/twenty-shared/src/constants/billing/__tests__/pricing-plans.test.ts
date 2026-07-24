import {
    ALL_CREDIT_PACKS,
    buildComparableMapsByPlan,
    findPricingPlanTier,
    getComparableMapsForPlan,
    getCreditPackByKey,
    getCreditPackForPlanVolume,
    getPricingMarketingSubheadlineLines,
    getPricingPlanOwnFeatures,
    getSmallPaymentTestCreditPackKey,
    ONBOARDING_INTENT_PATH_TO_PRICING_PLAN_ID,
    PRICING_COMPARABLE_MAPS_VOLUME,
    PRICING_PLAN_CONTENT_BY_ID,
    PRICING_PLAN_ORDER,
    PRICING_PLANS,
    PRICING_RECOMMENDED_PLAN_ID,
    SMALL_PAYMENT_TEST_CREDIT_PACKS,
    SUPPORTED_PRICING_CURRENCIES,
    type PricingPlanId,
} from '../credit-packs.constant';

describe('SMALL_PAYMENT_TEST_CREDIT_PACKS', () => {
  const liveKeys = new Set(ALL_CREDIT_PACKS.map((p) => p.key));

  it('defines one non-overlapping sandbox pack per pricing plan', () => {
    const planIds = Object.keys(PRICING_PLANS) as PricingPlanId[];

    expect(SMALL_PAYMENT_TEST_CREDIT_PACKS.length).toBe(planIds.length);

    for (const planId of planIds) {
      expect(getSmallPaymentTestCreditPackKey(planId)).toMatch(
        /^[a-z]+_small_payment_test$/,
      );
    }

    for (const pack of SMALL_PAYMENT_TEST_CREDIT_PACKS) {
      expect(liveKeys.has(pack.key)).toBe(false);
      expect(pack.mapsCount).toBe(1);
      expect(pack.credits).toBe(1);
      expect(pack.includedEmailCredits).toBe(1);
      expect(pack.includedPhoneCredits).toBe(0);
      expect(pack.pricesSubunits.USD).toBe(100);

      for (const currency of SUPPORTED_PRICING_CURRENCIES) {
        const subunits = pack.pricesSubunits[currency];

        expect(subunits).toBeDefined();
        expect(typeof subunits).toBe('number');
        expect(subunits).toBeGreaterThan(0);
      }
    }
  });
});

describe('pricing marketing content', () => {
  it('keeps the canonical plan order and recommended plan', () => {
    expect(PRICING_PLAN_ORDER).toEqual([
      'sales',
      'recruitment',
      'corporate',
      'investment',
    ]);
    expect(PRICING_RECOMMENDED_PLAN_ID).toBe('recruitment');
  });

  it('splits the marketing subheadline into orienting lines', () => {
    expect(getPricingMarketingSubheadlineLines()).toEqual([
      'Executive search, investors, sales, and corporate strategy—choose your tier.',
      'Map volume, depth, and refresh cadence scale with how you query structure.',
    ]);
  });

  it('defines segment content for every plan', () => {
    for (const planId of PRICING_PLAN_ORDER) {
      const content = PRICING_PLAN_CONTENT_BY_ID[planId];
      expect(content.persona.length).toBeGreaterThan(0);
      expect(content.onboardingHint.length).toBeGreaterThan(0);
      expect(content.segmentTone).toBeDefined();
    }
  });

  it('maps each onboarding intent path to a pricing plan with matching features', () => {
    expect(ONBOARDING_INTENT_PATH_TO_PRICING_PLAN_ID).toEqual({
      EXTENSION_INSTALL: 'sales',
      COMPETITIVE_RESEARCH: 'recruitment',
      CORPORATE_TA: 'corporate',
      DEAL_DILIGENCE: 'investment',
    });

    for (const planId of Object.values(ONBOARDING_INTENT_PATH_TO_PRICING_PLAN_ID)) {
      expect(getPricingPlanOwnFeatures(planId)).toEqual(
        PRICING_PLANS[planId].ownFeatures,
      );
    }
  });

  it('maps each plan to a distinct lane segment tone', () => {
    expect(PRICING_PLAN_CONTENT_BY_ID.sales.segmentTone).toBe('orange');
    expect(PRICING_PLAN_CONTENT_BY_ID.recruitment.segmentTone).toBe('indigo');
    expect(PRICING_PLAN_CONTENT_BY_ID.corporate.segmentTone).toBe('teal');
    expect(PRICING_PLAN_CONTENT_BY_ID.investment.segmentTone).toBe('forest');
  });

  it('uses comparable map volume when a plan supports it', () => {
    expect(getComparableMapsForPlan('sales')).toBe(PRICING_COMPARABLE_MAPS_VOLUME);
    expect(getComparableMapsForPlan('recruitment')).toBe(
      PRICING_COMPARABLE_MAPS_VOLUME,
    );
    expect(buildComparableMapsByPlan()).toEqual({
      sales: PRICING_COMPARABLE_MAPS_VOLUME,
      recruitment: PRICING_COMPARABLE_MAPS_VOLUME,
      corporate: PRICING_COMPARABLE_MAPS_VOLUME,
      investment: PRICING_COMPARABLE_MAPS_VOLUME,
    });
  });
});

describe('PRICING_PLANS', () => {
  const planIds = Object.keys(PRICING_PLANS) as PricingPlanId[];

  it('exposes the four expected plans', () => {
    expect(planIds.sort()).toEqual(
      ['corporate', 'investment', 'recruitment', 'sales'].sort(),
    );
  });

  it('orders INR per-map entry tiers Sales < Recruitment < Corporate < Investment', () => {
    const refMaps = PRICING_COMPARABLE_MAPS_VOLUME;
    const inrByPlan = PRICING_PLAN_ORDER.map((planId) => {
      const tier = findPricingPlanTier(PRICING_PLANS[planId], refMaps);

      return tier.pricesSubunits.INR / 100;
    });

    expect(inrByPlan[0]).toBeLessThan(inrByPlan[1]);
    expect(inrByPlan[1]).toBeLessThan(inrByPlan[2]);
    expect(inrByPlan[2]).toBeLessThan(inrByPlan[3]);
    expect(inrByPlan[0]).toBe(7500);
    expect(inrByPlan[1]).toBe(10000);
    expect(inrByPlan[2]).toBe(12500);
    expect(inrByPlan[3]).toBe(15000);

    const usdByPlan = PRICING_PLAN_ORDER.map((planId) => {
      const tier = findPricingPlanTier(PRICING_PLANS[planId], refMaps);

      return tier.pricesSubunits.USD / 100;
    });

    expect(usdByPlan[0]).toBeLessThan(usdByPlan[1]);
    expect(usdByPlan[1]).toBeLessThan(usdByPlan[2]);
    expect(usdByPlan[2]).toBeLessThan(usdByPlan[3]);
  });

  it('getCreditPackForPlanVolume matches tier maps and key', () => {
    const pack = getCreditPackForPlanVolume('recruitment', 10);

    expect(pack?.key).toBe('recruitment_maps_10');
    expect(pack?.mapsCount).toBe(10);
    expect(getCreditPackForPlanVolume('recruitment', 5)?.key).toBe(
      'recruitment_maps_10',
    );
    expect(getCreditPackByKey('recruitment_maps_5')).toBeUndefined();
  });

  it.each(planIds)(
    'plan %s has at least one tier and a sane minMaps value',
    (planId) => {
      const plan = PRICING_PLANS[planId];
      expect(plan.tiers.length).toBeGreaterThan(0);
      expect(plan.tiers[0].maps).toBe(plan.minMaps);
    },
  );

  it.each(planIds)(
    'every tier in plan %s has a positive price for every supported currency',
    (planId) => {
      const plan = PRICING_PLANS[planId];

      for (const tier of plan.tiers) {
        for (const currency of SUPPORTED_PRICING_CURRENCIES) {
          const subunits = tier.pricesSubunits[currency];

          expect(subunits).toBeDefined();
          expect(typeof subunits).toBe('number');
          expect(subunits).toBeGreaterThan(0);
        }
      }
    },
  );

  it('credits scale monotonically with maps within each plan', () => {
    for (const planId of planIds) {
      const plan = PRICING_PLANS[planId];

      for (let i = 1; i < plan.tiers.length; i += 1) {
        const previous = plan.tiers[i - 1];
        const current = plan.tiers[i];

        expect(current.maps).toBeGreaterThan(previous.maps);
        expect(current.credits).toBeGreaterThanOrEqual(previous.credits);
      }
    }
  });

  it('total tier price increases with maps for each currency', () => {
    for (const planId of planIds) {
      const plan = PRICING_PLANS[planId];

      for (const currency of SUPPORTED_PRICING_CURRENCIES) {
        for (let i = 1; i < plan.tiers.length; i += 1) {
          const previous = plan.tiers[i - 1];
          const current = plan.tiers[i];
          const previousTotal = previous.pricesSubunits[currency] * previous.maps;
          const currentTotal = current.pricesSubunits[currency] * current.maps;

          expect(currentTotal).toBeGreaterThan(previousTotal);
        }
      }
    }
  });
});

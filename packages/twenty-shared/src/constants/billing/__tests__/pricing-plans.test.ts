import {
  ALL_CREDIT_PACKS,
  getSmallPaymentTestCreditPackKey,
  PRICING_PLANS,
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

      for (const currency of SUPPORTED_PRICING_CURRENCIES) {
        const subunits = pack.pricesSubunits[currency];

        expect(subunits).toBeDefined();
        expect(typeof subunits).toBe('number');
        expect(subunits).toBeGreaterThan(0);
      }
    }
  });
});

describe('PRICING_PLANS', () => {
  const planIds = Object.keys(PRICING_PLANS) as PricingPlanId[];

  it('exposes the four expected plans', () => {
    expect(planIds.sort()).toEqual(
      ['corporate', 'investment', 'recruitment', 'sales'].sort(),
    );
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

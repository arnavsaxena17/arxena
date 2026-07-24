/* @license Enterprise */

import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { BillingProductKey } from 'src/engine/core-modules/billing/enums/billing-product-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { BillingUsageType } from 'src/engine/core-modules/billing/enums/billing-usage-type.enum';

export type BillingRequiredStripeCatalogProduct = {
  name: string;
  planKey: BillingPlanKey;
  productKey: BillingProductKey;
  priceUsageBased: BillingUsageType;
  // When set, prefer this existing Stripe product id (from env) before creating
  seedProductIdConfigKey?: 'BILLING_STRIPE_BASE_PLAN_PRODUCT_ID';
  createProductIfMissing: boolean;
  prices: BillingRequiredStripeCatalogPrice[];
};

export type BillingRequiredStripeCatalogPrice = {
  interval: SubscriptionInterval;
  // Only used when creating a missing RESOURCE_CREDIT price
  unitAmount: number;
  // Required on RESOURCE_CREDIT prices (internal micro-credits)
  creditAmount?: number;
};

// Minimum Stripe catalog required for onboarding checkout (PRO monthly)
export const BILLING_REQUIRED_STRIPE_CATALOG: BillingRequiredStripeCatalogProduct[] =
  [
    {
      name: 'Pro Plan',
      planKey: BillingPlanKey.PRO,
      productKey: BillingProductKey.BASE_PRODUCT,
      priceUsageBased: BillingUsageType.LICENSED,
      seedProductIdConfigKey: 'BILLING_STRIPE_BASE_PLAN_PRODUCT_ID',
      createProductIfMissing: false,
      prices: [
        {
          interval: SubscriptionInterval.Month,
          unitAmount: 0,
        },
      ],
    },
    {
      name: 'Pro AI Credits',
      planKey: BillingPlanKey.PRO,
      productKey: BillingProductKey.RESOURCE_CREDIT,
      priceUsageBased: BillingUsageType.LICENSED,
      createProductIfMissing: true,
      prices: [
        {
          interval: SubscriptionInterval.Month,
          unitAmount: 0,
          // 1 display credit
          creditAmount: 1_000_000,
        },
      ],
    },
  ];

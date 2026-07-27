/* @license Enterprise */

import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { BillingProductKey } from 'src/engine/core-modules/billing/enums/billing-product-key.enum';
import { BillingUsageType } from 'src/engine/core-modules/billing/enums/billing-usage-type.enum';
import { type BillingProductMetadata } from 'src/engine/core-modules/billing/types/billing-product-metadata.type';

// Synthetic Stripe-shaped product id for the Razorpay licensed base plan.
// Plan UI and checkout resolve the base product via this metadata shape.
export const RAZORPAY_BASE_PRODUCT_ID = 'razorpay_base';

export const RAZORPAY_BASE_PRODUCT_METADATA: BillingProductMetadata = {
  planKey: BillingPlanKey.PRO,
  productKey: BillingProductKey.BASE_PRODUCT,
  priceUsageBased: BillingUsageType.LICENSED,
};

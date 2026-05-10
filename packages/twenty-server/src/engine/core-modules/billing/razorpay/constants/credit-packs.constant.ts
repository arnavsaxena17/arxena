/* @license Enterprise */

import {
    CREDIT_PACKS,
    CreditPack,
    CreditPackKey,
    SMALL_PAYMENT_TEST_CREDIT_PACKS,
} from 'twenty-shared';

const SMALL_PAYMENT_TESTING_ENABLED =
  process.env.SMALL_PAYMENT_TESTING === 'true';

/** Razorpay product catalog includes optional sandbox $1 packs when SMALL_PAYMENT_TESTING=true. */
export const RAZORPAY_CREDIT_PACKS: CreditPack[] = SMALL_PAYMENT_TESTING_ENABLED
  ? [...CREDIT_PACKS, ...SMALL_PAYMENT_TEST_CREDIT_PACKS]
  : CREDIT_PACKS;

export type { CreditPack, CreditPackKey };

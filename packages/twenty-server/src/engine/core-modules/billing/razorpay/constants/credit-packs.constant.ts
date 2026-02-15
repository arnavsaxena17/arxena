/* @license Enterprise */

/**
 * One-time credit pack definitions for Razorpay.
 * 1 credit = 100 person org chart.
 * Amount in currency subunits (e.g. USD cents: 1000 USD = 100000).
 */
export const RAZORPAY_CREDIT_PACKS = [
  { key: 'credits_5', credits: 5, amountSubunits: 100000, currency: 'USD', name: '5 Credits' },
  { key: 'credits_10', credits: 10, amountSubunits: 200000, currency: 'USD', name: '10 Credits' },
] as const;

export type CreditPackKey = (typeof RAZORPAY_CREDIT_PACKS)[number]['key'];

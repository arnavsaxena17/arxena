/* @license Enterprise */

export type CreditPackKey = string;

export type CreditPack = {
  key: CreditPackKey;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
};

// 1 credit = 1 org chart (<100 employees). Larger charts consume more (e.g. 300 employees = 3 credits).
// Prices reflect recruitment market: recruiters charge $5K-40K/placement with no mapping.
export const RAZORPAY_CREDIT_PACKS: CreditPack[] = [
  {
    key: 'pack_single',
    name: '1 org chart',
    credits: 1,
    amountSubunits: 79900,
    currency: 'USD',
  },
  {
    key: 'pack_5',
    name: '5 org charts',
    credits: 5,
    amountSubunits: 249900,
    currency: 'USD',
  },
  {
    key: 'pack_15',
    name: '15 org charts',
    credits: 15,
    amountSubunits: 499900,
    currency: 'USD',
  },
  {
    key: 'pack_30',
    name: '30 org charts',
    credits: 30,
    amountSubunits: 799900,
    currency: 'USD',
  },
];

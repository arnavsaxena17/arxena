/* @license Enterprise */

export type CreditPackKey = string;

export type CreditPack = {
  key: CreditPackKey;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
};

export const RAZORPAY_CREDIT_PACKS: CreditPack[] = [
  {
    key: 'pack_small',
    name: 'Small Pack',
    credits: 5,
    amountSubunits: 99900,
    currency: 'INR',
  },
  {
    key: 'pack_medium',
    name: 'Medium Pack',
    credits: 15,
    amountSubunits: 249900,
    currency: 'INR',
  },
  {
    key: 'pack_large',
    name: 'Large Pack',
    credits: 50,
    amountSubunits: 699900,
    currency: 'INR',
  },
];

/* @license Enterprise */

export type CreditPackKey = string;

export type CreditPack = {
  key: CreditPackKey;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
  /** Display string for pricing UI (e.g. "1 credit (<100 employees)") */
  creditsDisplay: string;
  /** Short use-case label for pricing UI */
  useCase: string;
  /** Bullet points for pricing card */
  features: string[];
};

// 1 credit = 1 org chart (<100 employees). Larger charts consume more (e.g. 300 employees = 3 credits).
// Prices reflect recruitment market: recruiters charge $5K-40K/placement with no mapping.
export const CREDIT_PACKS: CreditPack[] = [
  {
    key: 'pack_10',
    name: '10 org charts',
    credits: 1,
    amountSubunits: 99900,
    currency: 'USD',
    creditsDisplay: '10 credits (<1 credit = mapping 1000 employees)',
    useCase: 'One-off mapping',
    features: [
      'Full org chart structure',
      'LinkedIn profiles + emails',
      'Sign up to unmask names',
    ],
  },
  {
    key: 'pack_20',
    name: '20 org charts',
    credits: 5,
    amountSubunits: 249900,
    currency: 'USD',
    creditsDisplay: '5 credits (~$500/credit)',
    useCase: 'Individual recruiters',
    features: ['5 org charts', 'All features included', '12-month expiry'],
  },
  {
    key: 'pack_30',
    name: '30 org chart credits',
    credits: 15,
    amountSubunits: 499900,
    currency: 'USD',
    creditsDisplay: '15 credits (~$333/credit)',
    useCase: 'TA teams, agencies',
    features: ['15 org charts', 'All features included', '12-month expiry'],
  },
  {
    key: 'pack_40',
    name: '30 org charts',
    credits: 30,
    amountSubunits: 799900,
    currency: 'USD',
    creditsDisplay: '30 credits (~$267/credit)',
    useCase: 'Power users, bulk mandates',
    features: ['30 org charts', 'All features included', '12-month expiry'],
  },
];

import { type CreditPack } from 'twenty-shared';

export type SupportedPricingCurrency =
  | 'INR'
  | 'USD'
  | 'GBP'
  | 'EUR'
  | 'AUD'
  | 'AED';

export const SUPPORTED_PRICING_CURRENCIES: SupportedPricingCurrency[] = [
  'INR',
  'USD',
  'GBP',
  'EUR',
  'AUD',
  'AED',
];

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

const isSupportedCurrency = (
  value: string | undefined,
): value is SupportedPricingCurrency =>
  value === 'INR' ||
  value === 'USD' ||
  value === 'GBP' ||
  value === 'EUR' ||
  value === 'AUD' ||
  value === 'AED';

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

  const sourceCurrency = isSupportedCurrency(pack.currency)
    ? pack.currency
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

export const getPricingCurrencySymbol = (
  currency: SupportedPricingCurrency,
): string => PRICING_CURRENCY_SYMBOLS[currency];

export const resolvePricingCurrencyFromCountryCode = (
  countryCode: string | null | undefined,
): SupportedPricingCurrency => {
  if (!countryCode) {
    return 'USD';
  }
  const normalized = countryCode.trim().toUpperCase();
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

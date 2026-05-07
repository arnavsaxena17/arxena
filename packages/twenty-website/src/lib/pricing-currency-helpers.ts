import { type CreditPack } from 'twenty-shared';

export type SupportedPricingCurrency = 'INR' | 'USD' | 'GBP' | 'EUR';

export const SUPPORTED_PRICING_CURRENCIES: SupportedPricingCurrency[] = [
  'INR',
  'USD',
  'GBP',
  'EUR',
];

const PRICING_CURRENCY_RATES_FROM_GBP: Record<SupportedPricingCurrency, number> = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  INR: 106,
};

const PRICING_CURRENCY_SYMBOLS: Record<SupportedPricingCurrency, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  INR: '₹',
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

export const convertCreditPacksToCurrency = (
  packs: CreditPack[],
  targetCurrency: SupportedPricingCurrency,
): CreditPack[] =>
  packs.map((pack) => ({
    ...pack,
    amountSubunits: convertPricingAmountSubunits(
      pack.amountSubunits,
      pack.currency === 'INR' ||
        pack.currency === 'USD' ||
        pack.currency === 'GBP' ||
        pack.currency === 'EUR'
        ? (pack.currency as SupportedPricingCurrency)
        : 'GBP',
      targetCurrency,
    ),
    currency: targetCurrency,
  }));

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
  if (EUR_COUNTRY_CODES.has(normalized)) {
    return 'EUR';
  }
  return 'USD';
};

import { headers } from 'next/headers';
import {
  resolvePricingCurrencyFromCountryCode,
  SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';

import { getClientIpFromHeaders } from '@/lib/bot-detection';

type CountryHeaderMatch = {
  source: string;
  countryCode: string;
};

function getCountryCodeFromHeaders(
  headersList: Headers,
): CountryHeaderMatch | null {
  const headersToTry = [
    'cloudfront-viewer-country',
    'cf-ipcountry',
    'x-vercel-ip-country',
    'x-country-code',
  ];

  for (const headerName of headersToTry) {
    const value = headersList.get(headerName)?.trim();
    if (value) {
      return {
        source: headerName,
        countryCode: value,
      };
    }
  }

  return null;
}

export async function getRequestPricingCurrency(): Promise<SupportedPricingCurrency> {
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);

  const countryHeader = getCountryCodeFromHeaders(headersList);
  const currency = countryHeader
    ? resolvePricingCurrencyFromCountryCode(countryHeader.countryCode)
    : 'USD';

  console.info('[Pricing geo]', {
    clientIp: clientIp ?? '(none)',
    countryCode: countryHeader?.countryCode ?? '(none)',
    countrySource: countryHeader?.source ?? '(none)',
    currency,
  });

  if (countryHeader) {
    return currency;
  }

  if (clientIp) {
    // We currently only have reliable country-level header geolocation in edge,
    // so if IP exists but country is unavailable, default to USD.
    return 'USD';
  }

  return 'USD';
}

import {
  resolvePricingCurrencyFromCountryCode,
  SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';
import { headers } from 'next/headers';

import { getClientIpFromHeaders } from '@/lib/bot-detection';
import { resolveCountryCodeFromClientIp } from './pricing-country-from-ip';

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

  let countryHeader = getCountryCodeFromHeaders(headersList);
  if (!countryHeader && clientIp) {
    const countryCodeFromIp = await resolveCountryCodeFromClientIp(clientIp);
    if (countryCodeFromIp) {
      countryHeader = {
        source: 'ipinfo',
        countryCode: countryCodeFromIp,
      };
    }
  }

  const currency = countryHeader
    ? resolvePricingCurrencyFromCountryCode(countryHeader.countryCode)
    : 'USD';

  console.info('[Pricing geo]', {
    clientIp: clientIp ?? '(none)',
    countryCode: countryHeader?.countryCode ?? '(none)',
    countrySource: countryHeader?.source ?? '(none)',
    currency,
  });

  return currency;
}

import {
    resolvePricingCurrencyFromCountryCode,
    type SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';
import { headers } from 'next/headers';
import {
    getCountryCodeFromCdnHeaders,
    lookupCountryByIp,
} from 'twenty-shared';

import { getClientIpFromHeaders } from '@/lib/bot-detection';

export async function getRequestPricingCurrency(): Promise<SupportedPricingCurrency> {
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);

  let countryHeader = getCountryCodeFromCdnHeaders((headerName) =>
    headersList.get(headerName),
  );
  if (!countryHeader && clientIp) {
    const countryCodeFromIp = await lookupCountryByIp(clientIp);
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

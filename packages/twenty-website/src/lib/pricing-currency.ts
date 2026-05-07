import { headers } from 'next/headers';
import {
  resolvePricingCurrencyFromCountryCode,
  type SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';

import { getClientIpFromHeaders } from '@/lib/bot-detection';

export async function getRequestPricingCurrency(): Promise<SupportedPricingCurrency> {
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);

  const cloudFrontCountry = headersList.get('cloudfront-viewer-country');
  if (cloudFrontCountry) {
    return resolvePricingCurrencyFromCountryCode(cloudFrontCountry);
  }

  if (clientIp) {
    // We currently only have reliable country-level header geolocation in edge,
    // so if IP exists but country is unavailable, default to USD.
    return 'USD';
  }

  return 'USD';
}

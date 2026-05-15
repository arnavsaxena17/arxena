import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, PRICING_PAGE_DESCRIPTION } from '@/lib/brand-content';
import { getRequestPricingCurrency } from '@/lib/pricing-currency';

import { PricingPageClient } from './PricingPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Pricing | ${BRAND.name}`,
  description: PRICING_PAGE_DESCRIPTION,
  alternates: {
    canonical: '/pricing',
  },
};

export default async function PricingPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  const defaultCurrency = await getRequestPricingCurrency();

  return (
    <PricingPageClient
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      defaultCurrency={defaultCurrency}
    />
  );
}

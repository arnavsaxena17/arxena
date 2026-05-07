import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { getRequestPricingCurrency } from '@/lib/pricing-currency';

import { PricingPageClient } from './PricingPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing | Arxena',
  description:
    "Map any target company's org chart — sales, recruiting, or diligence. Simple credit pricing. Add AI engagement when you're ready to reach out at scale.",
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

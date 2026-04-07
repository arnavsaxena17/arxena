import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { PricingContent } from '@/app/_components/pricing/PricingContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing | Arxena',
  description:
    "Map any target company's org chart — sales, recruiting, or diligence. Simple credit pricing. Add AI engagement when you're ready to reach out at scale.",
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <PricingContent signInUrl={signInUrl} signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}

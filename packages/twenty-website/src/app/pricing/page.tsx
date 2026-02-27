import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { PricingContent } from '@/app/_components/pricing/PricingContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing | Arxena',
  description:
    "Map any company's org chart. A fraction of one recruitment fee. From $799. Stop paying recruitment agencies $5K-40K per placement with no mapping.",
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

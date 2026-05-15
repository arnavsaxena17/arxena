import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, ENGAGE_PAGE } from '@/lib/brand-content';

import { EngagementContent } from '@/app/_components/engagement/EngagementContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Engage | ${BRAND.category} — ${BRAND.name}`,
  description: ENGAGE_PAGE.subheadline,
  alternates: {
    canonical: '/engage',
  },
};

export default function EngagePage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <EngagementContent signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}

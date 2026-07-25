import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, TEAM_PAGE } from '@/lib/brand-content';

import { TeamContent } from '@/app/_components/team/TeamContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Team | ${BRAND.name}`,
  description: TEAM_PAGE.subheadline,
  alternates: {
    canonical: '/team',
  },
};

export default function TeamPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <TeamContent signInUrl={signInUrl} signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { TeamContent } from '@/app/_components/team/TeamContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Team | Arxena',
  description:
    'Meet the team building Arxena — the world\'s first org chart database. 1M+ companies mapped, 55M+ professionals indexed.',
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

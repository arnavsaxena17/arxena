import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { EngagementContent } from '@/app/_components/engagement/EngagementContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Engage | AI outreach in your voice — WhatsApp, LinkedIn & email | Arxena',
  description:
    'Arxena AI sends personalized messages on WhatsApp, LinkedIn, and email — written in your voice, with context from the org chart. You step in only when someone has already replied.',
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

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { EngagementContent } from '@/app/_components/engagement/EngagementContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Engage | Org Chart AI — WhatsApp & LinkedIn outreach | Arxena',
  description:
    'The last step of Org Chart AI: build lists from real-time org charts, then human-like outreach from your accounts. WhatsApp and LinkedIn. You only talk to people who respond.',
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

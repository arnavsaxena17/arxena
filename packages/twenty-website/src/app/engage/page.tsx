import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { EngagementContent } from '@/app/_components/engagement/EngagementContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Engage | Arxena',
  description:
    'Our AI reaches out from your own WhatsApp and LinkedIn accounts. Messages go from you — human-like — across any channel. You only talk to people who are interested.',
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

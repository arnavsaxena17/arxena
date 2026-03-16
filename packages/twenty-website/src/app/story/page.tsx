import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { StoryContent } from '@/app/_components/story/StoryContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Story | Arxena',
  description:
    'Why we built Org Chart AI — real-time company structures from LinkedIn (and others), algorithmic recruitment, from map to engagement.',
  alternates: {
    canonical: '/story',
  },
};

export default function StoryPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <StoryContent signInUrl={signInUrl} signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}

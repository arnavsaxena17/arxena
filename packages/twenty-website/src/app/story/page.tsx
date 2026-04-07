import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { StoryContent } from '@/app/_components/story/StoryContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Story | Arxena',
  description:
    "Why we built Arxena — map any target company's org chart in real time, build lists, enrich contacts, and let AI engage in your voice. Sales, recruiting, investing, or research.",
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

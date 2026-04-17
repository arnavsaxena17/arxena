import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ResourceSubpageContent } from '@/app/_components/marketing/ResourceSubpageContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Blog | Arxena',
  description:
    'Editorial content on org intelligence, account strategy, talent, and how structure shapes outcomes.',
  alternates: {
    canonical: '/resources/blog',
  },
};

export default function ResourcesBlogPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ResourceSubpageContent
          headline="Blog"
          paragraphs={[
            'Long-form stories and practical guides on using org structure as a competitive edge — from executive search and enterprise sales to strategy and diligence.',
            'New articles ship on a regular cadence. Subscribe to updates or talk to us about topics you want covered.',
          ]}
          signUpUrl={signUpUrl}
          primaryCtaHref="/contact#schedule"
          primaryCtaLabel="Get updates"
        />
      </ContentContainer>
    </>
  );
}

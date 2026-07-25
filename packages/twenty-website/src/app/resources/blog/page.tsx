import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, RESOURCES_INDEX } from '@/lib/brand-content';

import { ResourceSubpageContent } from '@/app/_components/marketing/ResourceSubpageContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: `Blog | ${BRAND.name}`,
  description: RESOURCES_INDEX.cards.blog,
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
          paragraphs={[...RESOURCES_INDEX.blogParagraphs]}
          signUpUrl={signUpUrl}
          primaryCtaHref="/contact#schedule"
          primaryCtaLabel="Get updates"
        />
      </ContentContainer>
    </>
  );
}

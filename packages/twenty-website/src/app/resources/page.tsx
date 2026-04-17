import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ResourcesHubContent } from '@/app/_components/marketing/ResourcesHubContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Resources | Arxena',
  description:
    'Blog, org intelligence reports, and ROI calculators — content and tools for people-discovery and GTM workflows.',
  alternates: {
    canonical: '/resources',
  },
};

export default function ResourcesIndexPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ResourcesHubContent />
      </ContentContainer>
    </>
  );
}

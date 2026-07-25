import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, RESOURCES_INDEX } from '@/lib/brand-content';

import { ResourcesHubContent } from '@/app/_components/marketing/ResourcesHubContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: `Resources | ${BRAND.name}`,
  description: RESOURCES_INDEX.sub,
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

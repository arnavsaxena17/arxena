import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, RESOURCES_INDEX } from '@/lib/brand-content';

import { ResourceSubpageContent } from '@/app/_components/marketing/ResourceSubpageContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: `Org intelligence reports | ${BRAND.name}`,
  description: RESOURCES_INDEX.cards.reports,
  alternates: {
    canonical: '/resources/org-intelligence-reports',
  },
};

export default function OrgIntelligenceReportsPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ResourceSubpageContent
          headline="Org intelligence reports"
          paragraphs={[...RESOURCES_INDEX.reportsParagraphs]}
          signUpUrl={signUpUrl}
          primaryCtaHref="/contact#schedule"
          primaryCtaLabel="Request a report"
        />
      </ContentContainer>
    </>
  );
}

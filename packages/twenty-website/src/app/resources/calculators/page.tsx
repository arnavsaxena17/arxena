import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, RESOURCES_INDEX } from '@/lib/brand-content';

import { ResourceSubpageContent } from '@/app/_components/marketing/ResourceSubpageContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: `ROI calculators | ${BRAND.name}`,
  description: RESOURCES_INDEX.cards.calculators,
  alternates: {
    canonical: '/resources/calculators',
  },
};

export default function ResourcesCalculatorsPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ResourceSubpageContent
          headline="Calculators"
          paragraphs={[...RESOURCES_INDEX.calculatorsParagraphs]}
          signUpUrl={signUpUrl}
          primaryCtaHref="/contact#schedule"
          primaryCtaLabel="Book a walkthrough"
        />
      </ContentContainer>
    </>
  );
}
